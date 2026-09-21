# Đặc tả chức năng giao diện HESTA Frontend

> Tài liệu này là ảnh chụp chức năng của mã nguồn front-end tại ngày 16/09/2026, dùng làm cơ sở trùng tu toàn bộ giao diện.
>
> Phạm vi chỉ mô tả nội dung, hành vi, trạng thái, dữ liệu và ranh giới component. Tài liệu cố ý không quy định màu sắc, kích thước, bố cục, hiệu ứng hay phong cách trình bày.

## 1. Mục tiêu khi làm lại giao diện

Có thể thay đổi hoàn toàn phần nhìn, nhưng cần giữ nguyên:

- Các route và điều kiện truy cập.
- Các luồng đăng nhập, đăng ký, quên mật khẩu, lời mời tham gia nhà và đăng xuất.
- Hợp đồng props của component và callback giữa component cha/con.
- Dữ liệu gửi lên API, dữ liệu đọc từ API và thời điểm gọi API.
- Phân biệt quyền nền tảng `ADMIN`/`USER` với quyền trong nhà `OWNER`/`MEMBER`.
- Các trạng thái tải, lỗi, thành công, rỗng, vô hiệu hóa và xác nhận thao tác nguy hiểm.
- Cơ chế lưu phiên đăng nhập, đồng bộ người dùng và kết nối realtime.
- Các giới hạn validation đang có.

Không nên hiểu phần mô tả trong tài liệu này là yêu cầu giữ lại cấu trúc trình bày hiện tại. Ví dụ: bảng có thể đổi thành danh sách hoặc card, tab có thể đổi thành một phương thức điều hướng khác, miễn toàn bộ thông tin và thao tác tương ứng vẫn còn.

## 2. Tổng quan kỹ thuật và ranh giới trách nhiệm

- Ứng dụng là SPA dùng React, TypeScript, Vite và React Router.
- Redux là nguồn dữ liệu dùng chung cho phiên đăng nhập, người dùng hiện tại, nhà đang chọn và trạng thái hạ tầng realtime.
- Dữ liệu theo màn hình như danh sách nhà, thành viên, thiết bị, phòng và kịch bản đang được giữ cục bộ trong component.
- Form, modal, dropdown, thông báo lỗi và trạng thái loading cũng là state cục bộ.
- Các lời gọi HTTP nằm trong `src/services`; component không tự tạo endpoint.
- Access token được tự động gắn vào mọi request qua API client.
- Khi API trả về `401`, xử lý hết phiên được phát đi tập trung; router chịu trách nhiệm xóa phiên và chuyển về trang đăng nhập.
- `RealtimeLifecycle` được gắn một lần ở cấp ứng dụng. Các màn hình không được tạo thêm WebSocket/STOMP client riêng.

## 3. Bản đồ route

| Route | Người được truy cập | Component chính | Hành vi quan trọng |
|---|---|---|---|
| `/login` | Công khai, kể cả khi đã có phiên | `LoginForm` | Đăng nhập email/mật khẩu hoặc Google |
| `/register` | Công khai, kể cả khi đã có phiên | `RegisterForm` | Đăng ký thường; có thể tự tham gia nhà nếu URL chứa token mời |
| `/forgot-password` | Công khai | `ForgotPasswordForm` | Gửi OTP khôi phục tới email |
| `/reset-password` | Công khai nhưng cần `resetEmail` trong navigation state | `ResetPasswordForm` | Xác minh OTP rồi đặt mật khẩu mới; truy cập trực tiếp thiếu email sẽ quay về trang quên mật khẩu |
| `/join` | Cả khách và người đã đăng nhập | `UnauthenticatedJoin` hoặc `JoinHome` | Khách chọn đăng nhập/đăng ký; người đã đăng nhập xác nhận hoặc từ chối lời mời |
| `/home` | Bắt buộc đăng nhập | `HomePage` | Chọn nhà, quản lý kịch bản, thành viên, đi tới danh sách thiết bị và mở hồ sơ |
| `/home/:homeId/devices` | Bắt buộc đăng nhập | `DevicePage` | Xem thiết bị của một nhà, lọc theo phòng, xem chi tiết và xóa thiết bị |
| `/admin` | Bắt buộc đăng nhập và có `platformRole = ADMIN` | `AdminDashboard` | Hiện tổng quan quản trị và mở hồ sơ cá nhân |
| Route không tồn tại | Tùy phiên | `Navigate` | Khách về `/login`, user về `/home`, admin về `/admin` |

Quy tắc bổ sung:

- `ADMIN` vẫn có thể chủ động truy cập `/home`.
- Người đã đăng nhập nhưng không phải `ADMIN` khi vào `/admin` sẽ được chuyển về `/home`.
- Khi khách bị chặn ở route bảo vệ, đường dẫn cần quay lại được lưu trong navigation state.
- Query string và hash hiện tại được giữ lại qua phần lớn thao tác điều hướng.

