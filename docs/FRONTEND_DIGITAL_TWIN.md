# Digital Twin tối thiểu với cập nhật thời gian thực

Route yêu cầu đăng nhập `/home/:homeId/digital-twin` hiển thị bản chụp trạng thái
(snapshot) từ backend theo cấu trúc Nhà → Phòng → Thiết bị / Cảm biến và cập nhật
từng đối tượng theo thời gian thực. Người dùng mở trang từ thẻ Digital Twin trên
trang Home. Trang sử dụng cơ chế bảo vệ route hiện có cho phiên OWNER và MEMBER;
backend quyết định quyền truy cập. Nếu mở liên kết Twin khi chưa đăng nhập,
Mục **Digital Twin** luôn nằm trong thanh điều hướng bên trái của trang Tổng quan,
Thiết bị và Digital Twin khi hiển thị giao diện máy tính. Nếu chưa chọn nhà, mục
vẫn hiện và hướng dẫn người dùng tạo hoặc tham gia nhà. Người dùng mở liên kết
Twin khi chưa đăng nhập được đưa trở lại trang đó sau khi đăng nhập, đồng thời vẫn giữ thứ tự
ưu tiên xử lý lời mời tham gia nhà.

## Hợp đồng dữ liệu và nguồn trạng thái chính thức

`src/types/twin.ts` khớp với các kiểu `TwinHomeSnapshotResponse`,
`TwinRoomSnapshotResponse`, `TwinDeviceSnapshotResponse`,
`TwinSensorSnapshotResponse` và `TwinHealthStatusChangedPayload` của backend.
Các trường phòng, biểu tượng, đơn vị và thời gian cho phép null vẫn giữ nguyên
khả năng này. `currentState` lưu đầy đủ giá trị JSON lồng nhau trong Redux;
thẻ chỉ hiển thị phần tóm tắt ngắn gọn, dễ đọc. Định danh cảm biến sử dụng nguyên
vẹn `sensorId` do backend cung cấp, kể cả chữ hoa/chữ thường của loại chỉ số.

Chọn kiến trúc A: `twinSlice` là nguồn trạng thái chuẩn hóa chính thức cho
snapshot Twin. Dữ liệu quản lý Nhà/Thiết bị/Phòng hiện có được giữ cục bộ theo
route; không có slice thiết bị dùng chung để bị nhân đôi. Trang Twin không sao
chép các danh sách cục bộ hay trạng thái điều khiển cập nhật trước phản hồi
backend của chúng. Trạng thái Twin được xóa khi rời route, đổi nhà hoặc đăng
xuất, tránh việc hai màn hình giữ hai nguồn dữ liệu thiết bị đang hoạt động có
thể mâu thuẫn. Phiên đăng nhập và ID nhà đang chọn vẫn thuộc các slice auth/home
hiện có.

```ts
interface TwinState {
  homeId: string | null;
  home: { homeId: string; name: string } | null;
  roomIds: string[];
  roomsById: Record<string, TwinRoom>; // thông tin phòng + deviceIds/sensorIds
  deviceIds: string[];
  devicesById: Record<string, TwinDeviceSnapshotResponse>;
  sensorIds: string[];
  sensorsById: Record<string, TwinSensorSnapshotResponse>;
  unassignedDeviceIds: string[];
  unassignedSensorIds: string[];
  loading: boolean;
  error: string | null;
  initialized: boolean;
  requestId: string | null;
  pendingEvents: TwinEvent[]; // chỉ giữ khi yêu cầu REST đang chờ phản hồi
  healthUpdates: Record<string, TwinHealthStatusChangedPayload>;
}
```

`getTwinSnapshot` sử dụng Axios client có xác thực hiện tại và endpoint
`GET /api/v1/homes/{homeId}/twin`, yêu cầu mã phản hồi `1000` và ID nhà khớp với
yêu cầu. `normalizeTwinSnapshot` duyệt cây dữ liệu lồng nhau một lần. Mỗi thẻ
chọn riêng đối tượng cần hiển thị; tham chiếu của các đối tượng và tập hợp không
thay đổi được giữ nguyên. Đối tượng thuộc phòng chưa có trong snapshot được
hiển thị ở khu vực chưa gán phòng, đồng thời giữ nguyên `roomId` thực tế để đồng
bộ lại khi người dùng yêu cầu; không tạo phòng giả.

