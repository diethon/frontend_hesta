import { Box, MousePointer2 } from 'lucide-react';
import { useAppSelector } from '../../store/hooks';
import type { TwinLayoutGeometry, TwinLayoutSelection } from '../../types/twinLayout';
import { TwinDeviceCard } from './TwinDeviceCard';
import { TwinHealthBadge } from './TwinHealthBadge';
import { TwinLayoutButton } from './TwinLayoutButton';
import { TwinSensorCard } from './TwinSensorCard';
import { DeviceGlyph, RoomGlyph, SensorGlyph } from './TwinVisualIcon';
import { nodeKey } from './layoutGeometry';
import { roomFloorLevel } from './twin3dGeometry';
import { TwinContent } from './TwinContent';

export function Twin3DInspector({ geometry, selection, onSelect, onEdit2D, canEdit = false, onFocusRoom, onFitHome }: {
  geometry: TwinLayoutGeometry;
  selection: TwinLayoutSelection | null;
  onSelect: (selection: TwinLayoutSelection) => void;
  onEdit2D: () => void;
  canEdit?: boolean;
  onFocusRoom?: (id: string) => void;
  onFitHome?: () => void;
}) {
  const roomLayout = selection?.kind === 'room' ? geometry.rooms.find((room) => room.roomId === selection.id) : undefined;
  const nodeLayout = selection?.kind === 'node' ? geometry.nodes.find((node) => nodeKey(node) === selection.id) : undefined;
  const room = useAppSelector((state) => selection?.kind === 'room' ? state.twin.roomsById[selection.id] : undefined);
  const device = useAppSelector((state) => selection?.kind === 'node' && selection.id.startsWith('DEVICE:') ? state.twin.devicesById[selection.id.slice(7)] : undefined);
  const sensor = useAppSelector((state) => selection?.kind === 'node' && selection.id.startsWith('SENSOR:') ? state.twin.sensorsById[selection.id.slice(7)] : undefined);
  const devicesById = useAppSelector((state) => room ? state.twin.devicesById : undefined);
  const sensorsById = useAppSelector((state) => room ? state.twin.sensorsById : undefined);
  const businessRoom = useAppSelector((state) => {
    const id = device?.roomId ?? sensor?.roomId;
    return id ? state.twin.roomsById[id] : undefined;
  });
  const roomsById = useAppSelector((state) => !selection ? state.twin.roomsById : undefined);

  if (!selection) return <section aria-label="Chi tiết 3D" className="surface-card p-5">
    <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-info-soft text-primary-hover"><MousePointer2 size={21} aria-hidden="true" /></span><div><h3 className="font-semibold text-text">Khám phá ngôi nhà</h3><p className="text-xs text-muted">Chọn phòng hoặc marker để xem dữ liệu trực tiếp.</p></div></div>
    <p className="mt-4 text-sm leading-6 text-muted">Kéo để xoay, cuộn để thu phóng. Mô hình này được tạo từ sơ đồ 2D đã lưu, không phải bản đo kiến trúc thực tế.</p>
    <div className="mt-4 space-y-2" aria-label="Chọn phòng bằng bàn phím">{Object.values(roomsById ?? {}).map((item) => <button type="button" key={item.roomId} onClick={() => onSelect({ kind: 'room', id: item.roomId })} className="min-h-11 w-full break-words rounded-xl border border-line bg-app p-3 text-left text-sm font-semibold hover:bg-sidebar-hover">{item.name}</button>)}</div>
    <details className="mt-4 min-w-0"><summary className="cursor-pointer text-sm font-semibold text-primary-hover">Đọc tất cả dữ liệu trực tiếp</summary><div className="mt-3"><TwinContent /></div></details>
    <TwinLayoutButton leadingIcon={<Box size={18} />} onClick={onEdit2D}>{canEdit ? 'Chỉnh sửa trong 2D' : 'Xem sơ đồ 2D'}</TwinLayoutButton>
  </section>;

  if (room) {
    const devices = room.deviceIds.map((id) => devicesById?.[id]).filter((item) => item !== undefined);
    const sensors = room.sensorIds.map((id) => sensorsById?.[id]).filter((item) => item !== undefined);
    return <section aria-label={`Chi tiết phòng ${room.name}`} className="surface-card space-y-5 p-5">
      <div className="flex items-center gap-3"><RoomGlyph name={room.name} size={22} /><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wider text-muted">Phòng đang chọn</p><h3 className="break-words text-lg font-semibold text-text">{room.name}</h3><p className="mt-1 text-xs text-muted">{roomLayout ? `Tầng ${roomFloorLevel(roomLayout)}` : 'Chưa đặt vào layout'}</p></div></div>
      <div className="grid grid-cols-2 gap-2"><p className="rounded-xl bg-info-soft p-3 text-xs font-medium text-text">{room.deviceIds.length} thiết bị</p><p className="rounded-xl bg-success-soft p-3 text-xs font-medium text-text">{room.sensorIds.length} cảm biến</p></div>
      {roomLayout ? <div className="flex flex-wrap gap-2"><TwinLayoutButton onClick={() => onFocusRoom?.(room.roomId)}>Xem riêng phòng</TwinLayoutButton><TwinLayoutButton onClick={onFitHome}>Vừa ngôi nhà</TwinLayoutButton></div> : null}
      <div><h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Thiết bị</h4>{devices.length ? <div className="space-y-2">{devices.map((item) => <button key={item.deviceId} type="button" onClick={() => onSelect({ kind: 'node', id: `DEVICE:${item.deviceId}` })} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-line bg-app p-2 text-left hover:bg-sidebar-hover"><DeviceGlyph deviceType={item.deviceType} /><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-text">{item.name}</strong><small className="text-muted">{item.status}</small></span><TwinHealthBadge compact healthStatus={item.healthStatus} /></button>)}</div> : <p className="rounded-xl bg-off-soft p-3 text-sm text-muted">Chưa có thiết bị trong phòng này.</p>}</div>
      <div><h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Cảm biến</h4>{sensors.length ? <div className="space-y-2">{sensors.map((item) => <button key={item.sensorId} type="button" onClick={() => onSelect({ kind: 'node', id: `SENSOR:${item.sensorId}` })} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-line bg-app p-2 text-left hover:bg-sidebar-hover"><SensorGlyph metricType={item.metricType} /><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-text">{item.metricType}</strong><small className="text-muted">{item.latestValue ?? '—'}{item.unit ? ` ${item.unit}` : ''}</small></span><TwinHealthBadge compact healthStatus={item.healthStatus} /></button>)}</div> : <p className="rounded-xl bg-off-soft p-3 text-sm text-muted">Chưa có cảm biến trong phòng này.</p>}</div>
      <TwinLayoutButton leadingIcon={<Box size={18} />} onClick={onEdit2D}>{canEdit ? 'Chỉnh sửa trong 2D' : 'Xem sơ đồ 2D'}</TwinLayoutButton>
    </section>;
  }

  if (device) return <section aria-label={`Chi tiết thiết bị ${device.name}`} className="surface-card space-y-4 p-4">
    <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">Marker thiết bị đang chọn</p>
    <TwinDeviceCard deviceId={device.deviceId} />
    <p className="break-words text-sm text-muted">Phòng · {businessRoom?.name ?? 'Chưa gán phòng'}</p>
    {nodeLayout?.roomId ? <TwinLayoutButton onClick={() => onSelect({ kind: 'room', id: nodeLayout.roomId! })}>Xem phòng chứa marker</TwinLayoutButton> : null}
    {!nodeLayout ? <p className="text-xs text-muted">Chưa đặt vào layout</p> : null}
  </section>;

  if (sensor) return <section aria-label={`Chi tiết cảm biến ${sensor.metricType}`} className="surface-card space-y-4 p-4">
    <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">Marker cảm biến đang chọn</p>
    <TwinSensorCard sensorId={sensor.sensorId} />
    <p className="break-words text-sm text-muted">Phòng · {businessRoom?.name ?? 'Chưa gán phòng'}</p>
    {nodeLayout?.roomId ? <TwinLayoutButton onClick={() => onSelect({ kind: 'room', id: nodeLayout.roomId! })}>Xem phòng chứa marker</TwinLayoutButton> : null}
    {!nodeLayout ? <p className="text-xs text-muted">Chưa đặt vào layout</p> : null}
  </section>;

  return <section role="status" className="surface-card p-5"><p className="font-semibold text-text">Đối tượng không còn trong dữ liệu hiện tại.</p><button type="button" className="mt-3 text-sm font-semibold text-primary-hover" onClick={onEdit2D}>Quay lại chế độ 2D</button></section>;
}
