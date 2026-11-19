# HESTA Digital Twin — Premium Dashboard

## Phạm vi

Redesign trang Digital Twin hiện có, không tạo dashboard demo thay thế. Backend,
database, REST/WebSocket/MQTT, authentication và hợp đồng với Flutter không đổi.
Brief lần này không kèm ảnh tham chiếu, nên bố cục theo đặc tả bằng văn bản.

## Kiến trúc và dữ liệu được giữ lại

```text
HESTA REST + shared STOMP subscription
  → existing twin/twinLayout/twinCommand Redux slices
  → twinAdapter / twinArchitectureAdapter
  → HouseScene / FloorScene / existing physical device models
  → dashboard explorer, controls, analytics
```

- Snapshot: `GET /homes/{homeId}/twin` qua API client hiện có.
- Layout: `GET/PUT /homes/{homeId}/twin-layout`, giữ revision và architecture.
- Capability: `GET /devices/{deviceId}`, chỉ tải chi tiết khi chọn thiết bị.
- Power: `POST /devices/{deviceId}/commands`; action khác:
  `POST /devices/{deviceId}/command`, giữ nguyên command service và payload.
- Realtime: subscription hiện có xử lý `DEVICE_STATE_CHANGED`,
  `SENSOR_READING_UPDATED`, `TWIN_HEALTH_STATUS_CHANGED`. Không thêm polling,
  không fetch lại toàn nhà sau từng event.
- ACK/success của command và `currentState` được xác nhận là hai trạng thái riêng.
  UI không tự ghi thành công vào trạng thái model khi chỉ gửi xong lệnh.

## Trải nghiệm mới

- Giữ `HomeSidebar` dùng chung với các trang HESTA, chọn đúng mục Digital Twin;
  header bên trong chỉ giữ tiêu đề, realtime, notification, hồ sơ và renderer
  theme. Menu điều hướng trên mobile bổ sung Thành viên và Admin theo quyền.
- Từ 1536px: nav HESTA 256px / explorer 224px / scene co giãn / control 320px.
  Laptop 1280–1535px: explorer mở dạng drawer để scene có đủ diện tích.
  Tablet: các panel dạng native modal drawer; mobile: bottom sheet có focus trap
  và Escape. Không dùng menu ngang thay thế sidebar của ứng dụng.
- Explorer dùng tầng từ layout thực, phòng và số thiết bị từ Redux. Chọn tầng
  chuyển single-floor; chọn phòng focus camera. Whole house là mặc định,
  exploded chỉ khi chọn rõ ràng. Có fullscreen cho toàn khu vực điều khiển 3D.
- Sidebar có tabs thiết bị, cảm biến, cảnh báo, thống kê; chi tiết tái sử dụng
  `Twin3DInspector` và `DeviceControlPanel` theo capability thực.
- Analytics chọn bản ghi ACTIVE hợp lệ mới nhất với đúng đơn vị; luôn chỉ rõ
  nguồn phòng và thời điểm. Chọn phòng ưu tiên hơn phạm vi tầng. Thiết bị chưa
  gán phòng không bị đưa vào tầng bất kỳ. Không trộn giá trị khác đơn vị.
- Thiếu lịch sử, lux, motion hoặc dữ liệu phù hợp: empty state, không biểu đồ giả.
- Marker tròn, tooltip hover/focus, trạng thái pending/offline/warning/error;
  default `important`. Zoom xa gom theo phòng có hysteresis để tránh nhấp nháy;
  click cluster focus phòng, thiết bị vẫn truy cập được từ sidebar.
- Motion pulse chỉ phản hồi sự kiện mới hợp lệ, không phát từ cached snapshot;
  tôn trọng `prefers-reduced-motion`. Touch target marker tối thiểu 44px trên
  thiết bị pointer coarse.

## Renderer và hiệu năng được tái sử dụng

Giữ geometry/walls/cutaway/openings/furniture, soft shadows, contact grounding,
camera transition, physical light RGB/brightness, fan/door animation và floor
heatmap hiện có. Không thêm post-processing hay dependency mới.

Canvas memoized và demand-rendered; selector từng device/sensor, geometry không
phụ thuộc device state. Cluster chỉ đổi state khi vượt ngưỡng zoom. Các native
panel đóng không mount thêm control hoặc gọi capability API.

Theme DAYLIGHT/COZY/BLUEPRINT/NIGHT chỉ đổi renderer. App vẫn sáng. Theo phản hồi
ngày 2026-10-21, đã bỏ toàn bộ palette ghi đè riêng của Digital Twin. Nền, nút,
tab, trạng thái chọn, chữ, border và shadow kế thừa chính token HESTA hiện tại;
không thay palette của các trang khác.

## File chính

