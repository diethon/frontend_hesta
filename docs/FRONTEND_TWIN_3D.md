# Trình xem Digital Twin 3D của HESTA

## Phạm vi và nguồn dữ liệu chính thức

Trình xem 3D là phần hiển thị chỉ thuộc frontend, được tạo từ trạng thái vận hành Twin hiện có trong Redux và phản hồi của Twin Layout API. Trình xem không thêm hoặc lưu tọa độ 3D, chiều cao tường, đồ nội thất, cửa ra vào, cửa sổ, tầng hoặc số đo kiến trúc. Trình chỉnh sửa 2D hiện có vẫn là nơi tạo và sửa bố cục. Trường `floor` bắt đầu từ 1 được lưu qua Twin Layout API; phòng cũ không có trường này được chuẩn hóa thành tầng 1.

Hình tham khảo nhà thông minh không mái đã định hướng góc nhìn đẳng trục, bề mặt phòng trung tính sáng, nhãn nổi, điểm đánh dấu nhỏ gọn, bảng thông tin đối tượng được chọn, nút chuyển 2D/3D và cảnh có nội thất phong phú hơn. Vì HESTA không lưu hình học kiến trúc hoặc nội thất, đồ nội thất, cửa sổ, cửa ra vào, họa tiết sàn, đèn và cảnh quan chỉ là chi tiết hiển thị được tạo theo quy tắc xác định. Chúng được chọn dựa trên tên phòng, không được ghi vào API và không được trình bày như dữ liệu đo đạc của ngôi nhà thực.

## Chuyển đổi tọa độ

`src/components/twin/twin3dGeometry.ts` phụ trách lớp chuyển đổi thuần:

- Tọa độ `x` đã chuẩn hóa từ backend ánh xạ sang trục X trong thế giới Three.js.
- Tọa độ `y` đã chuẩn hóa từ backend ánh xạ sang trục Z trong thế giới Three.js.
- Trục Y của Three.js chỉ biểu diễn độ cao khi hiển thị.
- Thế giới được đặt giữa quanh gốc tọa độ để phục vụ điều khiển xoay góc nhìn.
- `TWIN_WORLD_WIDTH = 18` và `TWIN_WORLD_DEPTH = 12` là các hằng số frontend.
- `TWIN_ROOM_WALL_HEIGHT = 2.25` chỉ phục vụ hiển thị ở frontend.
- ID của nút và ID của phòng được giữ nguyên chính xác.

Về mặt nguyên lý:

```text
worldX = normalizedX * WORLD_WIDTH - WORLD_WIDTH / 2
worldZ = normalizedY * WORLD_DEPTH - WORLD_DEPTH / 2
```

Chiều rộng và chiều sâu phòng được tính trực tiếp từ `width` và `height` đã chuẩn hóa. Không có giá trị tọa độ thế giới sau chuyển đổi nào được đưa vào yêu cầu PUT.

## Kiến trúc cảnh 3D