## 4. Luồng phiên đăng nhập và điều hướng

### 4.1 Khôi phục phiên

Khi ứng dụng khởi tạo:

- Đọc `accessToken`, `refreshToken` và `userInfo` từ `localStorage`.
- Phiên chỉ được xem là hợp lệ khi có access token và `userInfo` parse được với các trường người dùng tối thiểu hợp lệ.
- Route guard chờ bước khởi tạo phiên hoàn tất rồi mới quyết định render hay chuyển hướng.
- Không có luồng gọi refresh-token trong front-end hiện tại.

### 4.2 Sau khi đăng nhập

- Lưu token và người dùng vào `localStorage`.
- Cập nhật Redux auth state.
- Nếu đang xử lý một lời mời chưa hoàn tất, chuyển tới `/join` trước.
- Nếu có điểm quay lại hợp lệ thì quay lại `/home` hoặc `/admin`; user thường không được quay lại `/admin`.
- Nếu không có điểm quay lại, `ADMIN` tới `/admin`, `USER` tới `/home`.

### 4.3 Đăng xuất hoặc hết phiên

- Ngắt realtime.
- Xóa ba khóa phiên `accessToken`, `refreshToken`, `userInfo`; không xóa dữ liệu localStorage không liên quan.
- Xóa user, nhà đang chọn và trạng thái realtime trong Redux.
- Chuyển về `/login`.
- Nếu hết phiên trong luồng lời mời, token mời và điểm quay lại `/join` phải được giữ.

## 5. Luồng lời mời tham gia nhà

Front-end chấp nhận cả hai tên query parameter: `token` và `inviteToken`.

### 5.1 Khách chưa đăng nhập

Khi mở `/join` có token:

- Hiển thị thông tin rằng người dùng nhận được lời mời.
- Cho chọn đăng ký tài khoản mới hoặc đăng nhập tài khoản có sẵn.
- Token phải được giữ nguyên khi chuyển sang `/register` hoặc `/login`.

Khi mở `/join` không có token, khách được chuyển tới `/login`.

### 5.2 Đăng ký từ lời mời

- `RegisterForm` đọc token từ URL và gửi token đó dưới trường `inviteCode` khi đăng ký.
- Backend chịu trách nhiệm tự tham gia nhà trong quá trình đăng ký.
- Sau đăng ký thành công, người dùng vẫn phải chuyển sang đăng nhập.
- Navigation state đánh dấu token đã được xử lý để sau đăng nhập không gọi tham gia nhà lần thứ hai.

### 5.3 Đăng nhập từ lời mời

- Sau đăng nhập thành công, người dùng được chuyển lại `/join`.
- Người dùng có thể xác nhận tham gia hoặc từ chối/quay lại.
- Xác nhận gọi API tham gia bằng token, báo thành công rồi về `/home`.
- Từ chối không gọi API, chỉ về `/home` và đánh dấu token đã xử lý.
- Nếu token thiếu, hết hạn hoặc không tồn tại, màn hình phải có trạng thái lỗi và không cho xác nhận khi không có token.

## 6. Đặc tả từng màn hình và component

### 6.1 `LoginForm` — Đăng nhập

Nội dung/chức năng cần có:

- Nhận email và mật khẩu.
- `deviceId` luôn gửi là `WEB_CLIENT`; `deviceType` luôn gửi là `BROWSER`.
- Kiểm tra email không rỗng sau khi trim.
- Kiểm tra mật khẩu không rỗng.
- Khi gửi form: xóa lỗi cũ, khóa các thao tác đăng nhập liên quan và hiển thị trạng thái đang xử lý.
- Nếu đăng nhập thành công, trả toàn bộ `AuthResponse` qua `onLoginSuccess`.
- Nếu thất bại, hiển thị message từ API hoặc message dự phòng.
- Có đường dẫn tới quên mật khẩu và đăng ký; phải giữ query/hash/navigation state của luồng đang có.
- Có nút Google Sign-In chính thức do Google Identity Services render.
- Khi Google SDK chưa sẵn sàng, có trạng thái đang tải.
- Khi Google trả credential, gửi `idToken` cùng thông tin loại thiết bị tới backend.
- Không cho gửi đăng nhập thường và Google đồng thời.

### 6.2 `GoogleSignInButton` — Đăng nhập Google

- Dùng Google Identity Services SDK được tải từ `index.html`.
- Khởi tạo một lần, không auto-select và cho phép đóng khi bấm bên ngoài.
- Trả ID token qua `onSuccess`.
- Trả lỗi qua `onError` nếu không nhận được credential hoặc không khởi tạo được SDK.
- Có khả năng bị vô hiệu hóa từ component cha.

### 6.3 `RegisterForm` — Đăng ký

Các trường dữ liệu:

