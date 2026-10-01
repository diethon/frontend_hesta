import { useAppSelector } from '../../store/hooks';
import { selectTwinDevice } from '../../store/twinSelectors';
import type { JsonValue } from '../../types/twin';
import { DeviceGlyph } from './TwinVisualIcon';
import { TwinHealthBadge } from './TwinHealthBadge';
import { TwinTime } from './TwinTime';

function summarize(value: JsonValue, depth = 0): string {
  if (value === null) return 'Chưa có dữ liệu';
  if (typeof value === 'boolean') return value ? 'Có / ON' : 'Không / OFF';
  if (typeof value !== 'object') return String(value);
  if (depth >= 2) return Array.isArray(value) ? `${value.length} giá trị` : `${Object.keys(value).length} thuộc tính`;
  if (Array.isArray(value)) return value.slice(0, 4).map((item) => summarize(item, depth + 1)).join(', ') || 'Trống';
  return Object.entries(value).slice(0, 4).map(([key, item]) => `${key}: ${summarize(item, depth + 1)}`).join(' · ') || 'Trống';
}

const stateLabels: Record<string, string> = {
  power: 'Nguồn', brightness: 'Độ sáng', temperature: 'Nhiệt độ', humidity: 'Độ ẩm',
  motion: 'Chuyển động', battery: 'Pin', speed: 'Tốc độ', state: 'Trạng thái',
};

export function TwinDeviceCard({ deviceId }: { deviceId: string }) {
  const device = useAppSelector((state) => selectTwinDevice(state, deviceId));
  if (!device) return null;
  const entries = device.currentState && typeof device.currentState === 'object' && !Array.isArray(device.currentState)
    ? Object.entries(device.currentState) : [['state', device.currentState] as const];
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
      <dl className="mt-3 space-y-2 text-sm">
        {entries.length ? entries.slice(0, 6).map(([key, value]) => (
          <div key={key} className="flex flex-wrap justify-between gap-x-3 gap-y-1">
            <dt className="break-words text-muted">{stateLabels[key] ?? key}</dt>
            <dd className="min-w-0 break-words font-medium text-text">{summarize(value)}</dd>
          </div>
        )) : <div className="text-muted">Chưa có trạng thái thiết bị.</div>}
        {entries.length > 6 ? <div className="text-xs text-muted">Và {entries.length - 6} thuộc tính khác</div> : null}
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <span className="text-xs text-muted">Độ mới</span><TwinHealthBadge healthStatus={device.healthStatus} />
      </div>
      <p className="mt-2 break-words text-xs text-muted">Lần thấy cuối: <TwinTime value={device.lastSeen} /></p>
    </article>
  );
}
