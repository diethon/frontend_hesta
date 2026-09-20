# Trình chỉnh sửa bố cục Twin 2D của HESTA

Triển khai ngày 17/09/2026. Phạm vi công việc **chỉ thuộc frontend**, không sửa
tệp backend. Các phần việc backend hiện có và những thay đổi có sẵn trong
`docs/FRONTEND_DIGITAL_TWIN.md` được giữ nguyên.

## Hợp đồng API backend được sử dụng

Trước khi định nghĩa kiểu dữ liệu frontend, đã kiểm tra
`backend_hesta/docs/TWIN_LAYOUT.md`, cả ba ví dụ JSON về bố cục, các kiểu dữ liệu
yêu cầu/phản hồi, `TwinLayoutServiceImpl`, các kiểm thử của dịch vụ này và
`HomeAuthorizationService`.

Bộ gọi API có xác thực hiện có sử dụng các endpoint:

```text
GET /api/v1/homes/{homeId}/twin-layout
PUT /api/v1/homes/{homeId}/twin-layout
```

Bộ gọi API đã cấu hình sẵn tiền tố `/api/v1` và token Bearer. Cả hai phản hồi đều
có cấu trúc `{ code: 1000, result: { homeId, revision, rooms, nodes } }`.
Mỗi phòng có dạng `{ roomId, x, y, width, height }`. Mỗi đối tượng có dạng
`{ nodeType: "DEVICE" | "SENSOR", nodeId, roomId: string | null, x, y }`.
Yêu cầu PUT gửi `{ expectedRevision, rooms, nodes }` và **thay thế toàn bộ bố cục**.
Các vị trí không có trong yêu cầu sẽ bị loại bỏ. Mảng rỗng và phiên bản bằng 0
đều hợp lệ.

Tọa độ là số hữu hạn đã chuẩn hóa, có tối đa **ba chữ số thập phân**. Kích thước
phòng phải lớn hơn 0 và toàn bộ phòng phải nằm trong khoảng `[0, 1]`. Thao tác
kéo, đổi kích thước và nhập số đều giới hạn, làm tròn theo các quy tắc này.
Frontend dùng 0.001 làm kích thước dương nhỏ nhất theo độ chính xác backend cho
phép. Khi tạo dữ liệu gửi đi, chương trình chỉ lấy các trường hình học, không
đưa vào giá trị vận hành, mốc thời gian, trạng thái, kích thước khung nhìn hay
số đo bằng pixel.

**Làm rõ hệ tọa độ:** tài liệu và kiểm thử backend chưa xác định rõ hệ tọa độ
của đối tượng. Mã hiện có lưu nguyên tọa độ đối tượng, kiểm tra độc lập với
phòng và cho phép ID phòng hiển thị bằng null. Điểm chưa rõ này đã được báo lại;
người dùng đã chọn **tọa độ theo toàn bộ vùng sơ đồ**. Đây là cách hiểu được
người dùng xác nhận, không phải khẳng định rằng tài liệu backend đã quy định rõ.
Di chuyển hoặc đổi kích thước phòng không làm thay đổi tọa độ đối tượng.
Các thẻ đối tượng được dịch chuyển về mặt hiển thị để nhãn không vượt ra ngoài
mép sơ đồ; điểm neo chuẩn hóa vẫn giữ giá trị x/y đã lưu.

Các phòng được phép chồng lên nhau. Khi thả đối tượng, phòng chứa điểm neo và
được vẽ sau cùng sẽ được chọn, tức phòng nằm trên cùng. Nếu thả ngoài tất cả
các phòng, `roomId: null`. Di chuyển đối tượng không thay đổi quan hệ gán phòng
trong dữ liệu nghiệp vụ. Bỏ vị trí một phòng sẽ giữ nguyên tọa độ các đối tượng
trên sơ đồ và xóa ID phòng hiển thị của chúng.

ID cảm biến được sao chép chính xác từ trạng thái Twin chuẩn, không tách, tạo
lại, đổi chữ hoa/chữ thường hoặc tự sinh ID mới. Khóa React/bố cục bao gồm cả
loại và ID đối tượng.

## Trạng thái và hành vi giao diện