- `src/components/twin/DigitalTwinPage.tsx`
- `src/components/twin/TwinLayoutEditor.tsx`
- `src/components/twin/Twin3DView.tsx`
- `src/components/twin/dashboard/TwinDashboardHeader.tsx`
- `src/components/twin/dashboard/TwinHouseExplorer.tsx`
- `src/components/twin/dashboard/TwinControlSidebar.tsx`
- `src/components/twin/dashboard/TwinAnalytics.tsx`
- `src/components/twin/dashboard/TwinPanelDialog.tsx`
- `src/components/twin/dashboard/twinDashboardData.ts`
- `src/components/twin/scene/SceneNodes.tsx`
- `src/components/twin/scene/FloorScene.tsx`
- `src/components/twin/scene/RoomMarkerCluster.tsx`
- `src/components/twin/scene/MarkerClusterContext.ts`
- `src/components/twin/scene/markerClustering.ts`
- `src/components/twin/scene/markers.css`
- `src/index.css`
- `tests/twinDashboard.test.mjs`, `tests/twinMarkers.test.mjs`
- `tests/twinLayout.test.mjs`, `tests/twinInteraction.browser.mjs`
- `tests/twin-layout-preview.tsx`, `package.json`

## Giới hạn kiểm chứng

Browser tests dùng renderer WebGL thật và transport REST/WebSocket fixture cô
lập; không gửi lệnh đến ESP32 thật. Dữ liệu fixture chỉ phục vụ kiểm thử, không
được đưa vào dashboard production. Chưa có API sensor history/camera stream phù
hợp nên không thêm chart trend hoặc nút stream giả. Không tuyên bố pixel match
với ảnh chưa được cung cấp.

## Kết quả kiểm tra trên bản cuối

- `npm test`: **156/156 passed**, gồm aggregation, empty/invalid readings,
  floor scope, room precedence, unassigned devices và marker/motion helpers.
- `npm run test:twin:interaction`: **51/51 passed**, không uncaught exception.
  Browser Chromium WebGL thật kiểm tra physical picking, RGB diffuser/light,
  brightness, pending/ACK, command failure, door, fan, read-only capability,
  không refetch snapshot, tablet/mobile/Escape, house/single/exploded, clustering
  renderer theme, shared HESTA navigation, content offset và laptop explorer.
  Các theme giữ nguyên token giao diện chung HESTA. Harness chỉ trả lời native beforeunload cho fixture cô lập;
  không bỏ navigation guard của production.
- Single floor đo được khoảng **70% chiều rộng canvas**. Đổi theme giữ hướng
  nhìn và điểm focus; camera vẫn fit lại khi viewport đổi kích thước.
- Focused ESLint toàn bộ source/test mới hoặc sửa: **passed**.
- `npm run lint`: **64 errors, 6 warnings** có sẵn ngoài phạm vi Twin; đối chiếu
  baseline `.tmp/twin-realism-lint.log`. Không thêm eslint-disable để che lỗi.
- `npm run build`: **passed**, bao gồm TypeScript project build (`tsc -b`).
- `git diff --check`: **passed**.

### Bundle production

Đo từ `dist/bundle-analysis.json` và gzip các file output cuối, đơn vị KB thập phân:

| Phần | Gzip KB |
| --- | ---: |
| Initial JS và static imports | 262.60 |
| DigitalTwinPage async | 27.15 |
| Twin3DView async | 47.59 |
| R3F vendor async | 25.72 |
| Three vendor async | 185.43 |

Static import graph của initial entry chứa **0 module Three/R3F/three-stdlib**.
Không thêm dependency/model mới. Vite vẫn cảnh báo chunk lớn cho Three và entry
hiện có; Three tiếp tục chỉ được tải khi mở scene. Đây là số đo bản hiện tại,
không phải tuyên bố mức giảm so với baseline chưa được đo lại trong lần redesign.

### Ảnh đã capture và xem trực tiếp

Artifacts local, không nhập dữ liệu fixture vào production:

- [Desktop overview](../.tmp/twin-interaction-evidence/desktop-overview.png)
- [Laptop với nav HESTA](../.tmp/twin-interaction-evidence/laptop-with-hesta-navigation.png)
- [Whole house](../.tmp/twin-interaction-evidence/premium-whole-house.png)
- [Single floor](../.tmp/twin-interaction-evidence/premium-single-floor.png)
- [Daylight](../.tmp/twin-interaction-evidence/premium-theme-daylight.png)
- [Blueprint](../.tmp/twin-interaction-evidence/premium-theme-blueprint.png)
- [Night](../.tmp/twin-interaction-evidence/premium-theme-night.png)
- [Tablet controls](../.tmp/twin-interaction-evidence/tablet-interactions.png)
- [Mobile controls](../.tmp/twin-interaction-evidence/mobile-interactions.png)
- [Exploded](../.tmp/twin-interaction-evidence/premium-exploded.png)
- [Clusters](../.tmp/twin-interaction-evidence/premium-marker-clusters.png)

Screenshot helper đợi demand-rendered frame và GPU hoàn tất trước khi capture.
Full-page capture có thể tạm đổi canvas aspect: test xác nhận hướng/target và
framing đúng, không buộc bán kính camera cố định khi viewport thực sự đổi.