## Ánh xạ sự kiện thời gian thực và thứ tự cập nhật

`RealtimeLifecycle` hiện có đã phát action `realtimeEventReceived` trước khi
chuyển sự kiện đến bộ điều phối dùng chung. Twin slice xử lý chính action đó qua
`extraReducers`, không cần thêm lifecycle, đăng ký sự kiện hoặc client riêng.
`twinEvents.ts` kiểm tra dữ liệu đối tượng trong sự kiện. Thay đổi duy nhất ở
phần nhận sự kiện là bổ sung nhận diện tên `TWIN_HEALTH_STATUS_CHANGED` đã có ở
backend.

| Sự kiện | Thay đổi trạng thái | Quy tắc thứ tự |
| --- | --- | --- |
| DEVICE_STATE_CHANGED | Thay thế đầy đủ một thiết bị; chỉ chuyển thiết bị đó giữa phòng/khu vực chưa gán khi cần | Bỏ qua lastSeen cũ hơn; chấp nhận lastSeen bằng nhau vì lệnh cập nhật trạng thái ở backend không làm tăng trường này |
| SENSOR_READING_UPDATED | Cập nhật hoặc thêm đúng data.sensorId; chỉ thêm/chuyển cảm biến đó giữa các khu vực | Bỏ qua observedAt cũ hơn, giữ độ chính xác nhỏ hơn mili giây và so sánh đúng độ lệch múi giờ UTC |
| TWIN_HEALTH_STATUS_CHANGED | Chỉ cập nhật healthStatus của đối tượng đích | Bỏ qua referenceTime cũ hơn hoạt động đang hiển thị và evaluatedAt cũ hơn sự kiện sức khỏe đã được chấp nhận |

Cập nhật cảm biến không làm mới thiết bị cha hoặc các chỉ số khác. Sự kiện sức
khỏe không thay đổi `status`, `currentState`, giá trị đo, phòng được gán hoặc
mốc thời gian. Bảng lưu cập nhật sức khỏe ngăn dữ liệu đầy đủ đến chậm ghi đè
kết quả đánh giá sức khỏe mới hơn, chỉ dựa trên các mốc thời gian được cung cấp.
Không tự tạo số thứ tự hay cam kết về thứ tự truyền tin. Các lần đo cùng thời
điểm vẫn được xử lý theo thứ tự nhận vì hợp đồng này không chứa ID mà backend
dùng để phân định bản ghi cùng thời điểm trong cơ sở dữ liệu.

Đổi nhà sẽ xóa ngay trạng thái Twin đang xem. Khi render, trang cũng kiểm tra
ID nhà trên route trước khi hiển thị dữ liệu, kể cả lượt render trước khi effect
chạy. Mỗi yêu cầu mang cả ID nhà và ID yêu cầu: phản hồi đến muộn bị bỏ qua ngay
cả khi chuyển A → B → A. Hàm dọn dẹp hủy yêu cầu đang chạy. Sự kiện nhận trong
lúc tải snapshot được lưu tạm rồi áp dụng vào snapshot đã chuẩn hóa, tránh ghi
đè do phản hồi đến không đúng thứ tự. Sự kiện sai nhà hoặc sai định dạng không
làm thay đổi trạng thái Twin.

Khi mất kết nối, trang giữ snapshot gần nhất và hiển thị trạng thái kết nối/đăng
ký nhận sự kiện từ hạ tầng dùng chung. Cơ chế kết nối lại STOMP hiện có khôi phục
đăng ký nhận sự kiện của nhà. Ứng dụng chưa có chính sách tự tải lại snapshot,
nên nút **Đồng bộ lại** cho phép tải snapshot mới khi bỏ lỡ sự kiện. Không thêm
vòng lặp kết nối lại hoặc cơ chế gọi API cảm biến định kỳ (polling). Yêu cầu HTTP
ban đầu có thể hoàn tất trước khi đăng ký WebSocket; những cập nhật bị bỏ lỡ
trước khi đăng ký hoặc khi mất kết nối cần được đồng bộ lại bằng thao tác này.

## Giao diện và khả năng truy cập