`twinSlice` tiếp tục là nơi lưu duy nhất cho dữ liệu vận hành: phòng, thiết bị,
cảm biến, giá trị đo, trạng thái hiện tại, độ mới của dữ liệu và mốc thời gian.
Slice `twinLayout` mới quản lý hình học/phiên bản đã xác nhận, bản nháp chỉ chứa
hình học và có thể bằng null, các cờ thay đổi chưa lưu/đang tải/đang lưu, ID yêu
cầu và lỗi bố cục. Slice này cũng lưu kết quả tra cứu quyền, nhưng không sao
chép dữ liệu vận hành của đối tượng.

- Mặc định là chế độ xem. Các hình chữ nhật phòng và thẻ thiết bị/cảm biến kết
  hợp vị trí đã lưu với dữ liệu vận hành lấy qua các selector hiện có. Toàn bộ
  thông tin vận hành vẫn có trong mục mở rộng “Dữ liệu trực tiếp”.
- Chế độ chỉnh sửa sao chép hình học đã xác nhận. Bảng đối tượng chưa đặt được
  tính từ các ID Twin hiện có, loại trừ những ID đã có vị trí trong bản nháp.
  Bảng này không tạo đối tượng nghiệp vụ mới.
- Chủ nhà có thể đặt các phòng hiện có, kéo và đổi kích thước phòng, đặt và di
  chuyển thiết bị/cảm biến, xem dữ liệu vận hành và bỏ vị trí hiển thị của chúng.
- Khi con trỏ di chuyển, hình học xem trước được cập nhật trong trạng thái cục
  bộ của component. Khi thả con trỏ, bản nháp chuẩn hóa được cập nhật một lần;
  nếu hủy thao tác con trỏ thì chỉ bỏ thay đổi của thao tác đó. Cơ chế giữ con
  trỏ (pointer capture) xử lý trường hợp con trỏ rời phần tử mà không cần bộ
  lắng nghe kéo thả toàn cục.
- Người dùng chọn đối tượng bằng nút đúng ngữ nghĩa và `aria-pressed`. Các ô
  nhập phần trăm có nhãn cho phép chỉnh vị trí/kích thước bằng bàn phím hoặc
  trên màn hình nhỏ. Dấu hiệu focus và nhãn sức khỏe bằng chữ được giữ nguyên.
- Cờ thay đổi chưa lưu dựa trên so sánh hình học thực tế. Chỉ vào chế độ chỉnh
  sửa hoặc gửi lại hình học không đổi sẽ không bật cờ này. Trả hình học về
  phiên bản đã xác nhận sẽ xóa cờ.
- Khi lưu, giao diện kiểm tra dữ liệu, gửi một PUT đầy đủ và khóa thao tác sửa
  trong lúc chờ. Không cho lưu lần hai khi lần đầu chưa hoàn tất.
  `expectedRevision` luôn lấy từ phản hồi đã xác nhận, bằng 0 cho lần lưu đầu.
  Bố cục và phiên bản backend trả về thay thế trạng thái đã xác nhận; frontend
  không tự giả định hoặc tăng phiên bản.
- Lưu thành công sẽ thoát chế độ chỉnh sửa và xóa cờ thay đổi chưa lưu. Khi hủy
  bản nháp có thay đổi, giao diện yêu cầu xác nhận, chỉ bỏ bản nháp và giữ lại
  giá trị đo/trạng thái/sức khỏe vận hành mới nhất.
- HTTP 409 hoặc mã backend 1130 hiển thị thông báo xung đột và giữ bản nháp.
  “Tải sơ đồ mới nhất” yêu cầu xác nhận bỏ thay đổi chưa lưu. Không tự gửi lại
  với phiên bản mới, ghi đè hoặc gộp hình học.
- HTTP 403 giữ bản nháp và cho phép kiểm tra lại quyền thành viên. Nút lưu vẫn
  bị khóa cho đến khi quyền được kiểm tra lại. Lỗi mạng/máy chủ thông thường
  giữ bản nháp để người dùng thử lại. Lỗi GET có thao tác tải lại riêng.

