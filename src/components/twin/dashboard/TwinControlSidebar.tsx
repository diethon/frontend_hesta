import { useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Activity, ArrowUpRight, Check, ChevronRight, Cpu, SlidersHorizontal, TriangleAlert } from 'lucide-react';
import { useAppSelector } from '../../../store/hooks';
import type { TwinLayoutGeometry, TwinLayoutSelection } from '../../../types/twinLayout';
import { Twin3DInspector } from '../Twin3DInspector';
import { TwinSensorCard } from '../TwinSensorCard';
import { DeviceGlyph, RoomGlyph } from '../TwinVisualIcon';
import { TwinHealthBadge } from '../TwinHealthBadge';
import { TwinLayoutButton } from '../TwinLayoutButton';
import { knownPower } from '../twinPresentation';
import { deviceAlert, deviceHealthCounts } from './twinDashboardData';

interface TwinControlSidebarProps {
  geometry: TwinLayoutGeometry;
  selection: TwinLayoutSelection | null;
  onSelect: (selection: TwinLayoutSelection) => void;
  onEdit2D: () => void;
  canEdit: boolean;
  onFocusRoom: (id: string) => void;
  onFitHome: () => void;
  scopeRoomIds?: readonly string[];
  scopeName?: string;
}
const tabs = [{ id: 'devices', label: 'Thiết bị', Icon: SlidersHorizontal }, { id: 'sensors', label: 'Cảm biến', Icon: Activity }, { id: 'alerts', label: 'Cảnh báo', Icon: TriangleAlert }, { id: 'stats', label: 'Thống kê', Icon: Cpu }] as const;
type Tab = typeof tabs[number]['id'];

function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-line bg-app p-5 text-center text-sm leading-6 text-muted">{children}</p>;
}

