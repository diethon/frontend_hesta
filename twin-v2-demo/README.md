# HESTA Digital Twin V2 Demo

Frontend visual prototype độc lập, sử dụng React 19, TypeScript, Vite, Tailwind CSS, Three.js, React Three Fiber, Drei và Lucide React. Không import code hoặc cấu hình từ ứng dụng HESTA production.

## Chạy demo

Yêu cầu Node.js 22.13+ và npm. Trong thư mục demo:

```powershell
cd D:\FPTU\Capstone\Resources\hesta_frontend\twin-v2-demo
npm install
npm run dev
```

Mở **http://127.0.0.1:5178/**. Demo sử dụng port riêng và không cần `.env`, đăng nhập, backend, database hoặc thiết bị IoT.

```powershell
npm run lint
npm test
npm run build
npm run preview
```

`preview` dùng cùng port 5178: dừng dev server trước khi chạy preview.

## Trải nghiệm

- **3 tầng / 18 khu vực / 30 thiết bị**. Chọn tầng ở thanh trên mô hình hoặc dropdown trong House Explorer.
- Mỗi tầng có tên phòng, cảm biến và trạng thái thiết bị riêng. Chuyển tầng rồi quay lại vẫn giữ điều chỉnh trong phiên hiện tại.
- Tầng 1 có sân vườn và garage minh họa. Tầng 2/3 có không gian ngoài trời với bàn ghế thay xe. Các tầng tái sử dụng cấu trúc modular; chưa phải ba mặt bằng kiến trúc riêng biệt.
- Chọn phòng từ danh sách, label 3D hoặc click sàn/nội thất; camera focus khoảng 680ms. Nhấn đúp để focus, kéo để xoay, cuộn để zoom, chuột phải để pan.
- Chọn marker thiết bị để mở điều khiển; panel đã thu gọn tự mở lại.
- Đèn: bật/tắt, độ sáng, preset 25/50/75/100%, màu ấm/tự nhiên/trắng. Point light và emissive trong 3D nội suy theo state.
- Điều hòa: bật/tắt, 16–30°C, làm lạnh/tự động/hút ẩm. Quạt: bật/tắt và 3 tốc độ quay.
- Day/Night, phóng to/thu nhỏ, reset, fullscreen và thu gọn panel.
- Cảm biến, biểu đồ, thời tiết và công suất đều được ghi nhãn mô phỏng. Thiết bị ngoại tuyến hiển thị trạng thái và vô hiệu hóa điều khiển.
- Phím `/` focus ô tìm phòng, `Escape` đóng hướng dẫn. Hỗ trợ `prefers-reduced-motion`.

## Cấu trúc

```text
twin-v2-demo/
  src/
    App.tsx                 # shell, tầng/phòng/thiết bị đang chọn
    data.ts                 # toàn bộ mock 3 tầng
    mockState.ts            # reducer thuần, giới hạn điều khiển
    index.css               # token HESTA và giao diện độc lập
    components/             # Explorer, DevicePanel, Analytics, UI
    scene/
      HouseScene.tsx        # Canvas, kiến trúc, camera, picking
      Furniture.tsx         # nội thất modular, cây, đèn, quạt
      materials.ts          # bảng vật liệu kiến trúc
      surfaces.tsx          # texture dùng chung và vật liệu PBR
  public/materials/         # normal/roughness maps lưu local + nguồn/giấy phép
  tests/mockState.test.mjs   # invariant, cách ly tầng và nguồn dữ liệu
  scripts/browser-interactions.js  # kịch bản QA qua Playwright CLI
  output/playwright/        # screenshot và báo cáo QA (gitignored)
```

Mô hình là geometry 3D thật với sàn instanced, 1 directional light đổ bóng, point lights không đổ bóng, shader bóng tiếp xúc và reflection light cards. Normal/roughness maps 1K của gỗ và vải được đóng gói local; xem nguồn và giấy phép tại `public/materials/CREDITS.md`. Không tải GLB, HDRI, texture hoặc font từ dịch vụ ngoài khi chạy demo. UI được tải trước, scene 3D tải qua lazy import.