API `/homes/my-homes` hiện có cung cấp OWNER/MEMBER nhưng không có trường trạng
thái thành viên. Backend chỉ cho GET bố cục thành công sau khi kiểm tra thành
viên có trạng thái ACTIVE. MEMBER chỉ xem sơ đồ; các thao tác OWNER yêu cầu đã
tải hình học. Backend vẫn là nơi quyết định quyền cuối cùng khi dữ liệu quyền
ở frontend đã cũ.

Yêu cầu tải snapshot, bố cục và quyền thành viên được khởi chạy độc lập khi vào
trang. Kiểm tra ID nhà và ID yêu cầu giúp loại phản hồi đến muộn, kể cả khi
chuyển A → B → A, phản hồi PUT và phản hồi quyền. Khi dọn dẹp, chương trình hủy
các yêu cầu tải ban đầu và xóa trạng thái bố cục lẫn vận hành. Thao tác đồng bộ
lại dữ liệu vận hành không tải lại hoặc đặt lại hình học.

Cây route React Router hiện có chạy bằng data router để `useBlocker` tích hợp
sẵn bảo vệ liên kết, điều hướng thanh bên và Quay lại/Tiến tới. Khi còn thay đổi
chưa lưu, điều hướng và thao tác hủy dùng hộp xác nhận gốc của trình duyệt theo
mẫu hiện có. Sự kiện before-unload bảo vệ thay đổi chưa lưu/đang lưu. Điều hướng
chờ yêu cầu lưu đang chạy hoàn tất. Không thêm hệ thống định tuyến toàn cục tự viết.

## Giao diện thích ứng và phạm vi

Vùng sơ đồ dùng HTML/CSS thích ứng với hình học tính theo phần trăm. Kéo và đổi
kích thước trên máy tính dùng Pointer Events; đã kiểm tra hủy thao tác cảm ứng
và nhập số trên di động. Ở chiều rộng 320 px, các nút tự xuống dòng, thanh bên
ẩn và trang không tràn ngang. Tên trên thẻ nhỏ có thể bị rút gọn; chọn đối tượng
sẽ hiển thị thẻ thông tin vận hành đầy đủ bên dưới sơ đồ. Các vị trí do người
dùng đặt chồng hoặc quá sát nhau có thể chồng lấn khi hiển thị; chưa có cơ chế
tự động xử lý va chạm.

Tái sử dụng nguyên hạ tầng thời gian thực hiện có, `RealtimeLifecycle`, bộ điều
phối, STOMP client và `twinSlice`. Sự kiện cảm biến, thiết bị và sức khỏe tiếp
tục cập nhật khi chỉnh sửa mà không đổi hình học. Không thêm kết nối thời gian
thực thứ hai cho ứng dụng, gọi API định kỳ, sự kiện bố cục thời gian thực, thư
viện phụ thuộc mới, xóa dữ liệu nghiệp vụ, đổi phòng nghiệp vụ, tự tạo mặt bằng,
thông báo hoặc 3D. WebSocket gỡ lỗi Chrome trong bộ kiểm thử là công cụ kiểm
thử, không phải kết nối thời gian thực của ứng dụng.

## Danh sách tệp

Tệp tạo mới:

- `src/types/twinLayout.ts`
- `src/services/twinLayoutApi.ts`
- `src/store/twinLayoutSlice.ts`
- `src/components/twin/layoutGeometry.ts`
- `src/components/twin/TwinCanvas.tsx`
- `src/components/twin/TwinLayoutButton.tsx`
- `src/components/twin/TwinLayoutEditor.tsx`
- `src/components/twin/TwinLayoutInspector.tsx`
- `src/components/twin/TwinUnplacedPanel.tsx`
- `src/components/twin/useLayoutNavigationGuard.ts`
- `tests/twinLayout.test.mjs`, `tests/twinLayout.browser.mjs`
- `tests/twin-layout-preview.html`, `tests/twin-layout-preview.tsx`
- `tests/fixtures/twin-layout/twin-layout-{empty,saved,put}.json` (ví dụ backend)
- Tài liệu này và ảnh/kết quả trình duyệt trong `docs/evidence/twin-layout/`.

Tệp đã sửa:

