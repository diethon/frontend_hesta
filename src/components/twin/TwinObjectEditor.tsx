import { useState } from 'react';
import type { TwinRoomLayout } from '../../types/twinLayout';
import { changeRoomDrafting, roomDrafting, sceneObjectKinds, snapMeters, type TwinDraftingMetadata, type TwinSceneObjectKind } from './twinDrafting';
import { roomToWorld } from './twin3dGeometry';
import { TwinLayoutButton } from './TwinLayoutButton';
import { attachOpening, sceneObjectLabels as labels } from './twinObjectPlacement';

const sizes: Partial<Record<TwinSceneObjectKind, [number, number, number]>> = { BED: [1.6, 2.1, .85], SOFA: [2.4, .9, .85], CHAIR: [.45, .5, .9], DESK: [1.2, .6, .75], TV_STAND: [1.8, .45, .5], WARDROBE: [1.4, .6, 1.9], KITCHEN_COUNTER: [1.8, .6, .9], SINK: [.9, .6, .9], TOILET: [.4, .7, .78], SHOWER: [.95, .95, 1.95], BATHTUB: [1.6, .7, .6], PLANT: [.5, .5, 1.1], LAMP: [.4, .4, 1.5], REFRIGERATOR: [.65, .65, 1.8] };
export function TwinObjectEditor({ room, metadata, onChange }: { room: TwinRoomLayout; metadata: TwinDraftingMetadata; onChange: (next: TwinDraftingMetadata) => void }) {
  const [kind, setKind] = useState<TwinSceneObjectKind>('TABLE');
  const current = roomDrafting(metadata, room.roomId);
  const world = roomToWorld(room);
  const step = metadata.settings.gridMeters ?? .5;
  const objects = current.objects ?? [];
  const save = (next: typeof objects) => onChange(changeRoomDrafting(metadata, room.roomId, { ...current, objects: next.map(object => attachOpening(object, current, world.width, world.depth)) }));
  return <fieldset className="space-y-3 rounded-xl border border-line bg-app p-3"><legend className="px-1 text-sm font-semibold text-text">Kiến trúc & nội thất</legend>
    <p className="text-xs text-muted">Kéo bàn ghế trực tiếp trên sơ đồ 2D. Dùng phím mũi tên để di chuyển, giữ Shift để căn từng 5 cm. Bạn cũng có thể nhập vị trí và góc xoay bên dưới. Bấm Lưu bố cục để cập nhật sang 3D.</p>
    <label className="flex min-h-11 items-center gap-2 text-xs text-muted"><input type="checkbox" checked={current.autoFurniture !== false} onChange={(event) => onChange(changeRoomDrafting(metadata, room.roomId, { ...current, autoFurniture: event.target.checked }))} />Nội thất minh họa tự động</label>
    <label className="block text-xs text-muted">Loại đối tượng<select value={kind} onChange={(event) => setKind(event.target.value as TwinSceneObjectKind)} className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-text">{sceneObjectKinds.map((item) => <option key={item} value={item}>{labels[item]}</option>)}</select></label>
    <TwinLayoutButton onClick={() => { const size = sizes[kind] ?? [1, kind === 'WALL' || kind === 'DOOR' || kind === 'WINDOW' ? .12 : .75, kind === 'DOOR' || kind === 'WALL' ? 2 : kind === 'WINDOW' ? 1 : .7]; save([...objects, { id: crypto.randomUUID(), kind, x: snapMeters(world.width / 2, step), z: snapMeters(world.depth / 2, step), width: Math.min(size[0], world.width), depth: Math.min(size[1], world.depth), height: size[2], rotation: 0 }]); }}>Thêm {labels[kind].toLowerCase()}</TwinLayoutButton>
    {objects.map((object) => <div key={object.id} className="space-y-2 border-t border-line pt-3"><strong className="text-xs text-text">{labels[object.kind]}</strong><div className="grid grid-cols-2 gap-2">{(['x', 'z', 'width', 'depth', 'height', 'rotation'] as const).map((field) => <label key={field} className="text-xs text-muted">{{ x: 'Ngang (m)', z: 'Dọc (m)', width: 'Rộng (m)', depth: 'Sâu (m)', height: 'Cao (m)', rotation: 'Xoay (°)' }[field]}<input type="number" step={field === 'rotation' ? 15 : field === 'x' || field === 'z' ? step : .05} min={field === 'rotation' ? -360 : 0} value={object[field]} onChange={(event) => {
      let value = event.target.valueAsNumber;
      if (!Number.isFinite(value)) return;
      if (field === 'x' || field === 'z') value = Math.max(0, Math.min(field === 'x' ? world.width : world.depth, snapMeters(value, step)));
      else if (field === 'rotation') value = Math.round(value / 15) * 15;
      else value = Math.max(.05, Math.min(10, value));
      save(objects.map((item) => item.id === object.id ? { ...item, [field]: value } : item));
    }} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-2 text-text" /></label>)}</div><TwinLayoutButton variant="danger" onClick={() => save(objects.filter((item) => item.id !== object.id))}>Bỏ {labels[object.kind].toLowerCase()}</TwinLayoutButton></div>)}
  </fieldset>;
}
