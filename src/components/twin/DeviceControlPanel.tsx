import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { getDeviceDetail } from '../../services/deviceApi';
import { twinDeviceActions } from '../../services/deviceCommandService';
import { executeTwinCommand } from '../../store/twinCommandSlice';
import { TwinDeviceControls } from './TwinDeviceControls';
import { lightColor } from './devices/deviceVisualState';
import { adaptTwinDevice } from '../../services/twinAdapter';
import { TwinLayoutButton } from './TwinLayoutButton';
import { knownPower } from './twinPresentation';
import type { DeviceResponse } from '../../types/device';
import { Power } from 'lucide-react';

/** Mounted by device ID. Capability fetches never enter the scene or overwrite live state. */
export function DeviceControlPanel({ deviceId, presentation = 'card' }: { deviceId: string; presentation?: 'card' | 'embedded' }) {
  const dispatch = useAppDispatch();
  const device = useAppSelector((state) => state.twin.devicesById[deviceId]);
  const homeId = useAppSelector((state) => state.twin.homeId);
  const feedback = useAppSelector((state) => state.twinCommand.byId[deviceId]);
  const [detail, setDetail] = useState<DeviceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    getDeviceDetail(deviceId).then((result) => {
      if (active) {
        if (result?.id !== deviceId || result.homeId !== homeId) setError('Thông tin thiết bị không hợp lệ.');
        else setDetail(result);
      }
    }).catch(() => { if (active) setError('Không thể tải capability của thiết bị.'); });
    return () => { active = false; };
  }, [deviceId, homeId, retry]);
  if (!device || !homeId) return null;
  const currentDetail = detail?.id === deviceId && detail.homeId === homeId ? detail : null;
  const actions = currentDetail ? twinDeviceActions(currentDetail) : [];
  const disabled = !!feedback?.pending || device.status !== 'ONLINE' || device.healthStatus !== 'ACTIVE' || !currentDetail || !!error;
  const execute = (action: string, parameters?: Record<string, unknown>) => {
    if (!disabled && actions.includes(action)) void dispatch(executeTwinCommand({ homeId, deviceId, command: { action, parameters } }));
  };
  const power = knownPower(device.currentState);
  const currentValues = device.currentState && typeof device.currentState === 'object' && !Array.isArray(device.currentState) ? device.currentState : {};
  return <section aria-label="Điều khiển thiết bị" className={presentation === 'embedded' ? 'space-y-4' : 'space-y-4 rounded-2xl border border-line bg-app p-4'}>
    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">Điều khiển thiết bị</h4>
    {error ? <div role="alert"><p className="text-sm text-error">{error}</p><TwinLayoutButton onClick={() => { setError(null); setRetry((value) => value + 1); }}>Thử lại</TwinLayoutButton></div> : !currentDetail ? <p role="status" className="text-sm text-muted">Đang tải capability…</p> : null}
    {power !== null && actions.includes('TURN_ON') && actions.includes('TURN_OFF') ? <div className="flex items-center justify-between rounded-2xl bg-app p-4"><div><p className="text-sm font-semibold text-text">Nguồn thiết bị</p><p className="mt-1 text-xs text-muted">{power ? 'Đang bật' : 'Đang tắt'}</p></div><button type="button" aria-label={power ? 'Tắt' : 'Bật'} aria-pressed={power} disabled={disabled} onClick={() => execute(power ? 'TURN_OFF' : 'TURN_ON')} className={`flex h-16 w-16 items-center justify-center rounded-2xl transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${power ? 'bg-primary text-white shadow-soft hover:bg-primary-hover' : 'border border-line bg-surface text-muted hover:bg-sidebar-hover'}`}><Power size={27} /></button></div> : actions.includes('TURN_ON') || actions.includes('TURN_OFF') ? <div className="flex flex-wrap items-center gap-2"><span className="mr-auto text-sm text-muted">Nguồn · {power === null ? 'Chưa xác định' : power ? 'ON' : 'OFF'}</span>{(['TURN_ON', 'TURN_OFF'] as const).filter((action) => actions.includes(action)).map((action) => <TwinLayoutButton key={action} disabled={disabled} aria-pressed={power === (action === 'TURN_ON')} onClick={() => execute(action)}>{action === 'TURN_ON' ? 'Bật' : 'Tắt'}</TwinLayoutButton>)}</div> : null}
    <TwinDeviceControls actions={actions} currentValues={currentValues} color={lightColor(adaptTwinDevice(device), '#ffffff')} disabled={disabled} onExecute={execute} />
    {detail && !actions.length ? <p className="text-sm text-muted">Thiết bị chỉ đọc hoặc chưa khai báo capability điều khiển.</p> : null}
    {feedback?.pending ? <p role="status" className="text-sm text-muted">Đang chờ thiết bị xác nhận…</p> : null}
    {feedback?.error ? <p role="alert" className="text-sm text-error">{feedback.error}</p> : null}
    {feedback?.acknowledged ? <p role="status" className="rounded-xl bg-success-soft px-3 py-2 text-xs text-success">Thiết bị đã xác nhận lệnh.</p> : null}
    {device.status !== 'ONLINE' || device.healthStatus !== 'ACTIVE' ? <p role="status" className="rounded-xl bg-warning-soft p-3 text-xs text-text">{device.healthStatus === 'STALE' && device.status === 'ONLINE' ? 'Dữ liệu thiết bị đã cũ. Đang chờ trạng thái mới từ backend để mở điều khiển.' : 'Thiết bị chưa trực tuyến. Điều khiển tạm khóa; bạn vẫn có thể chọn và xem thông tin.'}</p> : null}
  </section>;
}
