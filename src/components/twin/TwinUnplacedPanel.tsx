import { useState } from 'react';
import { GripVertical, Search } from 'lucide-react';
import { useAppSelector } from '../../store/hooks';
import type { TwinLayoutGeometry } from '../../types/twinLayout';
import { defaultRoom, nodeKey } from './layoutGeometry';
import { PALETTE_MIME, placePaletteItem, type PaletteItem } from './layoutPalette';
import { DeviceGlyph, RoomGlyph, SensorGlyph } from './TwinVisualIcon';

export function TwinUnplacedPanel({ geometry, disabled, onChange }: { geometry: TwinLayoutGeometry; disabled: boolean; onChange: (geometry: TwinLayoutGeometry) => void }) {
  const [activeTab, setActiveTab] = useState<PaletteItem['kind']>('room');
  const [search, setSearch] = useState('');
  const twin = useAppSelector((state) => state.twin);
  const placedRooms = new Set(geometry.rooms.map((room) => room.roomId));
  const placedNodes = new Set(geometry.nodes.map(nodeKey));
  const items = [
    ...twin.roomIds.filter((id) => !placedRooms.has(id)).map((id) => ({ kind: 'room' as const, id, name: twin.roomsById[id].name, detail: 'Phòng', icon: <RoomGlyph name={twin.roomsById[id].name} /> })),
    ...twin.deviceIds.filter((id) => !placedNodes.has(`DEVICE:${id}`)).map((id) => ({ kind: 'DEVICE' as const, id, name: twin.devicesById[id].name, detail: 'Thiết bị', icon: <DeviceGlyph deviceType={twin.devicesById[id].deviceType} /> })),
    ...twin.sensorIds.filter((id) => !placedNodes.has(`SENSOR:${id}`)).map((id) => ({ kind: 'SENSOR' as const, id, name: `${twin.sensorsById[id].metricType} · ${twin.devicesById[twin.sensorsById[id].deviceId]?.name ?? 'Cảm biến'}`, detail: 'Cảm biến', icon: <SensorGlyph metricType={twin.sensorsById[id].metricType} /> })),
  ];
  const filtered = items.filter((item) => item.kind === activeTab && item.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <section aria-label="Chưa đặt" className="surface-card space-y-4 p-4">
    <h3 className="font-semibold text-text">Đối tượng chưa đặt</h3>
    <label className="relative block"><span className="sr-only">Tìm đối tượng chưa đặt</span><Search aria-hidden="true" size={17} className="absolute left-3 top-3.5 text-muted" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm phòng, thiết bị, cảm biến…" className="min-h-11 w-full rounded-lg border border-line bg-app pl-9 pr-3 text-sm text-text" /></label>
    <div aria-label="Nhóm đối tượng chưa đặt" className="grid grid-cols-3 gap-1 rounded-lg bg-sidebar p-1">
      {([['room', 'Phòng'], ['DEVICE', 'Thiết bị'], ['SENSOR', 'Cảm biến']] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={activeTab === id} onClick={() => setActiveTab(id)} className={`min-h-11 rounded-lg px-1 text-xs font-semibold ${activeTab === id ? 'bg-surface text-primary-hover shadow-soft' : 'text-muted hover:text-text'}`}>{label}</button>)}
    </div>
    <div className="max-h-80 space-y-2 overflow-y-auto">
      {filtered.map((item) => <button key={item.id} type="button" disabled={disabled} draggable={!disabled} aria-label={`Đặt ${item.name}`}
        onDragStart={(event) => { event.dataTransfer.setData(PALETTE_MIME, JSON.stringify({ kind: item.kind, id: item.id })); event.dataTransfer.effectAllowed = 'copy'; }}
        onClick={() => { const point = item.kind === 'room' ? defaultRoom(item.id, geometry.rooms.length) : { x: 0.5, y: 0.5 }; onChange(placePaletteItem(geometry, item, point.x, point.y)); }}
        className="flex min-h-14 w-full items-center gap-3 rounded-lg border border-line bg-app p-2 text-left disabled:opacity-50">
        {item.icon}<span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-text">+ {item.name}</span><span className="block text-xs text-muted">{item.detail}</span></span><GripVertical size={16} aria-hidden="true" className="shrink-0 text-icon" />
      </button>)}
      {!filtered.length ? <p role="status" className="py-3 text-sm text-muted">{search ? 'Không tìm thấy đối tượng phù hợp.' : 'Đã đặt tất cả đối tượng trong nhóm.'}</p> : null}
    </div>
    <p className="text-xs text-muted">Kéo vào sơ đồ hoặc bấm để đặt, rồi chỉnh vị trí.</p>
  </section>;
}