- `TwinLayoutEditor` quản lý Overview / 2D Layout / 3D Live cục bộ. 3D Live mở mặc định, dùng geometry và metadata đã lưu; bản nháp được giữ riêng trong editor. Gói WebGL được lazy-load khi mở 3D.
- `Twin3DView` cung cấp khung giao diện đáp ứng, số liệu tổng quan, trạng thái rỗng/dự phòng, số lượng đối tượng chưa đặt, bộ chọn tầng, điều khiển xếp chồng/tách tầng và bảng thông tin đối tượng được chọn.
- `Twin3DCanvas` chỉ phụ trách kết xuất bằng React Three Fiber.
- Mỗi phòng hiển thị sàn, tường không mái, họa tiết sàn, cửa sổ, cửa ra vào, đèn và nội thất ít đa giác được tạo theo quy tắc xác định. Tường hướng về camera hạ thấp khi người xem xoay cảnh để nội thất không bị che; chi tiết cửa trên tường đó được ẩn cùng góc nhìn. Phòng khách, phòng ngủ, bếp, phòng tắm và phòng làm việc được nhận diện bằng tên tiếng Việt/Anh; phòng không nhận diện được dùng bàn/cây trung tính.
- Ngôi nhà nằm trên bệ sân vườn nhỏ với cây, bụi cây, lối vào và một bóng nền nhẹ; các chi tiết này chỉ phục vụ hiển thị. Không chi tiết trang trí nào ảnh hưởng đến ranh giới bố cục gửi về backend.
- `Bounds` căn khung theo phòng và marker, không tính sân vườn; nhà nhiều tầng có khoảng đệm camera lớn hơn để tầng dưới không bị cắt. Nút **Vừa ngôi nhà** áp dụng lại khung đó.
- `PerspectiveCamera` và `OrbitControls` cho xoay 360°, gần thẳng từ trên xuống, giới hạn thu phóng và giữ camera trên sàn. Toolbar `Twin3DCameraControls` cung cấp Phối cảnh / Từ trên / Mặt trước / Bên phải / Mặt sau / Bên trái cùng hai nút xoay 90°. Preset áp dụng cho phòng đang focus hoặc toàn nhà; xoay 90° giữ tâm và khoảng cách hiện tại. Chuyển góc/focus trong 500ms theo cung ngắn nhất, tránh đi xuyên tâm nhà. Kéo tay ngắt transition ngay và bỏ selected state của preset. Vừa ngôi nhà khôi phục khung toàn nhà; Reset góc nhìn khôi phục hướng isometric. Kéo trên nền không bỏ chọn phòng hoặc tự fit lại camera; tường cutaway chuyển chiều cao mượt. Mobile dùng một ngón xoay, hai ngón zoom/xoay. Pan tiếp tục khóa để giữ orientation. Camera chỉ invalidate khi chuyển động; delta đầu tiên sau idle không làm bỏ qua transition. Reduced motion bỏ transition và damping.
- Ánh sáng bán cầu, ánh sáng môi trường, ánh sáng định hướng, đèn nhỏ tại chỗ và bóng tiếp xúc tạo nên góc nhìn đẳng trục sáng.
- Nhãn phòng dùng `Html` của Drei cùng số lượng thiết bị/cảm biến thực tế trong phòng.
- Component điểm đánh dấu thiết bị và cảm biến đăng ký trực tiếp với thực thể Redux đã chuẩn hóa tương ứng. Vì vậy, cập nhật thời gian thực chỉ thay đổi điểm đánh dấu bị ảnh hưởng, không sao chép dữ liệu vận hành hoặc thay đổi hình học.

## Xem trước nhà nhiều tầng

Bộ dữ liệu kiểm thử frontend và dữ liệu mẫu backend cục bộ mô phỏng nhà ba tầng với tám phòng và 14 điểm đánh dấu vận hành đã đặt vị trí. **Toàn nhà / T1 / T2 / T3** là các nút cố định trên toolbar phía trên canvas, cùng **Xếp chồng / Tách tầng** và selected state rõ ràng. Nhãn tầng không còn nổi giữa ngôi nhà. Toàn nhà ẩn nhãn phòng chưa được focus để giảm chồng chữ; xem riêng một tầng hiển thị đầy đủ tên phòng. Tách tầng chỉ thay đổi cao độ hiển thị.

Độ cao mỗi tầng là hình học hiển thị được tính theo quy tắc xác định:

```text
stackedY = (floor - 1) * 2.5
explodedY = (floor - 1) * 3.75
```

Tọa độ X/Z, kích thước, ID nút và vị trí neo điểm đánh dấu đã chuẩn hóa của phòng không thay đổi giữa các chế độ xếp chồng, tách tầng và xem riêng từng tầng. Cách làm này dựa trên bản minh họa Hikvision được liên kết: xem tổng thể công trình, tách các tầng và đi sâu vào một tầng, rồi áp dụng hệ thống hiển thị sáng của HESTA.