Giao diện tái sử dụng các token thiết kế sáng của HESTA và `AppSidebar`. Thẻ
thiết bị hiển thị loại, trạng thái hoạt động, tóm tắt trạng thái hiện tại,
`lastSeen` và sức khỏe riêng biệt. Thẻ cảm biến hiển thị đúng tên chỉ số, giá
trị/đơn vị, `observedAt` và sức khỏe. ACTIVE, STALE và OFFLINE có nền/viền nhạt
khác nhau kèm nhãn chữ rõ ràng. Frontend không tự tính các ngưỡng độ mới do
backend quản lý.

Giao diện xử lý trạng thái tải ban đầu, lỗi an toàn kèm thử lại, đang đồng bộ lại,
phòng trống, danh sách thiết bị/cảm biến trống, đối tượng chưa gán phòng, thời
gian/đơn vị null và trạng thái mất kết nối/đang kết nối lại. Giá trị cảm biến dùng
vùng thông báo hỗ trợ trình đọc màn hình với `aria-live="polite"`. Ngày giờ được
định dạng bằng `Intl` theo tiếng Việt, còn mốc thời gian chính xác nằm trong
`<time>`. Có điều hướng trên máy tính và liên kết trên thiết bị di động. Thanh
bên của Twin ẩn phần thông báo sức khỏe hệ thống tĩnh hiện có; trạng thái kết
nối thực tế được hiển thị ở đầu trang.

## Kiểm chứng và tái hiện ảnh chụp giao diện

Chạy trong thư mục `hesta_frontend`:

```powershell
npm test
npm run lint
npm run build
git diff --check
npm run dev -- --host 127.0.0.1 --port 5174
```

Mở `http://127.0.0.1:5174/tests/twin-preview.html` để dùng trang kiểm thử với dữ
liệu mẫu (fixture), chỉ phục vụ phát triển. Trang này sử dụng component/store
thật trong StrictMode, dùng bản sao các JSON mẫu của backend và chỉ thay thế
HTTP trong điểm vào kiểm thử đó. Trang không được đưa vào bản build production,
không xác thực người dùng thật và không ghi dữ liệu lên backend. Các nút điều
khiển dữ liệu mẫu có nhãn phân biệt rõ ràng.

1. Bấm **Count REST requests** sau khi tải ban đầu: trình duyệt hoàn tất một yêu cầu.
2. Bấm **Sensor → 30** và **Device → OFF**: giá trị đổi ngay; số yêu cầu REST vẫn là một.
3. Bấm **STALE**, **OFFLINE**, **ACTIVE** để kiểm tra thay đổi sức khỏe.
4. Bấm **Disconnect/Reconnect**: các đối tượng đang hiển thị được giữ lại, không tải lại snapshot.
5. Chuyển **Home A/B**; thử Quay lại/Tiến tới và tải lại trang trên trình duyệt. Home B là nhà trống.
6. Bấm **Toggle API error**, đổi nhà, sau đó tắt lỗi và bấm **Thử lại**.
7. Kiểm tra chiều rộng 1440 px và 320 px; dùng phím Tab/Enter để thao tác các nút.

Kiểm thử tự động dùng bộ công cụ hiện có gồm Node test, bộ nạp TypeScript và
React render phía máy chủ, kiểm tra giá trị và việc giữ nguyên tham chiếu của
các đối tượng không liên quan. Các kiểm thử không chỉ so sánh snapshot giao
diện. Chúng còn chạy STOMP client dùng chung thật với lớp truyền tin giả lập,
đưa khung JSON vào action Redux hiện có rồi kiểm tra giao diện render, đồng
thời xác nhận chỉ có đúng một yêu cầu snapshot ban đầu. Kiểm tra tương tác trên
trình duyệt bổ sung việc kiểm chứng component đã gắn vào trang, effect và đăng
ký theo dõi trạng thái.

Ảnh minh chứng đã chụp bằng dữ liệu mẫu, không phải bản ghi từ backend đang chạy:

- [Giao diện máy tính](evidence/twin-desktop.png)
- [Giao diện di động 320 px](evidence/twin-mobile-320.png)
- [Thẻ cảm biến trên di động](evidence/twin-mobile-sensors.png)

## Hướng dẫn demo thời gian thực với backend