- `.gitignore`: bỏ qua hồ sơ Chrome tạo khi kiểm thử trong `.tmp/`.
- `package.json`: đưa kiểm thử hợp đồng dữ liệu/trạng thái/hiển thị bố cục vào `npm test`.
- `src/App.tsx`: dùng data router tích hợp để chặn điều hướng khi cần.
- `src/components/twin/DigitalTwinPage.tsx`: tải bố cục/quyền, hiển thị trình chỉnh
  sửa và giữ phần thông tin vận hành cùng nút đồng bộ lại hiện có.
- `src/index.css`: kích thước vùng sơ đồ/thẻ thích ứng, dùng token màu hiện có.
- `src/services/apiClient.ts`: giữ mã HTTP/mã backend trong lớp con `ApiError`
  thông thường; giữ hành vi thông báo và xử lý hết phiên hiện có.
- `src/store/store.ts`: đăng ký reducer bố cục.
- `tests/routing.test.mjs`, `tests/twin-preview.tsx`: sử dụng ngữ cảnh data router,
  giữ các kiểm tra định tuyến/dữ liệu vận hành hiện có.

## Kiểm chứng tự động

`npm test` có 74 kiểm thử đạt, bao gồm 23 kiểm thử bố cục mới. Phạm vi gồm:
các ví dụ backend chính xác; GET bố cục rỗng/đã lưu; phiên bản và PUT đầy đủ;
header xác thực; vị trí/kích thước phòng; giới hạn tọa độ và tạo dữ liệu chuẩn
hóa; tách bản nháp/trạng thái đã xác nhận; cờ thay đổi chưa lưu/hủy; tính danh
sách chưa đặt; ID chính xác theo loại; thả vào phòng hiển thị; hiển thị cảm
biến/thiết bị/sức khỏe ở chế độ xem và sửa; hủy/lưu sau cập nhật thời gian thực;
đồng bộ lại dữ liệu vận hành; HTTP 403/409/500; thử lại; quyền MEMBER; phản hồi
GET/PUT/quyền của nhà A đến muộn và dọn dẹp khi đăng xuất.

Kết quả kiểm tra cuối: `npm test` đạt 74/74, `npm run lint` đạt,
`npm run build` đạt với TypeScript và Vite, `git diff --check` đạt.

Kiểm tra trình duyệt chạy trang React thật và thao tác đầu vào gốc của Chromium,
sử dụng bộ điều hợp Axios chỉ dành cho phát triển với dữ liệu mẫu đúng cấu trúc
backend. Lưu bằng localStorage chỉ áp dụng cho dữ liệu mẫu; bố cục của ứng dụng
thật luôn được lưu qua HTTP. Xem từng kiểm tra đạt và tên tệp ảnh tại
[browser-results.json](evidence/twin-layout/browser-results.json).

Chạy trong thư mục `hesta_frontend`:

```powershell
npm test
npm run lint
npm run build
git diff --check
npm run dev -- --host 127.0.0.1 --port 5173
```

Trong cửa sổ dòng lệnh thứ hai:

```powershell
node --experimental-websocket tests/twinLayout.browser.mjs
```

Có thể dùng `TEST_CHROME_PATH` và `TEST_LAYOUT_URL` để ghi đè giá trị mặc định
của kiểm thử. Dự án không có lệnh kiểm tra kiểu dữ liệu riêng; `npm run build`
chạy `tsc -b` trước Vite. Bản dựng thành công nhưng Vite vẫn cảnh báo gói ứng
dụng vượt 500 kB.

Bằng chứng:

- [Chế độ xem trên máy tính](evidence/twin-layout/desktop-view.png)
- [Chỉnh sửa và cập nhật thời gian thực trên máy tính](evidence/twin-layout/desktop-edit-realtime.png)
- [Xung đột phiên bản](evidence/twin-layout/desktop-conflict.png)
- [Chế độ xem của thành viên ở 320 px](evidence/twin-layout/mobile-view.png)
- [Chỉnh sửa và nhập số ở 320 px](evidence/twin-layout/mobile-edit.png)

## Hướng dẫn demo đầu cuối thủ công với backend thật