export function TwinControlSidebar(props: TwinControlSidebarProps) {
  const { geometry, selection, onSelect, onFocusRoom, onFitHome, scopeRoomIds, scopeName } = props;
  const [tab, setTab] = useState<Tab>('devices');
  const tabId = useId();
  const devicesById = useAppSelector((state) => state.twin.devicesById);
  const sensorsById = useAppSelector((state) => state.twin.sensorsById);
  const roomsById = useAppSelector((state) => state.twin.roomsById);
  const homeName = useAppSelector((state) => state.twin.home?.name);
  const commands = useAppSelector((state) => state.twinCommand.byId);
  const selectedNode = selection?.kind === 'node' ? selection.id : null;
  const businessRoomId = selectedNode?.startsWith('DEVICE:') ? devicesById[selectedNode.slice(7)]?.roomId : selectedNode?.startsWith('SENSOR:') ? sensorsById[selectedNode.slice(7)]?.roomId : null;
  const roomId = selection?.kind === 'room' ? selection.id : businessRoomId;
  const room = roomId ? roomsById[roomId] : undefined;
  const scopeRooms = useMemo(() => scopeRoomIds ? new Set(scopeRoomIds) : null, [scopeRoomIds]);
  const devices = useMemo(() => Object.values(devicesById).filter((device) => roomId ? device.roomId === roomId : !scopeRooms || device.roomId !== null && scopeRooms.has(device.roomId)), [devicesById, roomId, scopeRooms]);
  const sensors = useMemo(() => Object.values(sensorsById).filter((sensor) => roomId ? sensor.roomId === roomId : !scopeRooms || sensor.roomId !== null && scopeRooms.has(sensor.roomId)), [sensorsById, roomId, scopeRooms]);
  const health = deviceHealthCounts(devices);
  const alerts = devices.flatMap((device) => {
    const message = deviceAlert(device);
    const error = commands[device.deviceId]?.error;
    return [...(message ? [{ id: `health:${device.deviceId}`, name: device.name, message, selection: { kind: 'node' as const, id: `DEVICE:${device.deviceId}` } }] : []), ...(error ? [{ id: `command:${device.deviceId}`, name: device.name, message: error, selection: { kind: 'node' as const, id: `DEVICE:${device.deviceId}` } }] : [])];
  });
  for (const sensor of sensors) if (sensor.healthStatus !== 'ACTIVE') alerts.push({ id: `sensor:${sensor.sensorId}`, name: sensor.metricType, message: sensor.healthStatus === 'OFFLINE' ? 'Cảm biến ngoại tuyến' : 'Dữ liệu cảm biến đã cũ', selection: { kind: 'node', id: `SENSOR:${sensor.sensorId}` } });

  return <section aria-label="Bảng điều khiển thông minh" className="twin-dashboard-control min-w-0 bg-surface">
    <header className="border-b border-line p-5"><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Không gian của bạn</p><div className="flex items-center gap-3"><RoomGlyph name={room?.name ?? ''} size={23} /><div className="min-w-0"><h2 className="truncate text-xl font-semibold tracking-tight text-text">{room?.name ?? scopeName ?? homeName ?? 'Ngôi nhà'}</h2><p className="mt-1 text-xs text-muted">{devices.length} thiết bị · <span className="text-success">{health.online} trực tuyến</span></p></div></div><div className="mt-4 flex items-center gap-2"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" /><p className="text-xs text-muted">Trạng thái được đồng bộ từ HESTA</p></div>{room && geometry.rooms.some((item) => item.roomId === room.roomId) ? <button type="button" onClick={() => onFocusRoom(room.roomId)} className="mt-3 inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-primary-hover">Xem gần phòng này<ArrowUpRight size={15} aria-hidden="true" /></button> : null}</header>
    {selectedNode ? <div className="twin-dashboard-selected border-b border-line p-3"><Twin3DInspector {...props} /></div> : null}
    <div role="tablist" aria-label="Nội dung phòng" className="grid grid-cols-4 gap-1 border-b border-line p-2">{tabs.map(({ id, label, Icon }) => <button key={id} id={`${tabId}-${id}`} aria-controls={`${tabId}-panel-${id}`} role="tab" type="button" aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)} onKeyDown={(event) => {
      const index = tabs.findIndex((item) => item.id === id);
      const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
      if (next < 0) return;
      event.preventDefault(); setTab(tabs[next].id); document.getElementById(`${tabId}-${tabs[next].id}`)?.focus();
    }} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary ${tab === id ? 'bg-info-soft text-primary-hover' : 'text-muted hover:bg-app'}`}><Icon size={16} aria-hidden="true" /><span>{label}{id === 'alerts' && alerts.length ? ` (${alerts.length})` : ''}</span></button>)}</div>
    <div role="tabpanel" id={`${tabId}-panel-${tab}`} aria-labelledby={`${tabId}-${tab}`} tabIndex={0} className="space-y-3 p-4">
      {tab === 'devices' ? <><div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-text">{room ? 'Thiết bị trong phòng' : scopeName ? `Thiết bị · ${scopeName}` : 'Tất cả thiết bị'}</h3><span className="text-xs text-muted">{devices.length}</span></div>{devices.length ? devices.map((device) => {
        const power = device.status === 'ONLINE' && device.healthStatus === 'ACTIVE' ? knownPower(device.currentState) : null;
        const selected = selectedNode === `DEVICE:${device.deviceId}`;
        return <button key={device.deviceId} type="button" aria-label={`Chọn thiết bị ${device.name}`} aria-pressed={selected} onClick={() => onSelect({ kind: 'node', id: `DEVICE:${device.deviceId}` })} className={`flex min-h-20 w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary ${selected ? 'border-primary bg-info-soft' : 'border-line bg-surface hover:bg-app'}`}><DeviceGlyph deviceType={device.deviceType} /><span className="min-w-0 flex-1"><strong className="block truncate text-sm font-semibold text-text">{device.name}</strong><span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted"><span>{power === null ? 'Chưa rõ nguồn' : power ? 'Đang bật' : 'Đang tắt'}</span>{device.status === 'ERROR' ? <span className="rounded-full bg-error-soft px-2 py-1 font-medium text-error">Lỗi thiết bị</span> : <TwinHealthBadge compact healthStatus={device.status === 'OFFLINE' ? 'OFFLINE' : device.healthStatus} />}</span></span><ChevronRight size={16} className="shrink-0 text-icon" aria-hidden="true" /></button>;
      }) : <EmptyState>Chưa có thiết bị trong {room ? 'phòng này' : 'ngôi nhà'}.</EmptyState>}<p className="text-xs leading-5 text-muted">Chọn thiết bị để xem điều khiển được backend hỗ trợ. Lệnh và trạng thái xác nhận được hiển thị riêng.</p></> : null}
      {tab === 'sensors' ? sensors.length ? sensors.map((sensor) => <div key={sensor.sensorId} className="space-y-1"><button type="button" onClick={() => onSelect({ kind: 'node', id: `SENSOR:${sensor.sensorId}` })} className="flex min-h-11 w-full items-center justify-between px-1 text-xs font-semibold text-primary-hover" aria-label={`Chọn cảm biến ${sensor.metricType}`}><span>Xem vị trí cảm biến</span><ArrowUpRight size={14} aria-hidden="true" /></button><TwinSensorCard sensorId={sensor.sensorId} /></div>) : <EmptyState>Chưa có cảm biến. Giá trị sẽ xuất hiện khi HESTA nhận được dữ liệu.</EmptyState> : null}
      {tab === 'alerts' ? alerts.length ? alerts.map((alert) => <button key={alert.id} type="button" onClick={() => onSelect(alert.selection)} className="flex min-h-20 w-full items-start gap-3 rounded-2xl border border-line bg-warning-soft p-3 text-left"><TriangleAlert size={18} className="mt-1 shrink-0 text-warning" aria-hidden="true" /><span className="min-w-0"><strong className="block break-words text-sm text-text">{alert.name}</strong><span className="mt-1 block break-words text-xs leading-5 text-muted">{alert.message}</span></span></button>) : <div className="rounded-2xl bg-success-soft p-5 text-center"><Check size={24} className="mx-auto text-success" aria-hidden="true" /><p className="mt-3 text-sm font-semibold text-text">Không có cảnh báo đã ghi nhận</p><p className="mt-1 text-xs text-muted">Trong phạm vi đang chọn</p></div> : null}
      {tab === 'stats' ? <><h3 className="text-sm font-semibold text-text">Tổng quan {room ? 'phòng' : 'ngôi nhà'}</h3><dl className="divide-y divide-line rounded-2xl border border-line px-4">{[{ label: 'Thiết bị trực tuyến', value: health.online }, { label: 'Nguồn đang bật', value: health.on }, { label: 'Nguồn đang tắt', value: health.off }, { label: 'Chưa rõ trạng thái nguồn', value: health.unknown }, { label: 'Thiết bị ngoại tuyến', value: health.offline }, { label: 'Cảm biến', value: sensors.length }].map(({ label, value }) => <div key={label} className="flex items-center justify-between gap-2 py-3 text-sm"><dt className="text-muted">{label}</dt><dd className="font-semibold text-text">{value}</dd></div>)}</dl><p className="text-xs leading-5 text-muted">Thống kê từ snapshot và sự kiện realtime. Chưa có dữ liệu lịch sử để hiển thị biểu đồ.</p></> : null}
    </div>
    <footer className="flex flex-wrap gap-2 border-t border-line p-4"><TwinLayoutButton onClick={onFitHome}>Vừa ngôi nhà</TwinLayoutButton><TwinLayoutButton onClick={props.onEdit2D}>{props.canEdit ? 'Chỉnh sửa sơ đồ' : 'Xem sơ đồ 2D'}</TwinLayoutButton></footer>
  </section>;
}
