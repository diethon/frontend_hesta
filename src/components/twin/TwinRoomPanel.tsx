import { useState } from 'react';
import { useAppSelector } from '../../store/hooks';
import type { TwinLayoutGeometry, TwinLayoutSelection } from '../../types/twinLayout';
import { nodeKey } from './layoutGeometry';
import { DeviceGlyph, RoomGlyph, SensorGlyph } from './TwinVisualIcon';

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
  return <section aria-label="Phòng và thiết bị hiện có" className="surface-card space-y-3 p-4">
    <h3 className="font-semibold text-text">Phòng và thiết bị</h3>
    <p className="text-xs text-muted">Dữ liệu tự đồng bộ từ ngôi nhà. Chọn phòng hoặc thiết bị để căn chỉnh trên sơ đồ.</p>
    <label className="block text-sm text-muted">Tìm phòng, thiết bị
      <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-app px-3 text-sm text-text" />
    </label>
    <div className="max-h-96 space-y-3 overflow-y-auto">
      {rooms.map((room) => {
        const name = twin.roomsById[room.roomId]?.name ?? 'Phòng';
        const nodes = geometry.nodes.filter((node) => node.roomId === room.roomId);
        const matching = nodes.filter((node) => {
          const label = node.nodeType === 'DEVICE' ? twin.devicesById[node.nodeId]?.name : twin.sensorsById[node.nodeId]?.metricType;
          return name.toLocaleLowerCase().includes(query) || label?.toLocaleLowerCase().includes(query);
        });
        if (query && !name.toLocaleLowerCase().includes(query) && !matching.length) return null;
        return <div key={room.roomId} className="space-y-1 rounded-xl border border-line p-2">
          <button type="button" aria-pressed={selection?.kind === 'room' && selection.id === room.roomId} onClick={() => onSelect({ kind: 'room', id: room.roomId })} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-semibold text-text hover:bg-sidebar-hover">
            <RoomGlyph name={name} size={18} /><span>{name}<small className="block font-normal text-muted">Tầng {room.floor ?? 1} · {nodes.filter((node) => node.nodeType === 'DEVICE').length} thiết bị</small></span>
          </button>
          {matching.map((node) => {
            const key = nodeKey(node);
            const device = node.nodeType === 'DEVICE' ? twin.devicesById[node.nodeId] : undefined;
            const sensor = node.nodeType === 'SENSOR' ? twin.sensorsById[node.nodeId] : undefined;
            const pending = savedNodes.get(key)?.roomId !== room.roomId;
            return <button type="button" key={key} aria-pressed={selection?.kind === 'node' && selection.id === key} onClick={() => onSelect({ kind: 'node', id: key })} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-xs text-text hover:bg-sidebar-hover">
              {device ? <DeviceGlyph deviceType={device.deviceType} size={17} /> : <SensorGlyph metricType={sensor?.metricType ?? ''} size={17} />}
              <span className="min-w-0 flex-1"><span className="block truncate">{device?.name ?? sensor?.metricType ?? 'Cảm biến'}</span>{pending ? <small className="text-muted">Chưa căn chỉnh · Vị trí tự xếp</small> : null}</span>
            </button>;
          })}
          {!nodes.length ? <p className="px-2 py-1 text-xs text-muted">Phòng chưa có thiết bị.</p> : null}
        </div>;
      })}
    </div>
    {unassigned.length ? <div className="rounded-xl bg-warning-soft p-3 text-sm text-text"><p className="font-semibold">Chưa có phòng · {unassigned.length} thiết bị</p><ul className="mt-2 space-y-1">{unassigned.map((id) => <li key={id}>{twin.devicesById[id].name}</li>)}</ul><p className="mt-2 text-xs text-muted">Gán phòng tại trang Thiết bị rồi đồng bộ lại Digital Twin.</p></div> : null}
  </section>;
}