Phần dưới là hướng dẫn demo tích hợp, chưa được thực hiện trong công việc này.
Bằng chứng trình duyệt ở trên dùng dữ liệu mẫu. Sử dụng tài khoản OWNER/MEMBER
và phòng/thiết bị nghiệp vụ đã tồn tại; trình chỉnh sửa không tạo các đối tượng đó.

1. Áp dụng migration backend đã hoàn thành
   `20260917102640_create_twin_layout.sql` theo quy trình migration cục bộ hiện
   có của backend. Khởi động backend bằng cấu hình cục bộ thông thường. Để gửi
   dữ liệu cảm biến, bật profile `mock-sensors` hiện có và
   `APP_MOCK_SENSORS_ENABLED=true` trong môi trường không phải production.
   Sau khi cấu hình cơ sở dữ liệu, chạy trong cửa sổ dòng lệnh tại `backend_hesta`:

   ```powershell
   $env:APP_MOCK_SENSORS_ENABLED = 'true'
   mvn.cmd spring-boot:run '-Dspring-boot.run.profiles=mock-sensors'
   ```
2. Đặt `VITE_API_BASE_URL` của frontend thành URL `/api/v1` của backend bằng
   cấu hình môi trường hiện có. Chạy `npm run dev` trong `hesta_frontend`.
3. Đăng nhập bằng tài khoản OWNER có trạng thái thành viên ACTIVE. Chọn nhà đã
   có hai phòng, ít nhất một thiết bị và một luồng cảm biến. Mở
   `/home/{homeId}/digital-twin`.
4. Mở mục “Dữ liệu trực tiếp” để xem snapshot vận hành hiện tại. Kiểm tra trạng
   thái kết nối và yêu cầu GET bố cục riêng trong thẻ Network của trình duyệt.
5. Với nhà chưa lưu hình học, kiểm tra phiên bản 0 và thông báo “Chưa có sơ đồ”.
   Bấm “Chỉnh sửa sơ đồ”, đặt hai phòng từ bảng đối tượng chưa đặt.
6. Kéo một phòng và đổi kích thước bằng tay nắm ↘. Chọn phòng và kiểm tra các
   ô phần trăm. Đặt một thiết bị và một cảm biến. Di chuyển cảm biến sang phòng
   hiển thị khác, rồi ra ngoài tất cả phòng để kiểm chứng ID phòng bằng null.
7. Kiểm tra việc chỉnh sửa không phát sinh yêu cầu HTTP. Bấm “Lưu bố cục”. Xác
   nhận có một PUT chứa toàn bộ hình học đã đặt, đúng ID cảm biến và
   `expectedRevision: 0`. Đối chiếu phiên bản phản hồi với giá trị trên thanh công cụ.
8. Tải lại trình duyệt: hình học đã lưu phải còn nguyên. Chỉ dừng/khởi động lại
   máy chủ phát triển frontend bằng `npm run dev`, mở lại route và xác nhận
   phiên bản cùng hình học từ backend vẫn được giữ.
9. Dùng endpoint giả lập hiện có để gửi giá trị đo cho đúng thiết bị và loại
   chỉ số của cảm biến đã đặt. Sau khi gán token hợp lệ, địa chỉ gốc API, ID
   thiết bị và chỉ số vào các biến tương ứng, chạy:

   ```powershell
   $reading = @{ deviceId = $deviceId; metricType = $metricType; value = 29.4;
     unit = '°C'; observedAt = [DateTimeOffset]::UtcNow.ToString("yyyy-MM-dd'T'HH:mm:ss.ffffff'Z'") } | ConvertTo-Json
   Invoke-RestMethod -Method Post -Uri "$apiBase/dev/sensors/mock-reading" -Headers @{ Authorization = "Bearer $token" } -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($reading))
   ```

   Gửi lại với `value = 30.0` và mốc thời gian mới. Kiểm tra giá trị cảm biến
   thay đổi nhưng hình học giữ nguyên. Không đưa token vào tài liệu hoặc ảnh chụp.
10. Với ngưỡng mặc định của backend, ngừng gửi giá trị đo và quan sát ACTIVE →
    STALE sau 1 phút → OFFLINE sau 5 phút, tùy lượt đánh giá theo chu kỳ 15 giây
    hiện có. Hình học phải giữ nguyên. Gửi giá trị đo mới và kiểm tra trạng thái
    trở lại ACTIVE ở cùng vị trí. Không thêm cơ chế gọi API định kỳ ở frontend.
