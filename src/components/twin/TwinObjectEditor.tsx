import { useEffect, useRef, useState } from 'react';
import { ChevronRight, RotateCw, Search, Trash2 } from 'lucide-react';
import type { TwinRoomLayout } from '../../types/twinLayout';
import { changeRoomDrafting, roomDrafting, sceneObjectKinds, snapMeters, type TwinDraftingMetadata, type TwinSceneObjectKind } from './twinDrafting';
import { roomToWorld } from './twin3dGeometry';
import { TwinLayoutButton } from './TwinLayoutButton';
import { attachOpening, sceneObjectLabels as labels } from './twinObjectPlacement';

const sizes: Partial<Record<TwinSceneObjectKind, [number, number, number]>> = { BED: [1.6, 2.1, .85], SOFA: [2.4, .9, .85], CHAIR: [.45, .5, .9], DESK: [1.2, .6, .75], TV_STAND: [1.8, .45, .5], WARDROBE: [1.4, .6, 1.9], KITCHEN_COUNTER: [1.8, .6, .9], SINK: [.9, .6, .9], TOILET: [.4, .7, .78], SHOWER: [.95, .95, 1.95], BATHTUB: [1.6, .7, .6], PLANT: [.5, .5, 1.1], LAMP: [.4, .4, 1.5], REFRIGERATOR: [.65, .65, 1.8] };
// Two compact rows: position + rotation, then size.
const fields = ['x', 'z', 'rotation', 'width', 'depth', 'height'] as const;
const fieldLabels = { x: 'Ngang (m)', z: 'Dọc (m)', rotation: 'Xoay (°)', width: 'Rộng (m)', depth: 'Sâu (m)', height: 'Cao (m)' };
const SEARCH_FROM = 6;
const round = (value: number) => Math.round(value * 100) / 100;