- Họ và tên: bắt buộc, trim trước khi gửi.
- Email: bắt buộc, trim trước khi gửi.
- Mật khẩu: bắt buộc, tối thiểu 8 ký tự ở màn đăng ký.
- Xác nhận mật khẩu: bắt buộc và phải trùng mật khẩu.
- Số điện thoại: tùy chọn, trim; chuỗi rỗng được gửi thành `undefined`.
- Mã mời: không phải trường người dùng nhập trên UI hiện tại; được lấy tự động từ `token`/`inviteToken` trong URL và gửi thành `inviteCode`.

Trạng thái và hành vi:

- Hiển thị dấu hiệu người dùng đang đăng ký từ một lời mời nếu URL có token.
- Hiển thị lỗi validation hoặc lỗi từ API.
- Khóa nút gửi và báo đang xử lý trong khi request chạy.
- Khi thành công, thay form bằng trạng thái chào mừng có tên người dùng vừa đăng ký.
- Có thao tác chuyển sang đăng nhập; trong luồng lời mời phải báo cho router rằng token đã được xử lý.

### 6.4 `ForgotPasswordForm` — Yêu cầu khôi phục mật khẩu

- Nhận email bắt buộc và trim trước khi gửi.
- Gọi API gửi yêu cầu quên mật khẩu.
- Có trạng thái loading và lỗi.
- Thành công truyền email sang route đặt lại mật khẩu bằng navigation state.
- Có thao tác quay lại đăng nhập.

### 6.5 `ResetPasswordForm` — Xác minh OTP và đặt mật khẩu mới

Luồng gồm hai bước:

1. Xác minh OTP:
   - Hiển thị email đã nhận mã.
   - OTP chỉ nhận chữ số, tối đa và bắt buộc đúng 6 chữ số.
   - Chỉ chuyển sang bước 2 khi API xác minh thành công.
2. Đặt mật khẩu mới:
   - Nhận mật khẩu mới và xác nhận mật khẩu.
   - Mật khẩu mới tối thiểu 6 ký tự ở màn này.
   - Hai mật khẩu phải trùng nhau.
   - Gửi email, OTP đã xác minh và mật khẩu mới tới API.
   - Thành công chuyển về đăng nhập.

Người dùng có thể quay từ bước 2 về bước 1. Ở bước 1, thao tác hủy sẽ quay về đăng nhập.

### 6.6 `HomePage` — Trang chủ người dùng

#### Khu vực tài khoản

- Hiển thị thương hiệu/tên hệ thống và vai trò nền tảng của người dùng.
- Nút tài khoản hiển thị avatar; nếu không có avatar thì dùng ký tự đầu của họ tên.
- Khi mở menu tài khoản, hiển thị họ tên và email.
- Menu có thao tác mở `ProfileModal`, đăng xuất và mục “Cài đặt”.
- Menu tự đóng khi người dùng bấm ra ngoài.
- Mục “Cài đặt” hiện chưa gắn hành vi.

#### Thông tin người dùng và chọn nhà

- Hiển thị lời chào theo họ tên và ID người dùng.
- Khi mount, gọi API lấy danh sách nhà của người dùng.
- Mỗi nhà có `homeId`, `homeName` và vai trò `OWNER`/`MEMBER`.
- Nếu có nhà, mặc định chọn nhà đầu tiên.
- Khi tải lại danh sách, giữ nhà đang chọn nếu nhà đó vẫn tồn tại; nếu không thì chọn nhà đầu tiên.
- Cho đổi nhà đang xem khi có nhiều nhà.
- Nhà đang chọn được đưa vào Redux để phục vụ subscription realtime.
- Khi `HomePage` unmount, nhà đang chọn trong Redux bị xóa.

#### Các điểm vào tính năng

- “Quản lý Thiết bị” là điểm vào hoạt động: nếu có nhà đang chọn thì mở `/home/{homeId}/devices`; nếu không có nhà thì báo người dùng cần tạo/tham gia nhà trước.
- “Kịch bản & Tự động hóa” trong nhóm giới thiệu hiện chỉ là nội dung mô tả, không có onClick. Tính năng thật nằm trong `SceneManagement` bên dưới khi đã chọn nhà.
- “Hồ sơ & Phân quyền” trong nhóm giới thiệu hiện chỉ là nội dung mô tả, không có onClick. Hồ sơ được mở từ menu tài khoản; phân quyền thành viên nằm trong `MemberManagement`.

#### Trạng thái chưa có nhà

- Hiển thị thông báo người dùng chưa tham gia nhà nào.
- Cho mở modal tạo nhà mới.
- Tên nhà tối đa 50 ký tự nhưng hiện không bắt buộc; chuỗi trống vẫn có thể được gửi lên backend.
- Khi tạo thành công: báo thành công, đóng modal, xóa input và tải lại danh sách nhà.
- Khi thất bại: báo lỗi từ API hoặc lỗi dự phòng.
- Nội dung có nhắc khả năng tham gia bằng mã mời, nhưng màn này hiện không có ô nhập mã; tham gia nhà được thực hiện qua route `/join`.