Bộ kết xuất dùng `frameloop="demand"`, giới hạn tỷ lệ điểm ảnh thiết bị ở 1.5 trên máy tính và 1.2 trên màn hình nhỏ, giảm độ phân giải bóng trên điện thoại và chỉ tải toàn bộ gói 3D sau khi người dùng chọn chế độ 3D.

## Trạng thái hoạt động và lựa chọn đối tượng

Overview derive số phòng/thiết bị/cảm biến, ACTIVE/STALE/OFFLINE và tổng Unplaced từ `twinSlice` + confirmed layout; không thêm endpoint. 3D Live có hover/selected room, focus camera, inspector bên phải trên desktop và bên dưới trên mobile. Room inspector liệt kê đối tượng nghiệp vụ kể cả chưa đặt; field Phòng của Device/Sensor dùng `roomId` nghiệp vụ, tách với thao tác xem phòng chứa marker trên layout.

`twinPresentation.ts` ánh xạ `deviceType`/`metricType` đã có và cung cấp fallback generic. LIGHT/LED_RGB, FAN, AC legacy và plug/remote có geometry nhẹ; `IR_REMOTE` dùng biểu tượng remote, không được suy ra TV/AC. Các metric TEMPERATURE, HUMIDITY, LIGHT/ILLUMINANCE, MOTION, AIR_QUALITY, CO2 và SMOKE có icon riêng; ID và casing dữ liệu không bị sửa.

`currentState.power` chỉ được nhận diện khi là boolean hoặc chính xác ON/OFF. Thiết bị ONLINE + ACTIVE với power ON có đèn phát sáng nhẹ, FAN quay hoặc AC hiện airflow indicator. Không animate thiết bị offline theo state lịch sử. TV chưa có type trong Twin contract hiện tại, nên chưa thể làm screen emissive đúng dữ liệu; cần backend cung cấp loại appliance đích nếu muốn phân biệt TV/AC sau IR_REMOTE.

Marker, giá trị inspector và health pulse một lần trong 240ms khi dữ liệu tương ứng đổi, tôn trọng `prefers-reduced-motion`. Không copy operational state, tạo STOMP client, polling hoặc GET snapshot theo event. Canvas giữ `frameloop="demand"`; FAN chỉ invalidate khi đang quay, camera lấy bounds từ Drei và nội suy tọa độ cầu trong các frame chuyển động. DPR/mobile shadow cập nhật khi viewport đổi. 2D giữ snap/grid/alignment hiện có và bổ sung ghost vị trí gốc cùng width/height theo phần trăm khi resize.

Frontend không thêm dependency, GLTF, API hay thay đổi backend. Một lỗi build/lint có sẵn ở `DevicePage.tsx` được sửa bằng import service còn thiếu và bỏ ba cast `any` thừa.

Điểm đánh dấu dùng các giá trị `ACTIVE`, `STALE` và `OFFLINE` hiện có. Ngoài màu sắc, chúng hiển thị ký hiệu `A`, `!` hoặc `×` và dòng trạng thái trong bảng thông tin, nên trạng thái hoạt động không chỉ được truyền đạt bằng màu. Khi chọn phòng, thiết bị hoặc cảm biến, bảng thông tin chỉ đọc sẽ mở ra. Chủ nhà quay lại trình chỉnh sửa 2D hiện có để thay đổi bố cục.

Thiết bị có trạng thái `UNKNOWN` vẫn hiển thị nguyên trạng thái và ký hiệu health thực từ backend. Frontend không suy ra thiết bị mẫu hay tình trạng ghép nối từ `lastSeen` null.

## Trạng thái rỗng, chưa đặt vị trí và dự phòng