Sử dụng backend chạy cục bộ với nguồn dữ liệu cục bộ đã cấu hình, đăng nhập theo
luồng bình thường, tài khoản là thành viên đang hoạt động của nhà và có thiết bị
thực sự tồn tại trong nhà đó. Không sao chép UUID mẫu nếu cơ sở dữ liệu cục bộ
không có các bản ghi tương ứng. Xem điều kiện chuẩn bị trong
`docs/MOCK_SENSOR_PIPELINE.md` và `docs/TWIN_HEALTH.md` của backend.

Trong terminal backend, cấu hình các biến môi trường kết nối cơ sở dữ liệu
trước, sau đó bật bộ tiếp nhận dữ liệu giả lập hiện có và rút ngắn các khoảng
thời gian sức khỏe để demo trong môi trường phát triển:

```powershell
$env:SPRING_PROFILES_ACTIVE = 'mock-sensors'
$env:APP_MOCK_SENSORS_ENABLED = 'true'
$env:APP_TWIN_HEALTH_STALEAFTER = '10s'
$env:APP_TWIN_HEALTH_OFFLINEAFTER = '25s'
$env:APP_TWIN_HEALTH_EVALUATIONINTERVAL = '2s'
$env:APP_TWIN_HEALTH_SCHEDULINGENABLED = 'true'
mvn.cmd spring-boot:run
```

Không cần sửa tệp backend. Không bật profile prod/production cho demo này. Các
giá trị thời gian ghi đè chỉ áp dụng cho tiến trình backend dùng để demo;
frontend không chứa các ngưỡng này.

Khởi động frontend bằng `npm run dev`, sử dụng cấu hình `VITE_API_BASE_URL`
hiện có; repository này chưa cấu hình proxy API cho Vite. Nếu backend chạy ở địa
chỉ cục bộ riêng, đặt biến này thành địa chỉ gốc API, bao gồm `/api/v1`, trước
khi khởi động Vite. Đăng nhập bình thường, chọn nhà hợp lệ và mở Digital Twin.
Chờ snapshot ban đầu tải xong và trạng thái **Realtime: Đã kết nối**.

Trong terminal PowerShell khác, đặt `HESTA_DEMO_API_URL` thành địa chỉ gốc API
backend cục bộ (bao gồm `/api/v1`), `HESTA_DEMO_DEVICE_ID` thành ID thiết bị của
nhà đó và `HESTA_DEMO_ACCESS_TOKEN` thành token lấy từ luồng đăng nhập bình
thường. Không để token xuất hiện trong bản ghi. Gửi một lần đo mới hơn lần đo
hiện tại của luồng cảm biến:

```powershell
$headers = @{ Authorization = "Bearer $env:HESTA_DEMO_ACCESS_TOKEN" }
$body = @{
  deviceId = $env:HESTA_DEMO_DEVICE_ID
  metricType = 'TEMPERATURE'
  value = 29.4
  unit = '°C'
  observedAt = [DateTimeOffset]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ss.ffffffzzz')
}
$endpoint = "$($env:HESTA_DEMO_API_URL.TrimEnd('/'))/dev/sensors/mock-reading"
Invoke-RestMethod -Method Post -Uri $endpoint -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json)))
# Sau khi thấy giá trị 29.4, gửi lần đo tiếp theo với thời điểm mới hơn.
$body.value = 30.0
$body.observedAt = [DateTimeOffset]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ss.ffffffzzz')
Invoke-RestMethod -Method Post -Uri $endpoint -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json)))
```

Ghi lại thay đổi 29.4 → 30 (số JSON 30.0 hiển thị thành 30) mà không tải lại trang.
Trong thẻ Network của trình duyệt, mở phần WS Messages và các yêu cầu fetch/XHR:
STOMP MESSAGE phải chứa SENSOR_READING_UPDATED cho đúng luồng cảm biến, đồng
thời không xuất hiện thêm yêu cầu `/homes/{homeId}/twin`. Không để header
Authorization của STOMP CONNECT xuất hiện trong bản ghi.

Ngừng gửi dữ liệu đo. Ghi lại các chuyển trạng thái ACTIVE → STALE → OFFLINE do
backend phát sau các khoảng thời gian demo và lượt chạy bộ lập lịch. Gửi một
lần đo mới với `observedAt` mới hơn; ghi lại OFFLINE → ACTIVE mà không tải lại
trang. Sức khỏe/trạng thái của chính thiết bị có thể chưa phục hồi vì quá trình
nhận dữ liệu cảm biến không cập nhật `lastSeen` của thiết bị. Có thể chạy thêm
lệnh cập nhật trạng thái thiết bị hiện có và ghi lại DEVICE_STATE_CHANGED cùng
thay đổi trên thẻ thiết bị.