### 6.7 `SceneManagement` — Quản lý kịch bản

Khi có nhà được chọn, component tải song song:

- Danh sách kịch bản của nhà.
- Danh sách thiết bị của nhà để tạo hành động.

Hành vi chung:

- Hiển thị loading, lỗi và trạng thái không có kịch bản.
- Tự chọn kịch bản đầu tiên nếu chưa có lựa chọn hợp lệ.
- Danh sách cho biết tên, số hành động và trạng thái bật/tắt.
- Chi tiết kịch bản cho biết tên, mô tả và danh sách hành động đúng thứ tự.
- `MEMBER` chỉ xem.
- Chỉ `OWNER` thấy và thực hiện các thao tác tạo, sửa, xóa kịch bản; thêm, xóa, đổi thứ tự hành động.

Tạo/sửa kịch bản:

- Tên bắt buộc, tối đa 150 ký tự.
- Mô tả tùy chọn, tối đa 2.000 ký tự.
- Có cờ bật/tắt kịch bản.
- Kịch bản mới luôn được tạo với danh sách hành động rỗng.
- Sửa kịch bản chỉ gửi tên, mô tả và trạng thái bật/tắt; không ghi đè mảng hành động.
- Xóa kịch bản cần xác nhận trước.

Hành động trong kịch bản:

| Loại hành động | Giá trị gửi lên |
|---|---|
| `TURN_ON` | `null` |
| `TURN_OFF` | `null` |
| `SET_BRIGHTNESS` | Số hữu hạn |
| `SET_TEMPERATURE` | Số hữu hạn |
| `SET_SPEED` | Số hữu hạn |
| `SET_STATE` | Một object JSON hợp lệ, không chấp nhận array/null |

- Khi thêm hành động, người dùng chọn thiết bị, loại hành động và giá trị nếu loại đó cần giá trị.
- `order` của hành động mới bằng số hành động hiện có.
- Sau khi thêm/xóa hành động, tải lại chi tiết kịch bản từ API.
- Đổi thứ tự bằng cách gửi toàn bộ mảng action ID theo thứ tự mới.
- Không cho di chuyển hành động đầu lên trên hoặc hành động cuối xuống dưới.
- Nút thêm bị khóa khi đang lưu hoặc nhà không có thiết bị.
- Hiện tại component chỉ cấu hình chuỗi hành động; chưa có chức năng chạy/thực thi kịch bản.

### 6.8 `MemberManagement` — Quản lý thành viên trong nhà

- Tải danh sách thành viên theo `homeId`.
- Có trạng thái loading và lỗi tải danh sách.
- Với mỗi thành viên, hiển thị avatar hoặc ký tự đại diện, họ tên, email, vai trò trong nhà và ngày tham gia theo locale Việt Nam.
- `MEMBER` chỉ xem danh sách.
- `OWNER` có thể mời thành viên, đổi vai trò mỗi người giữa `OWNER` và `MEMBER`, hoặc xóa thành viên.
- Xóa thành viên cần xác nhận trước; thành công tải lại danh sách.
- Đổi vai trò thành công tải lại danh sách.
- Front-end hiện không tự loại trừ chính người dùng khỏi các thao tác đổi quyền/xóa; backend là nơi quyết định quyền hợp lệ cuối cùng.

Luồng mời thành viên dành cho `OWNER`:

- Mở modal sẽ lập tức yêu cầu backend tạo một lời mời không gắn email.
- Khi tạo xong, hiển thị link dạng `/join?token={inviteToken}` và thời điểm hết hạn theo locale Việt Nam.
- Có thao tác sao chép link bằng Clipboard API.
- Có thể nhập email bắt buộc để yêu cầu backend tạo/gửi một lời mời qua email.
- Phản hồi cần phân biệt email đã gửi thành công với trường hợp lời mời đã tạo nhưng dịch vụ email không khả dụng.
- Có loading cho lúc tạo link/gửi email và có thao tác đóng modal.

### 6.9 `DevicePage` — Danh sách thiết bị

- Đọc `homeId` từ URL.
- Có thao tác quay lại `/home`.
- Tải danh sách phòng của nhà.
- Mặc định tải tất cả thiết bị của nhà.
- Cho lọc theo “tất cả phòng” hoặc một phòng cụ thể; mỗi lần đổi lựa chọn sẽ gọi API tương ứng.
- Có trạng thái đang tải, lỗi tải thiết bị và danh sách rỗng.
- Lỗi tải danh sách phòng hiện chỉ được ghi vào console, không có thông báo riêng trên UI.
- Chọn một thiết bị sẽ mở `DeviceDetailModal` bằng dữ liệu đang có trong danh sách.
- Khi xóa thiết bị thành công trong modal, thiết bị được loại khỏi danh sách cục bộ.

