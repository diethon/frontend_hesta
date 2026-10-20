import { Armchair, Box, Camera, ChevronRight, DoorOpen, Lightbulb, PanelsTopLeft, Radio, Snowflake, Tv, Wind, type LucideIcon } from 'lucide-react';
import { useAppSelector } from '../../store/hooks';
import type { TwinLayoutGeometry, TwinLayoutSelection } from '../../types/twinLayout';
import { resolveDeviceAppearance } from './devices/deviceAppearance';
import { knownPower } from './twinPresentation';

const applianceIcons: Record<string, LucideIcon> = { ac: Snowflake, camera: Camera, door: DoorOpen, window: PanelsTopLeft, tv: Tv };

export function TwinLivingDevices({ geometry, selection, onSelect }: {
  geometry: TwinLayoutGeometry; selection: TwinLayoutSelection | null; onSelect: (selection: TwinLayoutSelection) => void;
}) {
  const devices = useAppSelector((state) => state.twin.devicesById);
  const rooms = useAppSelector((state) => state.twin.roomsById);
  const visible = geometry.nodes.filter((node) => node.nodeType === 'DEVICE' && devices[node.nodeId]);
  return <section aria-label="Thiết bị trong không gian" className="surface-card p-4 sm:p-5">
    <div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-semibold text-text">Thiết bị trong nhà</h3><p className="mt-1 text-xs text-muted">Chọn để điều khiển</p></div><span className="rounded-lg bg-app px-2.5 py-1 text-xs font-semibold text-muted">{visible.length}</span></div>
    <div className="twin-living-device-list space-y-1 overflow-y-auto pr-1">
      {visible.map((node) => {
        const device = devices[node.nodeId], appearance = resolveDeviceAppearance(device.deviceType, device.name);
        const Icon = applianceIcons[appearance.kind] ?? (appearance.kind.includes('light') || appearance.kind.includes('lamp') || appearance.kind === 'led-strip' ? Lightbulb : appearance.kind.includes('fan') ? Wind : appearance.kind.includes('sensor') ? Radio : Box);
        const active = device.status === 'ONLINE' && device.healthStatus === 'ACTIVE', powered = active && knownPower(device.currentState) === true;
        const selected = selection?.kind === 'node' && selection.id === `DEVICE:${device.deviceId}`;
        return <button type="button" key={device.deviceId} aria-pressed={selected} onClick={() => onSelect({ kind: 'node', id: `DEVICE:${device.deviceId}` })} className={`flex min-h-16 w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors ${selected ? 'border-primary bg-info-soft' : 'border-transparent bg-surface hover:bg-app'}`}>
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${powered ? 'bg-warning-soft text-warning' : active ? 'bg-info-soft text-primary-hover' : 'bg-off-soft text-muted'}`}><Icon size={19} strokeWidth={1.8} /></span>
          <span className="min-w-0 flex-1"><strong className="block truncate text-xs font-semibold text-text">{device.name}</strong><span className="mt-1 block truncate text-[11px] text-muted">{rooms[device.roomId ?? '']?.name ?? 'Chưa gán phòng'}</span></span>
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? 'bg-success' : 'bg-off'}`} role="img" aria-label={active ? powered ? 'Đang bật' : 'Sẵn sàng' : 'Chưa có kết nối mới'} />
          <ChevronRight size={15} className="shrink-0 text-icon" />
        </button>;
      })}
      {!visible.length ? <div className="rounded-2xl bg-app p-5 text-center"><Armchair className="mx-auto text-icon" size={24} /><p className="mt-3 text-sm text-muted">Không gian này chưa có thiết bị.</p><p className="mt-2 text-xs leading-5 text-muted">Chọn phòng để xem bố cục và thông tin cảm biến.</p></div> : null}
    </div>
  </section>;
}
