import { House, Info } from 'lucide-react';
import { useAppSelector } from '../../../store/hooks';
import type { TwinLayoutGeometry } from '../../../types/twinLayout';
import { roomFloorLevel } from '../twin3dGeometry';
import { deviceHealthCounts } from './twinDashboardData';

export function TwinRoomInfo({ roomId, geometry }: { roomId: string | null; geometry: TwinLayoutGeometry }) {
  const room = useAppSelector((state) => roomId ? state.twin.roomsById[roomId] : undefined);
  const devices = useAppSelector((state) => state.twin.devicesById);
  const sensors = useAppSelector((state) => state.twin.sensorsById);
  const layout = geometry.rooms.find((item) => item.roomId === roomId);
  const health = deviceHealthCounts(Object.values(devices).filter((device) => device.roomId === roomId));
  const sensorCount = Object.values(sensors).filter((sensor) => sensor.roomId === roomId).length;
  return <section aria-label="Thông tin phòng" className="rounded-2xl border border-line bg-surface p-4">
    <h2 className="flex items-center gap-2 text-sm font-semibold text-text"><Info size={17} className="text-primary-hover" aria-hidden="true" />Thông tin phòng</h2>
    {room ? <dl className="mt-3 divide-y divide-line text-xs">{[
      { label: 'Tên phòng', value: room.name },
      { label: 'Tầng', value: layout ? `Tầng ${roomFloorLevel(layout)}` : 'Chưa bố trí' },
      { label: 'Số thiết bị', value: `${health.total} thiết bị` },
      { label: 'Đang bật', value: `${health.on} thiết bị` },
      { label: 'Cảm biến', value: `${sensorCount} cảm biến` },
    ].map(({ label, value }) => <div key={label} className="grid grid-cols-2 gap-3 py-2.5"><dt className="text-muted">{label}</dt><dd className="min-w-0 break-words font-medium text-text">{value}</dd></div>)}</dl> : <div className="mt-3 flex items-start gap-2 rounded-xl bg-app p-3 text-xs leading-5 text-muted"><House size={16} className="mt-0.5 shrink-0 text-icon" aria-hidden="true" /><p>Chọn một phòng trên sơ đồ hoặc danh sách để xem thông tin.</p></div>}
  </section>;
}