Lưu ý realtime hiện tại:

- `HomePage` xóa `currentHomeId` khỏi Redux khi chuyển sang `DevicePage`, vì vậy trang thiết bị hiện không giữ subscription của nhà qua cơ chế chọn nhà.
- Danh sách thiết bị chưa đăng ký handler cho sự kiện realtime và không tự cập nhật từ `DEVICE_STATE_CHANGED`.

### 6.10 `DeviceCard` — Tóm tắt một thiết bị

Thông tin chung:

- Tên thiết bị.
- Icon tùy chỉnh nếu backend có trả về; nếu không dùng biểu tượng dự phòng theo loại.
- Trạng thái `ONLINE`, `OFFLINE`, `ERROR` hoặc `UNKNOWN` với nhãn tương ứng.
- Chọn toàn bộ item để mở chi tiết.

Thông tin/điều khiển theo loại:

- `LIGHT`, `FAN`, `AC`, `SOCKET`: có công tắc power dựa trên `currentState.power` là `ON`/`OFF`.
- `SENSOR`: nếu có đủ `temperature` và `humidity`, hiển thị nhiệt độ và độ ẩm.
- `LOCK`: dùng `currentState.state = UNLOCKED` để xác định trạng thái mở; nếu có `battery` thì hiển thị phần trăm pin.
- Loại khác chỉ hiển thị thông tin chung.

Giới hạn quan trọng: công tắc power hiện chỉ đảo `currentState.power` trong state cục bộ của `DevicePage`. Nó chưa gọi API hay gửi command tới thiết bị và sẽ mất khi tải lại dữ liệu/trang.

### 6.11 `DeviceDetailModal` — Chi tiết thiết bị

Khi mở modal:

- Gọi API tải lịch sử trạng thái của thiết bị.
- Hiển thị tên, icon và trạng thái kết nối.
- Hiển thị ID, loại thiết bị, node quản lý nếu có, GPIO pin nếu có, phòng nếu có, lần phản hồi cuối và tọa độ Digital Twin X/Y/Z.
- Nếu không có tọa độ thì hiển thị giá trị mặc định `0` cho từng trục.
- Hiển thị toàn bộ `currentState` dưới dạng JSON.
- Lịch sử gồm thời điểm thay đổi, nguồn thay đổi, trạng thái trước và trạng thái sau.
- Có trạng thái đang tải lịch sử và lịch sử rỗng.
- Lỗi tải lịch sử hiện chỉ được ghi vào console.

Thao tác:

- Có thể đóng modal.
- “Chỉnh sửa” hiện chỉ báo rằng chức năng cập nhật cấu hình đang phát triển; dù service đã có hàm update, UI chưa dùng hàm đó.
- “Xóa thiết bị” yêu cầu xác nhận, gọi API xóa, báo lỗi nếu thất bại, rồi thông báo component cha loại thiết bị khỏi danh sách và đóng modal nếu thành công.
- Không có kiểm tra vai trò `OWNER`/`MEMBER` ở front-end của màn thiết bị; backend vẫn là nguồn phân quyền cuối cùng.

### 6.12 `ProfileModal` — Hồ sơ và bảo mật

Component dùng chung cho `/home` và `/admin`, nhận:

- `user`: người dùng hiện tại.
- `onClose`: đóng modal.
- `onProfileUpdate`: đồng bộ user mới lên Redux và localStorage.

#### Phần thông tin cơ bản

- Hiển thị email nhưng không cho sửa.
- Cho sửa họ tên và số điện thoại.
- Họ tên bắt buộc, không được chỉ gồm khoảng trắng.
- Cho chọn ảnh đại diện bằng file input.
- File avatar phải là ảnh và không lớn hơn 5 MB.
- Có loading riêng cho cập nhật thông tin và tải avatar.
- Có thông báo lỗi/thành công riêng.
- Cập nhật thành công phải gọi `onProfileUpdate` để các nơi khác thấy ngay tên/avatar mới.
- Sau mỗi lần upload, reset file input để có thể chọn lại cùng một file.

#### Phần bảo mật

- Nhận mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu mới.
- Mật khẩu hiện tại bắt buộc.
- Mật khẩu mới tối thiểu 6 ký tự.
- Xác nhận phải trùng mật khẩu mới.
- Thành công xóa ba trường mật khẩu và hiển thị thông báo thành công.
- Với tài khoản `GOOGLE`, hiển thị cảnh báo rằng đổi mật khẩu có thể không khả dụng nếu chưa có mật khẩu cục bộ; form hiện vẫn được phép sử dụng.

### 6.13 `AdminDashboard` — Tổng quan quản trị