11. Vào chế độ chỉnh sửa, di chuyển phòng/đối tượng, sau đó gửi giá trị cảm biến
    mới và kích hoạt nguồn sự kiện trạng thái thiết bị hiện có. Kiểm tra dữ
    liệu vận hành cập nhật trong khi vị trí bản nháp không đổi. Hủy, xác nhận
    bỏ bản nháp, rồi kiểm tra hình học đã lưu được khôi phục và giá trị vận
    hành mới nhất vẫn còn.
12. Chỉnh sửa lần nữa và lưu sau một cập nhật thời gian thực. Kiểm tra PUT chỉ
    chứa hình học cùng `expectedRevision` hiện tại; giá trị đo đang hiển thị
    vẫn được giữ.
13. Đổi nhà khi có thay đổi chưa lưu: lần đầu từ chối, lần sau chấp nhận xác
    nhận. Kiểm tra nhà mới chỉ hiển thị snapshot và bố cục của chính nó. Thử
    Quay lại/Tiến tới trên trình duyệt.
14. Đăng nhập phiên khác bằng tài khoản MEMBER có trạng thái ACTIVE trong cùng
    nhà. Kiểm tra bố cục đã lưu/dữ liệu vận hành vẫn hiển thị và không có nút
    “Chỉnh sửa sơ đồ”.
15. Kiểm tra xung đột bằng hai phiên OWNER cùng phiên bản. Lưu một thay đổi ở
    phiên thứ nhất, sau đó lưu ở phiên thứ hai. Phiên thứ hai phải giữ bản
    nháp và giải thích xung đột. Chọn “Tải sơ đồ mới nhất”, xác nhận thay thế
    và kiểm tra hình học/phiên bản đã lưu của phiên thứ nhất xuất hiện.
16. Ở 320 px, chọn đối tượng, đọc thẻ chi tiết đầy đủ và chỉnh vị trí bằng các
    ô phần trăm có nhãn. Lưu/Hủy phải thao tác được bằng bàn phím và không gây
    cuộn ngang toàn trang.

Giới hạn đã biết: chưa có luồng cập nhật bố cục cộng tác hoặc tự động gộp thay
đổi; phiên khác chỉ thấy hình học mới khi chủ động tải lại. Xóa đối tượng
nghiệp vụ có thể khiến vị trí thiếu dữ liệu vận hành cho đến khi đồng bộ/tải
lại; giao diện đánh dấu đối tượng không còn dữ liệu và backend vẫn kiểm tra
cuối cùng. Tên trên di động được rút gọn, thông tin đầy đủ hiện ra khi chọn.
Việc lưu dữ liệu và thời gian chuyển trạng thái sức khỏe trên backend thật
cần được demo theo các bước trên; bằng chứng trình duyệt có thể chạy lại của
công việc này dùng bộ điều hợp dữ liệu mẫu độc lập.

## Cập nhật theo ảnh tham chiếu ngày 18/09/2026

Trình chỉnh sửa được bố trí theo ảnh đã cung cấp: nút Xem/Chỉnh sửa, Lưu/Hủy,
bốn ô hướng dẫn thao tác, mặt bằng có lưới với màu riêng cho từng loại phòng
và nội thất minh họa nhìn từ trên xuống, la bàn, thu phóng/vừa màn hình, bảng
đối tượng chưa đặt có tìm kiếm và chia nhóm phòng/thiết bị/cảm biến, cùng bảng
chi tiết đối tượng đang chọn. Tên phòng tiếng Việt được nhận diện nội thất và
biểu tượng tương tự tên tiếng Anh. Giữ bảng màu sáng và điều hướng HESTA hiện có.

- Mức thu phóng từ 50% đến 200%; “Vừa màn hình” đặt lại 100%. Thu phóng chỉ đổi
  khung nhìn, không đổi tọa độ đã lưu. Phần tràn được cuộn bên trong vùng sơ đồ.
