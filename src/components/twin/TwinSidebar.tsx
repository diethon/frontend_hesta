import { useAppSelector } from '../../store/hooks';
import type { TwinLayoutGeometry, TwinLayoutSelection } from '../../types/twinLayout';
import { layoutFloors, roomFloorLevel } from './twin3dGeometry';

function RoomEntry({ id, selection, onFocus }: { id: string; selection: TwinLayoutSelection | null; onFocus: (selection: TwinLayoutSelection) => void }) {
  const room = useAppSelector((state) => state.twin.roomsById[id]);
  if (!room) return null;
  return <div className="space-y-1"><button type="button" aria-pressed={selection?.kind === 'room' && selection.id === id} onClick={() => onFocus({ kind: 'room', id })} className="min-h-11 w-full rounded-xl px-3 text-left text-sm font-semibold text-text hover:bg-sidebar-hover">{room.name}</button>
    {room.deviceIds.map((deviceId) => <DeviceEntry key={deviceId} id={deviceId} selection={selection} onFocus={onFocus} />)}
    {!room.deviceIds.length ? <p className="pl-6 text-xs text-muted">Chưa có thiết bị</p> : null}
  </div>;
}
function DeviceEntry({ id, selection, onFocus }: { id: string; selection: TwinLayoutSelection | null; onFocus: (selection: TwinLayoutSelection) => void }) {
  const device = useAppSelector((state) => state.twin.devicesById[id]);
  if (!device) return null;
  return <button type="button" aria-pressed={selection?.kind === 'node' && selection.id === `DEVICE:${id}`} onClick={() => onFocus({ kind: 'node', id: `DEVICE:${id}` })} className="flex min-h-11 w-full items-center gap-2 rounded-lg pl-6 pr-3 text-left text-xs text-muted hover:bg-sidebar-hover"><span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${device.status === 'ONLINE' && device.healthStatus === 'ACTIVE' ? 'bg-success' : 'bg-off'}`} /><span className="min-w-0 break-words">{device.name}</span></button>;
}
export function TwinSidebar({ geometry, selection, onFocus }: { geometry: TwinLayoutGeometry; selection: TwinLayoutSelection | null; onFocus: (selection: TwinLayoutSelection) => void }) {
  const name = useAppSelector((state) => state.twin.home?.name);
  return <details open className="surface-card p-4"><summary className="min-h-11 cursor-pointer text-sm font-semibold text-text">{name ?? 'Ngôi nhà'} · Phòng & thiết bị</summary>
    <nav aria-label="Cây phòng và thiết bị" className="max-h-80 space-y-3 overflow-y-auto">{layoutFloors(geometry.rooms).map((floor) => <details key={floor} open><summary className="min-h-11 cursor-pointer pt-3 text-xs font-semibold text-muted">Tầng {floor}</summary>{geometry.rooms.filter((room) => roomFloorLevel(room) === floor).map((room) => <RoomEntry key={room.roomId} id={room.roomId} selection={selection} onFocus={onFocus} />)}</details>)}</nav>
  </details>;
}