- Chỉ route guard cho tài khoản có `platformRole = ADMIN` truy cập.
- Hiển thị lời chào theo admin đang đăng nhập.
- Hiển thị bốn chỉ số: tổng người dùng, thiết bị đang hoạt động, cảnh báo hệ thống và uptime server.
- Các giá trị hiện tại (`124`, `892`, `3`, `99.9%`) là dữ liệu viết cứng, không gọi API và không tương tác.
- Menu tài khoản có mở hồ sơ, đăng xuất và mục “Cấu hình Hệ thống”.
- Mục “Cấu hình Hệ thống” hiện chưa gắn hành vi.
- Dùng chung `ProfileModal`; cập nhật hồ sơ phải đồng bộ lên state phiên.

## 7. Ma trận phân quyền cần giữ

| Chức năng | Khách | `USER`/`ADMIN` đã đăng nhập | `MEMBER` trong nhà | `OWNER` trong nhà | `ADMIN` nền tảng |
|---|---:|---:|---:|---:|---:|
| Đăng nhập/đăng ký/khôi phục mật khẩu | Có | Route vẫn mở | Không liên quan | Không liên quan | Có |
| Xác nhận lời mời | Phải đăng nhập/đăng ký trước | Có | Có thể có | Có thể có | Có thể có |
| Mở `/home` | Không | Có | Có | Có | Có |
| Xem kịch bản | Không | Theo nhà | Có | Có | Không tự động có nếu không thuộc nhà |
| Sửa kịch bản/hành động | Không | Theo vai trò nhà | Không | Có | Không tự động có nếu không phải owner |
| Xem thành viên | Không | Theo nhà | Có | Có | Không tự động có nếu không thuộc nhà |
| Mời/đổi quyền/xóa thành viên | Không | Theo vai trò nhà | Không | Có | Không tự động có nếu không phải owner |
| Mở `/admin` | Không | Chỉ `platformRole = ADMIN` | Không liên quan | Không liên quan | Có |

Quan trọng: quyền nền tảng và quyền trong nhà là hai hệ độc lập. Không được dùng `platformRole = ADMIN` để thay thế kiểm tra `home role = OWNER`.

## 8. Trạng thái dữ liệu cần có khi thiết kế lại

Mỗi khu vực có gọi API cần tiếp tục biểu diễn đầy đủ các trạng thái phù hợp:

- Chưa có dữ liệu ban đầu.
- Đang tải.
- Có dữ liệu.
- Danh sách rỗng.
- Lỗi validation phía client.
- Lỗi từ backend.
- Đang gửi/lưu/xóa/upload.
- Thành công, nếu component hiện có thông báo thành công.
- Control bị vô hiệu hóa để tránh gửi trùng.
- Xác nhận trước thao tác xóa.
- Phiên hết hạn và điều hướng về đăng nhập.

Không nên gộp các loading độc lập thành một cờ nếu điều đó làm thay đổi hành vi. Ví dụ: đăng nhập email và đăng nhập Google có state riêng; cập nhật hồ sơ và upload avatar có state riêng.

## 9. Dữ liệu hiển thị theo model

### Người dùng

- ID, họ tên, email, số điện thoại, avatar.
- Provider: `LOCAL` hoặc `GOOGLE`.
- Vai trò nền tảng: `ADMIN` hoặc `USER`.
- Trạng thái tài khoản: `ACTIVE`, `LOCKED`, `DISABLED`.
- Ngày tạo và lần hoạt động cuối nếu cần mở rộng giao diện sau này.

### Nhà và thành viên

- Nhà: ID, tên, vai trò hiện tại của người dùng.
- Thành viên: ID, họ tên, email, avatar, vai trò `OWNER`/`MEMBER`, ngày tham gia.
- Lời mời: mã mời, token mời, hạn sử dụng, trạng thái email đã gửi hay chưa.

### Thiết bị

- ID nhà/phòng/node, tên phòng/node nếu có.
- Tên, loại, GPIO pin, trạng thái kết nối.
- `currentState` linh hoạt theo từng thiết bị.
- Capabilities, icon, tọa độ Digital Twin và lần phản hồi cuối.
- Lịch sử trạng thái trước/sau, nguồn thay đổi, người thay đổi, cờ test và thời gian.

### Kịch bản

- ID, nhà, tên, mô tả, bật/tắt, danh sách hành động, ngày tạo/cập nhật.
- Mỗi hành động có thiết bị đích, tên thiết bị đích, loại hành động, giá trị, thứ tự và thời gian.

## 10. Hợp đồng API đang được UI sử dụng

Phần này là hàng rào để tránh thay đổi logic trong lúc làm giao diện:

| Nhóm | Method và endpoint | Nơi sử dụng |
|---|---|---|
| Auth | `POST /auth/login` | Đăng nhập email/mật khẩu |
| Auth | `POST /auth/google` | Đăng nhập Google |
| Auth | `POST /auth/register` | Đăng ký |
| Auth | `POST /auth/forgot-password` | Gửi OTP |
| Auth | `POST /auth/verify-otp` | Xác minh OTP |
| Auth | `POST /auth/reset-password` | Đặt mật khẩu mới |
| User | `PUT /users/me/profile` | Sửa họ tên/số điện thoại |
| User | `PUT /users/me/password` | Đổi mật khẩu |
| User | `POST /users/me/avatar` | Upload avatar multipart |
| Home | `GET /homes/my-homes` | Danh sách nhà của tôi |
| Home | `POST /homes` | Tạo nhà |
| Home | `GET /homes/{homeId}/rooms` | Danh sách phòng |
| Home | `GET /homes/{homeId}/members` | Danh sách thành viên |
| Home | `POST /homes/{homeId}/invitations` | Tạo link mời |
| Home | `POST /homes/{homeId}/invitations?email=...` | Tạo/gửi lời mời email |
| Home | `PUT /homes/{homeId}/members/{memberId}/role?role=...` | Đổi vai trò |
| Home | `DELETE /homes/{homeId}/members/{memberId}` | Xóa thành viên |
| Home | `POST /homes/join?codeOrToken=...` | Tham gia nhà |
| Device | `GET /homes/{homeId}/devices` | Tất cả thiết bị trong nhà |
| Device | `GET /rooms/{roomId}/devices` | Thiết bị theo phòng |
| Device | `GET /devices/{deviceId}/history` | Lịch sử thiết bị |
| Device | `DELETE /devices/{deviceId}` | Xóa thiết bị |
| Scene | `GET /homes/{homeId}/scenes` | Danh sách kịch bản |
| Scene | `GET /homes/{homeId}/scenes/{sceneId}` | Làm mới chi tiết kịch bản |
| Scene | `POST /homes/{homeId}/scenes` | Tạo kịch bản |
| Scene | `PUT /homes/{homeId}/scenes/{sceneId}` | Sửa kịch bản |
| Scene | `DELETE /homes/{homeId}/scenes/{sceneId}` | Xóa kịch bản |
| Scene | `POST /homes/{homeId}/scenes/{sceneId}/actions` | Thêm hành động |
| Scene | `DELETE /homes/{homeId}/scenes/{sceneId}/actions/{actionId}` | Xóa hành động |
| Scene | `PUT /homes/{homeId}/scenes/{sceneId}/actions/reorder` | Đổi thứ tự hành động |

Service có sẵn nhưng UI hiện chưa dùng:

- `GET /devices/{deviceId}` để tải chi tiết thiết bị mới nhất.
- `PUT /devices/{deviceId}` để cập nhật cấu hình thiết bị.

## 11. Realtime liên quan tới giao diện

- Kết nối dùng một STOMP client dùng chung tới `/ws`, xác thực bằng Bearer token trong STOMP CONNECT header.
- Khi access token xuất hiện, client kết nối; khi token đổi, kết nối cũ được thay; khi đăng xuất, client ngắt.
- Nhà đang chọn được subscribe tại `/topic/homes/{homeId}/events`.
- Hỗ trợ ba loại event: `SENSOR_READING_UPDATED`, `DEVICE_STATE_CHANGED`, `NOTIFICATION_CREATED`.
- Client bỏ qua event sai định dạng, sai nhà và event ID trùng gần đây.
- Có các trạng thái hạ tầng: `disconnected`, `connecting`, `connected`, `reconnecting`, `error`.
- Redux lưu trạng thái kết nối, nhà đang subscribe, thời điểm event cuối và lỗi an toàn.
- UI hiện chưa hiển thị các trạng thái realtime này và chưa có feature component tiêu thụ event để cập nhật domain data.
- Khi thiết kế lại, không được tạo socket mới cho từng màn hình hoặc từng component.

## 12. Danh sách phần hiện chỉ là placeholder hoặc chưa hoàn chỉnh

Các mục sau cần được thể hiện đúng với khả năng hiện tại, không nên mô tả như chức năng đã hoạt động đầy đủ:

- Mục “Cài đặt” tại trang Home: chưa có hành vi.
- Mục “Cấu hình Hệ thống” tại trang Admin: chưa có hành vi.
- Các chỉ số Admin: số tĩnh, chưa lấy từ backend.
- Nút “Chỉnh sửa” thiết bị: chỉ hiện thông báo đang phát triển.
- Công tắc nguồn thiết bị: chỉ cập nhật tạm state trong trình duyệt, không điều khiển thiết bị thật.
- Kịch bản: có CRUD và quản lý hành động, nhưng chưa có thao tác thực thi.
- Realtime: hạ tầng đã có nhưng các màn hình chưa hiển thị trạng thái kết nối hoặc áp dụng event vào dữ liệu.
- Lỗi tải phòng và lỗi tải lịch sử thiết bị: chỉ ghi console.
- Tạo nhà cho phép tên rỗng ở phía component hiện tại.
- Trang Home nói có thể tham gia bằng mã mời nhưng không có form nhập mã; luồng thật đi qua link `/join`.

## 13. Bản đồ component cần giữ ranh giới

