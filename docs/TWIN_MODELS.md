# Mô hình 3D cho Digital Twin

File `.glb` nằm trong `public/twin-models/<tên>.glb`. Nếu file thiếu hoặc lỗi, app tự
dùng mô hình vẽ bằng code (procedural) nên không bao giờ bị trống.

## Quy ước bắt buộc khi thay file (Blender, Poly Haven, Kenney, Quaternius…)

- Đơn vị mét, kích thước thật. Xuất glTF Binary (`.glb`), texture tối đa 1K.
- Gốc tọa độ đúng điểm gắn: thiết bị treo trần đặt gốc ở trần và treo theo trục -Y;
  đồ đặt sàn đặt gốc ở tâm đáy. Mặt trước hướng +Z.
- Tên vật liệu quyết định màu: app tô lại theo bảng màu HESTA để mọi nguồn đồng bộ.
- Bộ phận chuyển động là một node riêng với tên cố định; app tự điều khiển theo trạng thái thiết bị.

| File | Node chuyển động | Vật liệu được tô lại |
|---|---|---|
| `ceiling-fan.glb` | `blades` — quay quanh Y | `body`, `blade`, `metal` |
| `standing-fan.glb` | `blades` — quay quanh Z (gốc ở sàn, tâm cánh cao 1,25 m) | `body`, `blade`, `metal` |
| `ac.glb` | `flap` — lật quanh X; đèn LED, nhiệt độ và hơi lạnh do code vẽ | `body`, `dark` |
| `tv.glb` | — (màn hình sáng do code vẽ ở z = 0,022) | `dark` |
| `roller-door.glb` | `shutter` chứa các nan `slat-*`; app nâng `shutter` và ẩn nan đã cuốn vào hộp | `body`, `metal` |

`roller-door.glb` dựng theo kích thước đơn vị 1 × 1 m (x −0,5..0,5, y 0..1); app tự co giãn theo lỗ cửa
trên tường, mặc định 2,4 × 2,1 m nếu phòng chưa có lỗ cửa. Thiết bị được vẽ thành cửa cuốn khi loại là
`ROLLING_DOOR`/`SHUTTER`, hoặc `DOOR`/`GATE` có tên chứa "cửa cuốn".

Chưa chuyển: đèn (cần giữ nguồn sáng `LampEmitter`), camera, cảm biến, ổ cắm, cửa/cửa sổ/rèm
(đang dựng theo lỗ tường) và đồ nội thất.

## Sinh lại bằng Blender (bản hiện dùng)

```powershell
blender -b --factory-startup -P scripts/blender/hesta_devices.py -- models    # public/twin-models/*.glb
blender -b --factory-startup -P scripts/blender/hesta_devices.py -- sprites   # public/device-sprites/*.webp
```

Script dựng toàn bộ model bằng Python (Blender 5.x, không cần file `.blend`) theo đúng bảng trên.
`sprites` render bằng Cycles 24 khung tắt → bật cho card thiết bị (`light`, `fan`, `ac`, `tv`, `plug`);
`DevicePowerSprite` phát xuôi khi bật, ngược khi tắt. Quạt: khung 0–15 tăng tốc, 16–23 lặp vòng quay.
Có thể chỉ render một loại: `-- sprites fan`.

## Sinh lại bản placeholder

```powershell
node scripts/generate-twin-models.mjs
```

Script dựng mô hình bằng Three.js theo đúng quy ước trên. Đây là bản tạm để kiểm tra
pipeline; thay bằng mô hình Blender/CC0 cùng tên node và vật liệu để đẹp hơn. Ghi nguồn
và giấy phép của mô hình tải về vào `public/twin-models/CREDITS.md`.