- Bố cục rỗng hiển thị **Chưa có sơ đồ nhà** và nút kêu gọi chủ nhà thiết kế trong chế độ 2D.
- Các nút vận hành không có tọa độ bố cục được đếm trong bảng đối tượng chưa đặt; chúng không bao giờ bị rải ngẫu nhiên trong cảnh 3D.
- Khả năng hỗ trợ WebGL được kiểm tra trước khi tạo cảnh.
- Ranh giới xử lý lỗi React bắt lỗi khi khởi tạo hoặc kết xuất cảnh.
- Cả hai trường hợp lỗi đều hiển thị lời giải thích dễ đọc và thao tác **Chuyển sang 2D**.
- Khi đổi nhà, trình chỉnh sửa bố cục hiện có được gắn lại và trạng thái chế độ xem cùng đối tượng được chọn ở cục bộ được xóa theo vòng đời route/store hiện tại.

## Minh họa thủ công

Để dùng bộ dữ liệu nhà nhiều tầng độc lập, khởi chạy frontend rồi mở:

```text
http://127.0.0.1:5173/tests/twin-layout-preview.html?multifloor=1
```

Chọn **3D**, sau đó dùng **Toàn nhà / T3 / T2 / T1** và **Xếp chồng / Tách tầng**. Route dữ liệu mẫu này không gọi hoặc sửa backend thật. Để kiểm tra từ đầu đến cuối, nạp dữ liệu mẫu cho backend cục bộ rồi đăng nhập bằng `multifloor.owner@hesta.local`; nhà đã lưu của tài khoản này mở thẳng ở chế độ 3D vì có nhiều hơn một tầng.

1. Khởi chạy backend bằng cấu hình cục bộ hiện có.
2. Khởi chạy frontend bằng `npm run dev`.
3. Đăng nhập với vai trò OWNER và mở Digital Twin.
4. Hiển thị bố cục 2D hiện có.
5. Chọn **3D** trong phần đầu trang Digital Twin.
6. So sánh các hình chữ nhật phòng với hình học phòng 3D không mái.
7. Kéo để xoay cảnh và dùng bánh xe/trackpad để phóng to hoặc thu nhỏ. Thử sáu góc nhìn nhanh, xoay trái/phải 90°, đổi góc khi đang focus phòng và kéo tay giữa transition.
8. Chọn **Vừa ngôi nhà** để tính lại và đặt lại khung hình camera.
9. Chọn nhãn nổi của một phòng rồi xem bảng thông tin và danh sách nút của phòng.
10. Chọn điểm đánh dấu thiết bị rồi xem trạng thái hiện tại, kết nối, trạng thái hoạt động và thời điểm phản hồi cuối.
11. Chọn điểm đánh dấu cảm biến rồi xem giá trị mới nhất, đơn vị, trạng thái hoạt động và thời điểm quan sát.
12. Kích hoạt sự kiện cảm biến giả lập hiện có, đổi giá trị từ `26.4` thành `30.0`, rồi kiểm tra giá trị thay đổi mà không cần tải lại trang hoặc di chuyển điểm đánh dấu.
13. Kích hoạt chuỗi `ACTIVE → STALE → OFFLINE` và kiểm tra cùng một điểm đánh dấu thay đổi ký hiệu, kiểu hiển thị và nội dung bảng thông tin.
14. Chuyển về **2D**, bật chế độ chỉnh sửa, di chuyển một phòng rồi lưu.
15. Trở lại **3D** và kiểm tra bố cục chuẩn hóa đã lưu tạo ra hình học 3D mới.
16. Chuyển sang một nhà rỗng và kiểm tra trạng thái rỗng được hiển thị rõ.
17. Dùng khung nhìn điện thoại/máy tính bảng và xác nhận cảnh vẫn tương tác được, bảng thông tin xếp phía dưới và trang không tràn ngang.

## Kiểm chứng tự động và trực quan