```text
App
├── RealtimeLifecycle
└── BrowserRouter
    └── AppRoutes
        ├── LoginForm
        │   └── GoogleSignInButton
        ├── RegisterForm
        ├── ForgotPasswordForm
        ├── ResetPasswordForm
        ├── UnauthenticatedJoin
        ├── JoinHome
        ├── HomePage
        │   ├── ProfileModal
        │   ├── SceneManagement
        │   └── MemberManagement
        ├── DevicePage
        │   ├── DeviceCard (nhiều item)
        │   └── DeviceDetailModal
        └── AdminDashboard
            └── ProfileModal
```

Có thể tách phần trình bày nhỏ hơn nếu cần, nhưng không nên chuyển API call, session logic, route logic hoặc shared state sang các component trình bày mới.

## 14. Checklist nghiệm thu sau khi trùng tu giao diện

### Route và phiên

- [ ] Truy cập trực tiếp, refresh và Back/Forward hoạt động ở mọi route.
- [ ] Khách không vào được `/home`, `/home/:homeId/devices`, `/admin`.
- [ ] User thường không vào được `/admin`; admin vẫn vào được `/home`.
- [ ] Khôi phục phiên từ localStorage diễn ra trước route guard.
- [ ] Đăng xuất và phản hồi `401` đưa người dùng về login, đồng thời dọn đúng state phiên.
- [ ] Cập nhật hồ sơ làm mới tên/avatar ở cả Home và Admin mà không cần đăng nhập lại.

### Auth và lời mời

- [ ] Validation từng form vẫn đúng các giới hạn hiện tại.
- [ ] Loading ngăn gửi trùng.
- [ ] Google Sign-In vẫn render và gửi ID token đúng luồng.
- [ ] Reset password vẫn là hai bước và không vào thẳng bước OTP khi thiếu email.
- [ ] Cả `token` và `inviteToken` đều hoạt động.
- [ ] Query/hash và token không mất khi qua login/register.
- [ ] Đăng ký bằng lời mời không tham gia nhà lần thứ hai sau login.

### Nhà, kịch bản và thành viên

- [ ] Danh sách nhà, chọn nhà và trạng thái chưa có nhà hoạt động.
- [ ] Đổi nhà tải đúng kịch bản, thiết bị dùng cho action và thành viên.
- [ ] `MEMBER` chỉ xem; `OWNER` có đủ thao tác quản trị nhà.
- [ ] CRUD kịch bản và CRUD/reorder hành động giữ nguyên payload.
- [ ] Các loại action parse giá trị đúng kiểu.
- [ ] Link mời, copy link, hạn dùng và gửi email vẫn hoạt động.
- [ ] Các thao tác xóa vẫn yêu cầu xác nhận.

### Thiết bị

- [ ] Lọc tất cả phòng/từng phòng gọi đúng nguồn dữ liệu.
- [ ] Card hiển thị đúng thông tin riêng của power device, sensor và lock.
- [ ] Mở/đóng chi tiết và tải lịch sử hoạt động.
- [ ] Xóa thành công loại item khỏi danh sách; lỗi xóa không làm mất item.
- [ ] Không vô tình biến power toggle hiện tại thành command thật nếu chưa có yêu cầu backend tương ứng.

### Trạng thái và chất lượng tương tác

- [ ] Mọi loading, error, empty, success và disabled state đã được thể hiện.
- [ ] Các modal có thể đóng bằng control rõ ràng và không gửi form ngoài ý muốn.
- [ ] Input có label/tên truy cập; control chỉ có icon vẫn có accessible name.
- [ ] Có thể thao tác bằng bàn phím với menu, modal, form, danh sách chọn và nút.
- [ ] Trải nghiệm vẫn dùng được ở màn hình nhỏ và nội dung dài không làm mất thao tác chính.
- [ ] Không thêm WebSocket client mới và không thay đổi endpoint/API payload trong quá trình sửa UI.

## 15. Các file nguồn đã được đối chiếu

- `src/routes/*`: route, guard, điều hướng và session lifecycle.
- `src/components/auth/*`: toàn bộ luồng xác thực.
- `src/components/home/*`: trang Home, nhà, lời mời, kịch bản và thành viên.
- `src/components/device/*`: danh sách, card và chi tiết thiết bị.
- `src/components/profile/ProfileModal.tsx`: hồ sơ, avatar và mật khẩu.
- `src/components/admin/AdminDashboard.tsx`: trang Admin.
- `src/services/*`: hợp đồng API mà UI gọi.
- `src/types/*`: shape dữ liệu người dùng, thiết bị và kịch bản.
- `src/store/*`: auth, nhà đang chọn và realtime state.
- `src/realtime/*` và `docs/FRONTEND_REALTIME.md`: vòng đời realtime.
- `tests/*`: hành vi route, lời mời, session, scene API và realtime đã được khóa bằng test.
