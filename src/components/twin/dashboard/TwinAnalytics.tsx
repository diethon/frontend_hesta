import { useMemo } from 'react';
import { Activity, Cpu, Droplets, Sun, Thermometer } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAppSelector } from '../../../store/hooks';
import type { TwinSensorSnapshotResponse } from '../../../types/twin';
import { TwinTime } from '../TwinTime';
import { deviceHealthCounts, latestDashboardMetric } from './twinDashboardData';

function MetricCard({ title, Icon, sensor, roomName, motion = false }: {
  title: string; Icon: LucideIcon; sensor?: TwinSensorSnapshotResponse; roomName?: string; motion?: boolean;
}) {
  return <article className="min-w-0 rounded-2xl border border-line bg-surface p-4 shadow-soft" aria-label={title}>
    <div className="flex items-center justify-between gap-2"><h3 className="text-xs font-semibold text-muted">{title}</h3><Icon size={17} className="text-icon" aria-hidden="true" /></div>
    <p className="mt-3 truncate text-2xl font-semibold tracking-tight text-text">{sensor ? motion ? sensor.latestValue === 1 ? 'Có chuyển động' : 'Không phát hiện' : <>{new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(sensor.latestValue!)}<span className="ml-1 text-sm font-medium text-muted">{sensor.unit}</span></> : '—'}</p>
    <p className="mt-1 truncate text-xs text-muted">{sensor ? roomName ?? 'Chưa gán phòng' : 'Chưa có dữ liệu cảm biến phù hợp'}</p>
    {sensor ? <div className="mt-3 space-y-1 text-xs text-muted"><p>{sensor.healthStatus === 'ACTIVE' ? 'Bản ghi mới nhất' : sensor.healthStatus === 'OFFLINE' ? 'Bản ghi cuối · Ngoại tuyến' : 'Bản ghi cuối · Dữ liệu đã cũ'}</p><TwinTime value={sensor.observedAt} /></div> : <p className="mt-3 text-xs text-muted">Đang chờ dữ liệu từ HESTA</p>}
  </article>;
}

export function TwinAnalytics({ roomId = null, scopeRoomIds, scopeName }: { roomId?: string | null; scopeRoomIds?: readonly string[]; scopeName?: string }) {
  const devicesById = useAppSelector((state) => state.twin.devicesById);
  const sensorsById = useAppSelector((state) => state.twin.sensorsById);
  const roomsById = useAppSelector((state) => state.twin.roomsById);
  const scopeRooms = useMemo(() => scopeRoomIds ? new Set(scopeRoomIds) : null, [scopeRoomIds]);
  const sensors = useMemo(() => Object.values(sensorsById).filter((sensor) => roomId ? sensor.roomId === roomId : !scopeRooms || sensor.roomId !== null && scopeRooms.has(sensor.roomId)), [sensorsById, roomId, scopeRooms]);
  const health = useMemo(() => deviceHealthCounts(Object.values(devicesById).filter((device) => roomId ? device.roomId === roomId : !scopeRooms || device.roomId !== null && scopeRooms.has(device.roomId))), [devicesById, roomId, scopeRooms]);
  const visibleScope = roomId ? roomsById[roomId]?.name : scopeName;
  const metrics = [{ key: 'temperature', title: 'Nhiệt độ', Icon: Thermometer }, { key: 'humidity', title: 'Độ ẩm', Icon: Droplets }, { key: 'light', title: 'Ánh sáng', Icon: Sun }, { key: 'motion', title: 'Chuyển động', Icon: Activity }] as const;
  return <section aria-label="Thống kê ngôi nhà" className="twin-dashboard-analytics min-w-0 rounded-2xl border border-line bg-surface p-3">
    <header className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1"><div><h2 className="text-sm font-semibold text-text">Chỉ số môi trường</h2><p className="mt-1 text-xs text-muted">{visibleScope ? `${visibleScope} · Dữ liệu trong phạm vi đang chọn` : 'Toàn bộ ngôi nhà · Bản ghi cảm biến mới nhất'}</p></div><span className="rounded-lg bg-info-soft px-2 py-1 text-xs text-primary-hover">{sensors.length} cảm biến</span></header>
    <div className="twin-metric-grid grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
    {metrics.map(({ key, title, Icon }) => {
      const sensor = latestDashboardMetric(sensors, key);
      return <MetricCard key={key} title={title} Icon={Icon} sensor={sensor} roomName={sensor?.roomId ? roomsById[sensor.roomId]?.name : undefined} motion={key === 'motion'} />;
    })}
    <article aria-label="Sức khỏe thiết bị" className="min-w-0 rounded-2xl border border-line bg-surface p-4 shadow-soft"><div className="flex items-center justify-between gap-2"><h3 className="text-xs font-semibold text-muted">Sức khỏe thiết bị</h3><Cpu size={17} className="text-icon" aria-hidden="true" /></div><p className="mt-3 text-2xl font-semibold tracking-tight text-text">{health.online}<span className="ml-1 text-sm font-medium text-muted">/ {health.total} trực tuyến</span></p><dl className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><dt className="text-muted">Đang bật</dt><dd className="font-semibold text-success">{health.on}</dd></div><div><dt className="text-muted">Đang tắt</dt><dd className="font-semibold text-text">{health.off}</dd></div><div><dt className="text-muted">Ngoại tuyến</dt><dd className="font-semibold text-off">{health.offline}</dd></div><div><dt className="text-muted">Cảnh báo</dt><dd className="font-semibold text-warning">{health.warning}</dd></div></dl>{health.unknown ? <p className="mt-2 text-xs text-muted">{health.unknown} thiết bị đang chờ trạng thái nguồn mới</p> : null}</article>
    </div>
  </section>;
}