Cải thiện camera tiếp theo ngày 01/10/2026: `npm test` đạt 102/102; lint, build và diff check đạt. Browser/WebGL đạt 47 kiểm tra, không có uncaught exception: đủ sáu preset, xoay 90° rồi quay ngược về cùng projection, reset isometric, giữ phòng chọn khi đổi góc/kéo, reduced motion và toolbar 320px. Test chờ projection ổn định qua các frame thực thay vì giả định software WebGL hoàn tất trong một khoảng chờ cố định. Đã xem ảnh desktop 1440px, góc từ trên và mobile 320px; test cũng kiểm tra 390px. Chưa đo FPS trên GPU/laptop thật; browser dùng fixture API và software WebGL. Build vẫn có cảnh báo chunk lớn hiện có.

Đợt polish ngày 01/10/2026: `npm test` đạt 100/100; lint, build và diff check đạt. Browser/WebGL đạt 33 kiểm tra, editor 2D đạt 51 kiểm tra: camera focus/fit, marker compact, toolbar tầng, realtime không tăng REST/đổi geometry, reduced motion, header safe zone, fit 70–85%, manual pan không reset bởi realtime, ghost/resize, OWNER/MEMBER và mobile 390/320px. Ảnh được render lại trong các thư mục evidence; `mobile-390.png` dùng đúng 390px và có thêm `mobile-320.png`. Browser test dùng fixture API độc lập, chưa phải demo backend thật có xác thực. Build còn cảnh báo chunk lớn; gói 3D vẫn lazy-load riêng.

Marker mặc định là icon 36px cùng health dot/ký hiệu A, ! hoặc ×, không có cột hình trụ hay pedestal. Tên/value chỉ hiện khi hover, focus bàn phím hoặc selected. Vật liệu tường, sàn và sân dùng token Twin riêng, giảm ánh sáng phủ để furniture có contrast rõ hơn. Shadow plane nhẹ dùng directional shadow map hiện có; không thêm postprocessing. Viền sàn accent và transition vật liệu khoảng 200ms làm rõ phòng hover/selected; các phòng khác giữ nội thất và chỉ giảm emphasis nhẹ.

Chạy các bài kiểm tra hợp đồng không cần WebGL:

```text
npm test
npm run lint
npm run build
git diff --check
```

Để kiểm tra trên trình duyệt/WebGL thật, khởi chạy Vite ở cổng 5173 rồi chạy:

```text
npm run test:twin3d:browser
```

Bài kiểm tra trình duyệt dùng WebGL phần mềm của Chromium để xác minh việc chuyển chế độ, chọn đối tượng, cập nhật giá trị/trạng thái hoạt động theo thời gian thực, vị trí điểm đánh dấu ổn định, thao tác Vừa ngôi nhà, đổi nhà, bố cục rỗng, tràn nội dung trên điện thoại, chế độ dự phòng khi WebGL lỗi, tách tầng, xem riêng một tầng và hình học khi xếp chồng tầng.

Minh chứng được ghi vào `docs/evidence/twin-3d/`:

- `default-isometric-desktop.png`
- `selected-room.png`
- `selected-device.png`
- `selected-sensor-active.png`
- `health-stale.png`
- `health-offline.png`
- `empty-layout.png`
- `mobile-390.png`
- `multi-floor-exploded.png`
- `multi-floor-level-2.png`
- `multi-floor-stacked.png`
- `browser-results.json`

## Những khác biệt có chủ đích so với hình tham khảo

Trình xem hiện tái hiện hướng thiết kế ngôi nhà không mái và có nội thất của hình tham khảo bằng đồ nội thất ít đa giác được tạo theo quy tắc, cửa ra vào, cửa sổ, cảnh quan, sàn tông ấm và ánh sáng phòng. Giao diện không khẳng định độ chân thực như ảnh chụp hoặc độ chính xác kiến trúc: các chi tiết trang trí này được suy ra từ tên phòng vì HESTA hiện chưa lưu hình học của chúng. Việc nhóm các tầng dùng số tầng chính thức được lưu cùng bố cục mỗi phòng. Về sau, `Twin3DDecor` có thể thay các bố trí suy ra bằng vị trí ô cửa và cao độ đã đo, vật liệu và tài nguyên mô hình GLTF mà không thay đổi trạng thái vận hành Twin.