export function TwinObjectEditor({ room, metadata, onChange, openId, onOpen }: {
  room: TwinRoomLayout;
  metadata: TwinDraftingMetadata;
  onChange: (next: TwinDraftingMetadata) => void;
  /** Shared with the 2D plan: the object highlighted there is the one open here. */
  openId: string | null;
  onOpen: (id: string | null) => void;
}) {
  const [kind, setKind] = useState<TwinSceneObjectKind>('TABLE');
  const [search, setSearch] = useState('');
  const list = useRef<HTMLUListElement>(null);
  const current = roomDrafting(metadata, room.roomId);
  const world = roomToWorld(room);
  const step = metadata.settings.gridMeters ?? .5;
  const objects = current.objects ?? [];
  const save = (next: typeof objects) => onChange(changeRoomDrafting(metadata, room.roomId, { ...current, objects: next.map(object => attachOpening(object, current, world.width, world.depth)) }));
  const add = () => {
    const size = sizes[kind] ?? [1, kind === 'WALL' || kind === 'DOOR' || kind === 'WINDOW' ? .12 : .75, kind === 'DOOR' || kind === 'WALL' ? 2 : kind === 'WINDOW' ? 1 : .7];
    const id = crypto.randomUUID();
    save([...objects, { id, kind, x: snapMeters(world.width / 2, step), z: snapMeters(world.depth / 2, step), width: Math.min(size[0], world.width), depth: Math.min(size[1], world.depth), height: size[2], rotation: 0 }]);
    setSearch('');
    onOpen(id);
  };
  const remove = (id: string) => { save(objects.filter((item) => item.id !== id)); if (openId === id) onOpen(null); };
  const patch = (id: string, values: Partial<(typeof objects)[number]>) => save(objects.map((item) => item.id === id ? { ...item, ...values } : item));

  // Names like "Cây 2" so identical items can be told apart in the list and on the plan.
  const totals: Record<string, number> = {};
  for (const object of objects) totals[object.kind] = (totals[object.kind] ?? 0) + 1;
  const seen: Record<string, number> = {};
  const named = objects.map((object) => {
    seen[object.kind] = (seen[object.kind] ?? 0) + 1;
    return { object, name: totals[object.kind] > 1 ? `${labels[object.kind]} ${seen[object.kind]}` : labels[object.kind] };
  });
  const query = search.trim().toLocaleLowerCase();
  const visible = query ? named.filter(({ object, name }) => object.id === openId || name.toLocaleLowerCase().includes(query)) : named;

  useEffect(() => {
    if (openId) list.current?.querySelector(`[data-object-row="${CSS.escape(openId)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [openId]);

  return <fieldset className="space-y-3 rounded-xl border border-line bg-app p-3"><legend className="px-1 text-sm font-semibold text-text">Kiến trúc & nội thất{objects.length ? <span className="ml-1 font-normal text-muted">· {objects.length}</span> : null}</legend>
    <p className="text-xs text-muted">Bấm đồ vật trên sơ đồ hoặc trong danh sách để chọn. Đồ vật đang chọn có viền xanh trên sơ đồ.</p>
    <label className="flex min-h-11 items-center gap-2 text-xs text-muted"><input type="checkbox" checked={current.autoFurniture !== false} onChange={(event) => onChange(changeRoomDrafting(metadata, room.roomId, { ...current, autoFurniture: event.target.checked }))} />Tự thêm nội thất minh họa theo loại phòng</label>
    <div className="flex gap-2">
      <select aria-label="Loại đồ vật muốn thêm" value={kind} onChange={(event) => setKind(event.target.value as TwinSceneObjectKind)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-sm text-text">{sceneObjectKinds.map((item) => <option key={item} value={item}>{labels[item]}</option>)}</select>
      <TwinLayoutButton onClick={add}>Thêm {labels[kind].toLowerCase()}</TwinLayoutButton>
    </div>
    {objects.length >= SEARCH_FROM ? <label className="relative block">
      <span className="sr-only">Tìm đồ vật trong phòng</span>
      <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm đồ vật…" className="min-h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm text-text placeholder:text-muted" />
    </label> : null}
    {objects.length ? <ul ref={list} aria-label="Đồ vật trong phòng" className="max-h-80 divide-y divide-line overflow-y-auto overflow-x-hidden rounded-xl border border-line bg-surface">
      {visible.map(({ object, name }) => {
        const open = openId === object.id;
        return <li key={object.id} data-object-row={object.id} className={open ? 'bg-info-soft' : ''}>
          <div className="flex items-center gap-1 pr-1">
            <button type="button" aria-expanded={open} onClick={() => onOpen(open ? null : object.id)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 px-3 text-left text-xs font-semibold text-text hover:text-primary-hover">
              <ChevronRight size={14} aria-hidden="true" className={`shrink-0 text-muted transition-transform ${open ? 'rotate-90' : ''}`} />
              <span className="min-w-0 flex-1 truncate">{name}</span>
              <span className="shrink-0 font-normal tabular-nums text-muted">{round(object.width)} × {round(object.depth)} m</span>
            </button>
            <button type="button" aria-label={`Xóa ${name.toLowerCase()}`} title={`Xóa ${name.toLowerCase()}`} onClick={() => remove(object.id)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-error hover:bg-error-soft"><Trash2 size={15} aria-hidden="true" /></button>
          </div>
          {open ? <div className="space-y-2 px-3 pb-3">
            <p className="text-[11px] text-muted">Kéo trên sơ đồ để di chuyển, hoặc chọn rồi dùng phím mũi tên. Nhập số để chỉnh chính xác.</p>
            <div className="grid grid-cols-3 gap-2">{fields.map((field) => <label key={field} className="min-w-0 text-[11px] text-muted">{fieldLabels[field]}<input type="number" step={field === 'rotation' ? 15 : field === 'x' || field === 'z' ? step : .05} min={field === 'rotation' ? -360 : 0} value={round(object[field])} onChange={(event) => {
              let value = event.target.valueAsNumber;
              if (!Number.isFinite(value)) return;
              if (field === 'x' || field === 'z') value = Math.max(0, Math.min(field === 'x' ? world.width : world.depth, snapMeters(value, step)));
              else if (field === 'rotation') value = Math.round(value / 15) * 15;
              else value = Math.max(.05, Math.min(10, value));
              patch(object.id, { [field]: value });
            }} className="mt-0.5 h-9 w-full rounded-lg border border-line bg-surface px-2 text-xs tabular-nums text-text" /></label>)}</div>
            <div className="flex gap-2">
              <button type="button" onClick={() => patch(object.id, { rotation: (object.rotation + 90) % 360 })} className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface text-xs font-semibold text-text hover:bg-sidebar-hover"><RotateCw size={14} aria-hidden="true" />Xoay 90°</button>
              <button type="button" onClick={() => remove(object.id)} className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface text-xs font-semibold text-error hover:bg-error-soft"><Trash2 size={14} aria-hidden="true" />Xóa</button>
            </div>
          </div> : null}
        </li>;
      })}
      {!visible.length ? <li className="px-3 py-2 text-xs text-muted">Không có đồ vật khớp “{search.trim()}”.</li> : null}
    </ul> : <p className="rounded-xl border border-dashed border-line px-3 py-2 text-xs text-muted">Chưa có đồ vật tự thêm trong phòng này.</p>}
  </fieldset>;
}
