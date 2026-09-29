import { Box, MousePointer2 } from 'lucide-react';
import { useAppSelector } from '../../store/hooks';
import type { TwinLayoutGeometry, TwinLayoutSelection } from '../../types/twinLayout';
import { TwinDeviceCard } from './TwinDeviceCard';
import { TwinHealthBadge } from './TwinHealthBadge';
import { TwinLayoutButton } from './TwinLayoutButton';
import { TwinSensorCard } from './TwinSensorCard';
import { DeviceGlyph, RoomGlyph, SensorGlyph } from './TwinVisualIcon';
import { nodeKey } from './layoutGeometry';

export function Twin3DInspector({ geometry, selection, onSelect, onEdit2D }: {
  geometry: TwinLayoutGeometry;
  selection: TwinLayoutSelection | null;
  onSelect: (selection: TwinLayoutSelection) => void;
  onEdit2D: () => void;
}) {
  const twin = useAppSelector((state) => state.twin);
  const roomLayout = selection?.kind === 'room' ? geometry.rooms.find((room) => room.roomId === selection.id) : undefined;
  const nodeLayout = selection?.kind === 'node' ? geometry.nodes.find((node) => nodeKey(node) === selection.id) : undefined;
  const room = roomLayout ? twin.roomsById[roomLayout.roomId] : undefined;
  const device = nodeLayout?.nodeType === 'DEVICE' ? twin.devicesById[nodeLayout.nodeId] : undefined;
  const sensor = nodeLayout?.nodeType === 'SENSOR' ? twin.sensorsById[nodeLayout.nodeId] : undefined;

  if (!selection) return <section aria-label="Chi tiết 3D" className="surface-card p-5">
    <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-info-soft text-primary-hover"><MousePointer2 size={21} aria-hidden="true" /></span><div><h3 className="font-semibold text-text">Khám phá ngôi nhà</h3><p className="text-xs text-muted">Chọn phòng hoặc marker để xem dữ liệu trực tiếp.</p></div></div>
    <p className="mt-4 text-sm leading-6 text-muted">Kéo để xoay, cuộn để thu phóng. Mô hình này được tạo từ sơ đồ 2D đã lưu, không phải bản đo kiến trúc thực tế.</p>
    <TwinLayoutButton leadingIcon={<Box size={18} />} onClick={onEdit2D}>Chỉnh sửa trong 2D</TwinLayoutButton>
  </section>;

  if (room) {
    const roomNodes = geometry.nodes.filter((node) => node.roomId === room.roomId);
    const devices = roomNodes.filter((node) => node.nodeType === 'DEVICE').map((node) => twin.devicesById[node.nodeId]).filter(Boolean);
    const sensors = roomNodes.filter((node) => node.nodeType === 'SENSOR').map((node) => twin.sensorsById[node.nodeId]).filter(Boolean);
    return <section aria-label={`Chi tiết phòng ${room.name}`} className="surface-card space-y-5 p-5">
      <div className="flex items-center gap-3"><RoomGlyph name={room.name} size={22} /><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wider text-muted">Phòng đang chọn</p><h3 className="truncate text-lg font-semibold text-text">{room.name}</h3><p className="text-xs text-muted">{room.deviceIds.length} thiết bị · {room.sensorIds.length} cảm biến</p></div></div>
      <div><h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Thiết bị trên sơ đồ</h4>{devices.length ? <div className="space-y-2">{devices.map((item) => <button key={item.deviceId} type="button" onClick={() => onSelect({ kind: 'node', id: `DEVICE:${item.deviceId}` })} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-line bg-app p-2 text-left hover:bg-sidebar-hover"><DeviceGlyph deviceType={item.deviceType} /><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-text">{item.name}</strong><small className="text-muted">{item.status}</small></span><TwinHealthBadge compact healthStatus={item.healthStatus} /></button>)}</div> : <p className="rounded-xl bg-off-soft p-3 text-sm text-muted">Chưa có thiết bị được đặt trong phòng này.</p>}</div>
      <div><h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Cảm biến trên sơ đồ</h4>{sensors.length ? <div className="space-y-2">{sensors.map((item) => <button key={item.sensorId} type="button" onClick={() => onSelect({ kind: 'node', id: `SENSOR:${item.sensorId}` })} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-line bg-app p-2 text-left hover:bg-sidebar-hover"><SensorGlyph metricType={item.metricType} /><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-text">{item.metricType}</strong><small className="text-muted">{item.latestValue ?? '—'}{item.unit ? ` ${item.unit}` : ''}</small></span><TwinHealthBadge compact healthStatus={item.healthStatus} /></button>)}</div> : <p className="rounded-xl bg-off-soft p-3 text-sm text-muted">Chưa có cảm biến được đặt trong phòng này.</p>}</div>
      <TwinLayoutButton leadingIcon={<Box size={18} />} onClick={onEdit2D}>Chỉnh sửa trong 2D</TwinLayoutButton>
    </section>;
  }

  if (device && nodeLayout) return <section aria-label={`Chi tiết thiết bị ${device.name}`} className="surface-card space-y-4 p-4">
    <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">Marker thiết bị đang chọn</p>
    <TwinDeviceCard deviceId={device.deviceId} />
    <TwinLayoutButton disabled={!nodeLayout.roomId} onClick={() => nodeLayout.roomId && onSelect({ kind: 'room', id: nodeLayout.roomId })}>Xem phòng chứa marker</TwinLayoutButton>
  </section>;

  if (sensor && nodeLayout) return <section aria-label={`Chi tiết cảm biến ${sensor.metricType}`} className="surface-card space-y-4 p-4">
    <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">Marker cảm biến đang chọn</p>
    <TwinSensorCard sensorId={sensor.sensorId} />
    <TwinLayoutButton disabled={!nodeLayout.roomId} onClick={() => nodeLayout.roomId && onSelect({ kind: 'room', id: nodeLayout.roomId })}>Xem phòng chứa marker</TwinLayoutButton>
  </section>;

  return <section role="status" className="surface-card p-5"><p className="font-semibold text-text">Đối tượng không còn trong dữ liệu hiện tại.</p><button type="button" className="mt-3 text-sm font-semibold text-primary-hover" onClick={onEdit2D}>Quay lại chế độ 2D</button></section>;
}
