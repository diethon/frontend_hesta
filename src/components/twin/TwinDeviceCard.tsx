import { useAppSelector } from '../../store/hooks';
import { selectTwinDevice } from '../../store/twinSelectors';
import { summarizeState } from './twinPresentation';
import { useTwinUpdateMotion } from './useTwinMotion';
import { DeviceGlyph } from './TwinVisualIcon';
import { TwinHealthBadge } from './TwinHealthBadge';
import { TwinTime } from './TwinTime';

const stateLabels: Record<string, string> = {
  power: 'Nguồn', brightness: 'Độ sáng', temperature: 'Nhiệt độ', humidity: 'Độ ẩm',
  mode: 'Chế độ', fan: 'Quạt',
  motion: 'Chuyển động', battery: 'Pin', speed: 'Tốc độ', state: 'Trạng thái',
};

export function TwinDeviceCard({ deviceId }: { deviceId: string }) {
  const device = useAppSelector((state) => selectTwinDevice(state, deviceId));
  const motionRef = useTwinUpdateMotion<HTMLDListElement>(JSON.stringify([device?.currentState, device?.lastSeen]));
  if (!device) return null;
  const entries = device.currentState && typeof device.currentState === 'object' && !Array.isArray(device.currentState)
    ? Object.entries(device.currentState) : [['state', device.currentState] as const];
  const simple = entries.filter(([, value]) => value === null || typeof value !== 'object');
  const expanded = entries.filter(([key]) => !simple.slice(0, 6).some(([shown]) => shown === key));
  return (
    <article aria-label={`Thiết bị ${device.name}`} className="min-w-0 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <DeviceGlyph deviceType={device.deviceType} />
        <div className="min-w-0 flex-1">
          <h4 className="break-words font-semibold">{device.name}</h4>
          <p className="mt-1 text-xs text-muted">{device.deviceType}</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted">Trạng thái thiết bị: <strong className="text-text">{device.status}</strong></p>
      <dl ref={motionRef} className="mt-3 space-y-2 text-sm">
        {simple.length ? simple.slice(0, 6).map(([key, value]) => (
          <div key={key} className="flex flex-wrap justify-between gap-x-3 gap-y-1">
            <dt className="break-words text-muted">{stateLabels[key] ?? key}</dt>
            <dd className="min-w-0 break-words font-medium text-text">{summarizeState(value)}</dd>
          </div>
        )) : !entries.length ? <div className="text-muted">Chưa có trạng thái thiết bị.</div> : null}
      </dl>
      {expanded.length ? <details className="mt-3 rounded-xl bg-app p-3"><summary className="cursor-pointer text-xs font-semibold text-primary-hover">Dữ liệu mở rộng · {expanded.length} thuộc tính</summary><dl className="mt-3 space-y-2 text-xs">{expanded.map(([key, value]) => <div key={key}><dt className="font-semibold text-muted">{stateLabels[key] ?? key}</dt><dd className="mt-1 break-words text-text">{summarizeState(value)}</dd></div>)}</dl></details> : null}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <span className="text-xs text-muted">Độ mới</span><TwinHealthBadge healthStatus={device.healthStatus} />
      </div>
      <p className="mt-2 break-words text-xs text-muted">Lần thấy cuối: <TwinTime value={device.lastSeen} /></p>
    </article>
  );
}
