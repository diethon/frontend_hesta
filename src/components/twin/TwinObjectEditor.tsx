import { useState } from 'react';
import type { TwinRoomLayout } from '../../types/twinLayout';
import { changeRoomDrafting, roomDrafting, sceneObjectKinds, snapMeters, type TwinDraftingMetadata, type TwinSceneObjectKind } from './twinDrafting';
import { roomToWorld } from './twin3dGeometry';
import { TwinLayoutButton } from './TwinLayoutButton';

const labels: Record<TwinSceneObjectKind, string> = { WALL: 'Vách', DOOR: 'Cửa', WINDOW: 'Cửa sổ', TABLE: 'Bàn', SOFA: 'Sofa', BED: 'Giường', CABINET: 'Tủ', CHAIR: 'Ghế', DESK: 'Bàn làm việc', TV_STAND: 'Kệ TV', WARDROBE: 'Tủ áo', KITCHEN_COUNTER: 'Tủ bếp', SINK: 'Chậu rửa', TOILET: 'Bồn cầu', SHOWER: 'Vòi sen', BATHTUB: 'Bồn tắm', PLANT: 'Cây', LAMP: 'Đèn đứng', REFRIGERATOR: 'Tủ lạnh' };
const sizes: Partial<Record<TwinSceneObjectKind, [number, number, number]>> = { BED: [1.6, 2.1, .85], SOFA: [2.4, .9, .85], CHAIR: [.45, .5, .9], DESK: [1.2, .6, .75], TV_STAND: [1.8, .45, .5], WARDROBE: [1.4, .6, 1.9], KITCHEN_COUNTER: [1.8, .6, .9], SINK: [.9, .6, .9], TOILET: [.4, .7, .78], SHOWER: [.95, .95, 1.95], BATHTUB: [1.6, .7, .6], PLANT: [.5, .5, 1.1], LAMP: [.4, .4, 1.5], REFRIGERATOR: [.65, .65, 1.8] };
export function TwinObjectEditor({ room, metadata, onChange }: { room: TwinRoomLayout; metadata: TwinDraftingMetadata; onChange: (next: TwinDraftingMetadata) => void }) {
  const [kind, setKind] = useState<TwinSceneObjectKind>('TABLE');
  const current = roomDrafting(metadata, room.roomId);
  const world = roomToWorld(room);
  const step = metadata.settings.gridMeters ?? .5;
  const objects = current.objects ?? [];
  const save = (next: typeof objects) => onChange(changeRoomDrafting(metadata, room.roomId, { ...current, objects: next.map((object) => {
    if (object.kind !== 'DOOR' && object.kind !== 'WINDOW') return object;
    const edges = current.points.map((point, index) => {
      const end = current.points[(index + 1) % current.points.length];
      const x = point.x * world.width; const z = point.y * world.depth;
      const dx = (end.x - point.x) * world.width; const dz = (end.y - point.y) * world.depth;
      const length = Math.hypot(dx, dz);
      const margin = Math.min(.49, object.width / Math.max(length, .001) / 2);
      const t = Math.max(margin, Math.min(1 - margin, ((object.x - x) * dx + (object.z - z) * dz) / Math.max(length * length, .001)));
      const projectedX = x + t * dx; const projectedZ = z + t * dz;
      return { x: projectedX, z: projectedZ, length, rotation: -Math.atan2(dz, dx) * 180 / Math.PI, distance: Math.hypot(projectedX - object.x, projectedZ - object.z) };
    }).sort((a, b) => a.distance - b.distance);
    const edge = edges[0];
    return edge ? { ...object, x: edge.x, z: edge.z, rotation: edge.rotation, width: Math.min(object.width, edge.length) } : object;
  }) }));
  return <fieldset className="space-y-3 rounded-xl border border-line bg-app p-3"><legend className="px-1 text-sm font-semibold text-text">Kiến trúc & nội thất</legend>
    <p className="text-xs text-muted">Vị trí tính từ góc trái phòng. Lưu bố cục để đồng bộ nội thất và openings vào HESTA.</p>
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
