import { useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { useAppSelector } from '../../store/hooks';
import type { TwinLayoutGeometry, TwinLayoutSelection } from '../../types/twinLayout';
import { nodeKey } from './layoutGeometry';
import { DeviceGlyph, RoomGlyph, SensorGlyph } from './TwinVisualIcon';
import { sensorVisualKind } from './twinPresentation';

const sensorNames: Record<string, string> = { temperature: 'nhiệt độ', humidity: 'độ ẩm', light: 'ánh sáng', motion: 'chuyển động', air: 'không khí', gas: 'CO₂', smoke: 'khói' };
const sensorLabel = (metric: string) => {
  const kind = sensorVisualKind(metric.replace(/_SENSOR$/i, ''));
  return sensorNames[kind] ? `Cảm biến ${sensorNames[kind]}` : metric;
};

export function TwinRoomPanel({ geometry, saved, floor, selection, onSelect }: {
  geometry: TwinLayoutGeometry;
  saved: TwinLayoutGeometry | null;
  floor?: number;
  selection: TwinLayoutSelection | null;
  onSelect: (selection: TwinLayoutSelection) => void;
}) {
  const [search, setSearch] = useState('');
  const twin = useAppSelector((state) => state.twin);
  const savedNodes = new Map(saved?.nodes.map((node) => [nodeKey(node), node]));
  const rooms = geometry.rooms.filter((room) => floor === undefined || (room.floor ?? 1) === floor);
  const unassigned = twin.deviceIds.filter((id) => !twin.devicesById[id].roomId || !twin.roomsById[twin.devicesById[id].roomId!]);
  const query = search.trim().toLocaleLowerCase();
  const selectedRoomId = selection?.kind === 'room' ? selection.id : geometry.nodes.find((node) => nodeKey(node) === selection?.id)?.roomId;
  const labelOf = (node: TwinLayoutGeometry['nodes'][number]) => node.nodeType === 'DEVICE' ? twin.devicesById[node.nodeId]?.name ?? 'Thiết bị' : sensorLabel(twin.sensorsById[node.nodeId]?.metricType ?? 'Cảm biến');
  return <section aria-label="Phòng và thiết bị hiện có" className="surface-card space-y-3 p-4">
    <h3 className="font-semibold text-text">Phòng và thiết bị</h3>
    <label className="relative block">
      <span className="sr-only">Tìm phòng, thiết bị</span>
      <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm phòng, thiết bị…" className="min-h-10 w-full rounded-xl border border-line bg-app pl-9 pr-3 text-sm text-text placeholder:text-muted" />
    </label>
    <div className="max-h-96 space-y-1 overflow-y-auto">
      {rooms.map((room) => {
        const name = twin.roomsById[room.roomId]?.name ?? 'Phòng';
        const nodes = geometry.nodes.filter((node) => node.roomId === room.roomId);
        const roomMatches = name.toLocaleLowerCase().includes(query);
        const matching = query && !roomMatches ? nodes.filter((node) => labelOf(node).toLocaleLowerCase().includes(query)) : nodes;
        if (query && !roomMatches && !matching.length) return null;
        const expanded = !!query || selectedRoomId === room.roomId;
        const deviceCount = nodes.filter((node) => node.nodeType === 'DEVICE').length;
        const sensorCount = nodes.length - deviceCount;
        return <div key={room.roomId} className={`rounded-xl ${expanded ? 'border border-line p-1' : ''}`}>
          <button type="button" aria-pressed={selection?.kind === 'room' && selection.id === room.roomId} aria-expanded={expanded} onClick={() => onSelect({ kind: 'room', id: room.roomId })} className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-semibold text-text hover:bg-sidebar-hover ${selectedRoomId === room.roomId ? 'bg-info-soft' : ''}`}>
            <RoomGlyph name={name} size={18} />
            <span className="min-w-0 flex-1 truncate">{name}</span>
            <small className="shrink-0 font-normal text-muted">{deviceCount} thiết bị{sensorCount ? ` · ${sensorCount} cảm biến` : ''}</small>
            <ChevronRight size={14} aria-hidden="true" className={`shrink-0 text-muted transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
          {expanded ? <div className="mt-1 space-y-0.5 pl-6">
            {matching.map((node) => {
              const key = nodeKey(node);
              const device = node.nodeType === 'DEVICE' ? twin.devicesById[node.nodeId] : undefined;
              const sensor = node.nodeType === 'SENSOR' ? twin.sensorsById[node.nodeId] : undefined;
              const pending = savedNodes.get(key)?.roomId !== room.roomId;
              return <button type="button" key={key} aria-pressed={selection?.kind === 'node' && selection.id === key} onClick={() => onSelect({ kind: 'node', id: key })} title={pending ? 'Chưa căn chỉnh · Vị trí đang được tự xếp' : undefined} className={`flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-xs text-text hover:bg-sidebar-hover ${selection?.kind === 'node' && selection.id === key ? 'bg-info-soft font-semibold' : ''}`}>
                {device ? <DeviceGlyph deviceType={device.deviceType} name={device.name} size={16} /> : <SensorGlyph metricType={sensor?.metricType ?? ''} size={16} />}
                <span className="min-w-0 flex-1 truncate">{labelOf(node)}</span>
                {pending ? <span className="shrink-0 rounded-full bg-warning-soft px-1.5 text-[10px] text-text">Tự xếp</span> : null}
              </button>;
            })}
            {!nodes.length ? <p className="px-2 py-1 text-xs text-muted">Phòng chưa có thiết bị.</p> : null}
          </div> : null}
        </div>;
      })}
      {query && !rooms.some((room) => (twin.roomsById[room.roomId]?.name ?? '').toLocaleLowerCase().includes(query) || geometry.nodes.some((node) => node.roomId === room.roomId && labelOf(node).toLocaleLowerCase().includes(query))) ? <p className="px-2 py-2 text-xs text-muted">Không tìm thấy “{search.trim()}”.</p> : null}
    </div>
    {unassigned.length ? <div className="rounded-xl bg-warning-soft p-3 text-sm text-text"><p className="font-semibold">Chưa có phòng · {unassigned.length} thiết bị</p><ul className="mt-2 space-y-1">{unassigned.map((id) => <li key={id}>{twin.devicesById[id].name}</li>)}</ul><p className="mt-2 text-xs text-muted">Gán phòng tại trang Thiết bị rồi đồng bộ lại Digital Twin.</p></div> : null}
  </section>;
}
