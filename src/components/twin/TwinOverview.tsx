import { useAppSelector } from '../../store/hooks';
import { selectTwinHealthCounts } from '../../store/twinSelectors';
import type { TwinLayoutGeometry } from '../../types/twinLayout';
import { TwinContent } from './TwinContent';
import { resolveUnplacedNodes } from './twin3dGeometry';

export function TwinOverview({ geometry }: { geometry: TwinLayoutGeometry | null }) {
  const home = useAppSelector((state) => state.twin.home);
  const rooms = useAppSelector((state) => state.twin.roomIds);
  const devices = useAppSelector((state) => state.twin.deviceIds);
  const sensors = useAppSelector((state) => state.twin.sensorIds);
  const health = useAppSelector(selectTwinHealthCounts);
  const connected = useAppSelector((state) => state.realtime.status === 'connected' && state.realtime.activeHomeId === state.twin.homeId);
  const unplaced = geometry ? resolveUnplacedNodes(geometry, devices, sensors) : null;
  const unplacedRooms = geometry ? rooms.filter((id) => !geometry.rooms.some((room) => room.roomId === id)).length : 0;
  const stats = [
    ['Phòng', rooms.length], ['Thiết bị', devices.length], ['Cảm biến', sensors.length],
    ['A · ACTIVE', health.ACTIVE], ['! · STALE', health.STALE], ['× · OFFLINE', health.OFFLINE],
    ['Chưa đặt', unplaced ? unplacedRooms + unplaced.deviceIds.length + unplaced.sensorIds.length : '—'],
  ] as const;
  return <section aria-label="Overview" className="space-y-5">
    <div className="surface-card p-5"><h2 className="break-words text-xl font-semibold">{home?.name}</h2><p className="mt-2 text-sm text-muted">Realtime · {connected ? 'Đã kết nối' : 'Đang hiển thị dữ liệu gần nhất'}</p>
      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{stats.map(([label, value]) => <div key={label} className="rounded-xl bg-app p-4"><dt className="text-xs text-muted">{label}</dt><dd className="mt-2 text-2xl font-semibold text-text">{value}</dd></div>)}</dl>
    </div>
    <TwinContent />
  </section>;
}