- Có thể kéo đối tượng hiện có từ bảng vào sơ đồ. Khi thả, chương trình kiểm
  tra ID theo dữ liệu Twin hiện tại và ngăn đặt trùng. Bấm đối tượng rồi chỉnh
  các ô số có nhãn là cách thay thế khi dùng bàn phím hoặc cảm ứng.
- Tìm kiếm lọc nhóm đang chọn và có trạng thái không tìm thấy kết quả.
- Công cụ bỏ vị trí chỉ loại vị trí hiển thị đang chọn; dữ liệu nghiệp vụ vẫn
  còn và đối tượng xuất hiện lại trong bảng chưa đặt. Bỏ phòng sẽ xóa các ID
  phòng hiển thị liên quan.
- Diện tích phòng được biểu diễn bằng phần trăm vùng sơ đồ chuẩn hóa. API chưa
  có kích thước thực của mặt bằng nên trình chỉnh sửa không tự tạo số mét vuông.
- Ô tên chỉ đọc: PUT bố cục nhận hình học, không nhận tên phòng/thiết bị. Lưu
  bố cục không đổi tên đối tượng nghiệp vụ.
- La bàn biểu thị hướng lên của sơ đồ; hệ thống không lưu hướng địa lý.
  Nội thất chỉ để minh họa, không phải thiết bị điều khiển bổ sung.

### Kiểm tra khả năng hỗ trợ nhiều tầng

Mã nguồn hiện hỗ trợ **một bố cục 2D cho mỗi nhà**, chưa có tầng 1/2/3 hoặc từ
tầng 1 đến tầng 23. Bằng chứng:

- `backend_hesta/supabase/migrations/20260917102640_create_twin_layout.sql` đặt
  ràng buộc UNIQUE cho `twin_layouts.home_id`; phòng/đối tượng chỉ lưu hình học x/y.
- `Room.java` có home, name, layoutX/layoutY, icon; không có quan hệ với tầng.
- `TwinLayoutResponse` và `TwinLayout` ở frontend chứa homeId/revision/rooms/nodes,
  không có floorId hoặc số tầng. Trình chỉnh sửa cũng không có bộ chọn tầng.
- digitalTwinZ của thiết bị là tọa độ riêng có từ trước, không được hợp đồng
  bố cục này sử dụng; trường đó không chứng minh hệ thống hỗ trợ nhiều tầng.

Kết quả này dựa trên mã nguồn/lược đồ hiện tại, không phải truy vấn cơ sở dữ
liệu đã triển khai. Để thêm tầng cần thực thể/ID tầng, gán phòng vào tầng,
migration, quy tắc bố cục theo tầng, thay đổi API và bộ chọn tầng. Trong công
việc dựng giao diện theo ảnh này không thêm các tab tầng giả.

### Kiểm chứng hiện tại và đối chiếu giao diện

`npm test` đạt 74/74; `npm run lint` và `npm run build` đều đạt. Bản dựng vẫn
có cảnh báo gói ứng dụng lớn hơn 500 kB như trước.
Kiểm tra trình duyệt dùng phản hồi API mẫu độc lập, bao gồm kéo/đổi kích thước
bằng con trỏ thật, thả từ bảng khi thu phóng 125%, tìm kiếm/không có kết quả,
thu phóng/vừa màn hình, lưu/tải lại, hủy, phục hồi lỗi 403/409, cập nhật thời
gian thực trong lúc kéo, quyền OWNER/MEMBER, Quay lại/Tiến tới và kiểm tra
tràn ngang/cảm ứng/nhập số ở chiều rộng 320 px.

Trang đối chiếu bốn phòng chỉ dành cho phát triển, không thay đổi nhà thật:
`/tests/twin-layout-preview.html?reference=1`.
Xem [ảnh đối chiếu bốn phòng](evidence/twin-layout/reference-four-rooms.png) và
[kết quả kiểm tra trình duyệt](evidence/twin-layout/browser-results.json).
Thư mục hồ sơ trình duyệt `.tmp` được loại khỏi ESLint và theo dõi thay đổi của
Vite để các tệp tiện ích Chrome không làm tải lại ứng dụng hoặc bị kiểm tra như
mã nguồn dự án. Mã ứng dụng vẫn được kiểm tra lint bình thường.