Khi chọn phòng, demo tách riêng phòng đó bằng clipping 3D, tự fit camera theo kích thước phòng và giảm các label không liên quan. Tường trước được cắt thấp để thấy nội thất. Nội thất có vải dệt/nếp chăn rủ, đường may sofa, đồ dùng bàn ăn, vòi kim loại, thiết bị gốm và các chi tiết bàn làm việc. Phòng tắm có gương phản chiếu trực tiếp ở độ phân giải 256px khi xem riêng. Nhấn nút **Quay lại toàn cảnh** ở góc trên trái hoặc **Esc** để trở lại nhà đầy đủ. Nút này luôn nằm trên các marker và có vùng bấm tối thiểu 44px.

Camera giữ trục đứng cố định, cho phép xoay quanh phòng nhưng giới hạn góc nhìn cao khoảng 25–54° để tránh nhìn gần sát sàn hoặc gần thẳng từ trên xuống. Khi đổi kích thước/fullscreen, camera giữ cách fit của chế độ phòng. Reset/focus xóa quán tính kéo cũ trước khi chuyển góc.

Đây là demo local state: reload trang khôi phục kịch bản mặc định. Không có REST API, WebSocket nghiệp vụ, MQTT hoặc lưu dữ liệu về backend. Vite dev server vẫn có HMR thông thường của công cụ phát triển.

## Browser QA

Script tương tác dùng [Playwright CLI](https://github.com/microsoft/playwright-cli), không cần thêm dependency vào demo:

```powershell
npx --yes --package @playwright/cli playwright-cli --session hesta-v2 open http://127.0.0.1:5178 --headed
New-Item -ItemType Directory -Force output/playwright | Out-Null
$qaScript = Get-Content scripts/browser-interactions.js -Raw -Encoding utf8
npx --yes --package @playwright/cli playwright-cli --session hesta-v2 run-code $qaScript
```

Không có ảnh tham khảo được đính kèm trong phiên triển khai, nên visual QA dựa trên brief và screenshot browser thực tế. Không thể xác nhận độ giống một ảnh chưa được cung cấp.

Kết quả kiểm tra: `lint` và TypeScript/build PASS; 6 test tự động PASS; 33 kiểm tra tương tác browser PASS. Đã kiểm tra layout 1920×1080, 1440×900, 390px và 320px, không tràn ngang/text ở các vùng đã kiểm tra; kéo xoay, pan, cuộn zoom, double-click chọn sàn và reduced motion hoạt động. Browser không có JavaScript error hoặc request API nghiệp vụ.

Cảnh báo còn lại: chunk Three.js khoảng 1.19 MB trước gzip (~329 KB gzip); dependency R3F hiện phát cảnh báo deprecation `THREE.Clock` trong console. Không sửa dependency production hoặc tắt cảnh báo để che kết quả. FPS chưa được benchmark trên máy desktop khác.

Screenshot thực tế: `output/playwright/desktop-1920.png`, `desktop-1440.png`, `floor-3.png`, `night.png` và `expanded-1440.png`. Báo cáo chi tiết trong `interactions-result.txt` và `layout-result.txt` cùng thư mục.

Ảnh cập nhật theo từng phòng: `realism-living.png`, `realism-bedroom.png`, `realism-kitchen.png`, `realism-bathroom.png`, `realism-office.png` và `realism-bedroom-night.png`. `scripts/browser-rooms.js` kiểm tra chọn/tách riêng 5 phòng, đèn phòng ngủ, trở lại toàn cảnh và giải mã đủ 4 texture local 1024×1024; kết quả trong `rooms-result.txt`.

`scripts/browser-room-navigation.js` kiểm tra nút quay lại ở đủ 6 khu vực, Esc, dialog, vùng bấm ở 320px và 4 lần kéo xoay mạnh. Kiểm tra chẩn đoán xác nhận aspect camera/Canvas khớp, trục camera trực giao, geometry/scale của nội thất không thay đổi khi xoay. Kết quả: `output/playwright/room-navigation-result.txt`; ảnh `room-return-desktop.png`, `room-return-mobile.png`, `room-rotation-fixed.png`.