Các ảnh cần chụp gồm: (1) Nhà/Phòng lúc tải ban đầu, (2) giá trị cảm biến sau khi
thay đổi, (3) từng nhãn sức khỏe và (4) bằng chứng Network cho thấy số yêu cầu
Twin không tăng. Nên quay một video liên tục để chứng minh rõ việc không tải
lại trang. Kiểm thử tích hợp dùng Clock điều khiển được ở backend có thể tái
hiện riêng chuỗi trạng thái sức khỏe theo `docs/TWIN_HEALTH.md`; đây không phải
bản ghi giao diện frontend. Trong lần triển khai frontend này chưa chạy demo
với backend thật có xác thực; quy trình trên là hướng dẫn bàn giao để thực hiện
trong môi trường đó.

## Giới hạn và hướng phát triển tiếp theo

- STOMP không bảo đảm phát lại bền vững các sự kiện đã bỏ lỡ; người dùng cần chủ
  động đồng bộ lại. Không thể xác định thứ tự toàn cục cho các sự kiện cùng mốc
  thời gian chỉ từ dữ liệu được cung cấp.
- Frontend chưa xử lý sự kiện thay đổi cấu trúc khi tạo/xóa phòng hoặc xóa thiết
  bị; dùng nút đồng bộ lại để cập nhật các thay đổi này.
- Phần tóm tắt trạng thái hiển thị tối đa sáu trường cấp đầu và giới hạn độ sâu
  lồng nhau; Redux vẫn giữ đầy đủ trạng thái có kiểu dữ liệu. Không bổ sung chức
  năng điều khiển thiết bị thật.
- Công tắc nguồn cập nhật tạm trên trang quản lý thiết bị hiện có vẫn chỉ tác
  động đến trạng thái cục bộ của trang đó.
- Không bổ sung Twin Layout, tọa độ, kéo/thả, sơ đồ mặt bằng, Save Layout hoặc
  3D. Trình chỉnh sửa bố cục trong tương lai nên kết hợp mô hình bố cục riêng với
  các đối tượng có roomId/deviceId/sensorId ổn định và các trường
  healthStatus/currentState từ backend.

## Nội dung tóm tắt cho pull request

Thêm trang Digital Twin tối thiểu yêu cầu đăng nhập, sử dụng snapshot chuẩn hóa
trong Redux. Sự kiện STOMP dùng chung hiện có cập nhật riêng từng thiết bị,
luồng cảm biến và nhãn sức khỏe mà không tải lại Nhà. Kiểm tra ID nhà/yêu cầu,
lưu tạm sự kiện trong lúc tải, so sánh mốc thời gian và thao tác đồng bộ lại giúp
bảo vệ trạng thái đang hiển thị. Bổ sung dữ liệu mẫu khớp backend, kiểm thử trạng
thái/API/render/truyền tin, trang kiểm thử trên trình duyệt, ảnh giao diện thích
ứng và quy trình demo cảm biến giả lập. Không thay đổi mã backend hoặc hạ tầng
truyền tin.

## Danh sách tệp

Tệp tạo mới:

- `src/types/twin.ts`
- `src/services/twinApi.ts`
- `src/realtime/twinEvents.ts`
- `src/store/twinSlice.ts`, `src/store/twinSelectors.ts`
- `src/components/twin/DigitalTwinPage.tsx`, `TwinContent.tsx`,
  `TwinDeviceCard.tsx`, `TwinSensorCard.tsx`, `TwinHealthBadge.tsx`, `TwinTime.tsx`
- `tests/twin.test.mjs`, `tests/twin-preview.html`, `tests/twin-preview.tsx`
- `tests/fixtures/twin/twin-snapshot.json`, `twin-device-event.json`,
  `twin-sensor-event.json`, `twin-health-event.json`
- Tài liệu này và `docs/evidence/twin-desktop.png`, `twin-mobile-320.png`,
  `twin-mobile-sensors.png`

Tệp đã sửa:

- `src/store/store.ts`: đăng ký Twin reducer.
- `src/realtime/realtimeTypes.ts`: chấp nhận sự kiện sức khỏe hiện có của backend.
- `src/routes/AppRoutes.tsx`: thêm route Twin yêu cầu đăng nhập.
- `src/routes/navigation.ts`: hỗ trợ đường dẫn trở lại Twin an toàn sau đăng nhập.
- `src/components/home/HomePage.tsx`: thêm mục Twin cố định trong thanh điều hướng bên trái.
- `src/components/device/DevicePage.tsx`: thêm mục Twin trong thanh điều hướng bên trái.
- `src/components/ui/AppSidebar.tsx`: cho phép ẩn phần thông tin tĩnh cuối thanh bên trên trang Twin.
- `package.json`: thêm kiểm thử Twin vào lệnh kiểm thử hiện có.
- `tests/routing.test.mjs`: kiểm thử bảo vệ route và truy cập trực tiếp Twin khi đã đăng nhập.

Không thêm thư viện phụ thuộc, không sửa lockfile, mã backend hoặc hợp đồng dữ
liệu backend.

## Kết quả kiểm chứng ghi nhận ngày 17/09/2026

| Hạng mục | Kết quả / bằng chứng |
| --- | --- |
| `npm test` | 51 đạt, 0 lỗi, 0 bỏ qua; thêm 19 kiểm thử so với 32 kiểm thử ban đầu, bao phủ các trường hợp trạng thái được yêu cầu, cập nhật giao diện và tích hợp lớp truyền tin dùng chung |
| `npm run lint` | Đạt, không có cảnh báo/lỗi |
| `npm run build` | Đạt: `tsc -b` và bản build production bằng Vite, 140 mô-đun |
| `git diff --check` | Đạt |
| Backend không thay đổi | Đối chiếu SHA-256 của mọi tệp backend được Git theo dõi hoặc chưa được theo dõi nhưng không bị bỏ qua với bản ghi trước khi làm việc đều khớp; giữ nguyên các thay đổi backend có sẵn |
| Dữ liệu mẫu đồng bộ | Cả bốn tệp JSON sao chép giống từng byte với ví dụ backend hiện tại |
| Một hạ tầng truyền tin / không polling | Rà soát mã nguồn chỉ thấy `new Client` hiện có trong `realtimeClient.ts`; Twin không có socket riêng, vòng lặp định kỳ hoặc gọi API theo bộ hẹn giờ |
| Cập nhật từng đối tượng | Kiểm thử xác nhận giữ nguyên tham chiếu của đối tượng/phòng khác và tổng số yêu cầu GET vẫn là một sau sự kiện cảm biến, sự kiện sức khỏe và kết nối lại |
| Hành vi trên trình duyệt | Trang/store thật với dữ liệu mẫu: 26.4 → 30, ON → OFF, STALE → OFFLINE → ACTIVE, không GET theo sự kiện, giữ giá trị khi mất kết nối, thử lại sau lỗi, đổi nhà, tải lại trang và Quay lại/Tiến tới đều đạt |
| Giao diện thích ứng | Đã kiểm tra ở 1440×1000 và 320×844; tại 320 px, scrollWidth của tài liệu = innerWidth = 320 và không có phần tử trong nội dung chính tràn khỏi chiều rộng khung nhìn |
| Giới hạn kiểm chứng | Chưa chạy demo backend thật có xác thực; kiểm thử truyền tin giả lập và ảnh dữ liệu mẫu được ghi rõ; hướng dẫn demo backend thật nằm ở trên |

Phạm vi nghiệm thu: cấu trúc snapshot và các trường bắt buộc được kiểm tra bằng
kiểm thử render ban đầu và giao diện trình duyệt; ánh xạ ba loại sự kiện và tính
độc lập giữa các đối tượng nằm trong `twin.test.mjs`; kiểm thử trạng thái bao phủ
phản hồi đến muộn, sự kiện sai nhà, thứ tự cập nhật, null/chưa gán phòng và sức
khỏe ban đầu. Các trạng thái tải/lỗi/trống/kết nối lại được kiểm tra bằng render
và tương tác trình duyệt; kiểm thử hồi quy route/xác thực nằm trong
`routing.test.mjs`. Tất cả hạng mục chất lượng nêu trên đều đạt. Bố cục/3D và
điều khiển thiết bị tiếp tục nằm ngoài phạm vi MVP này.
