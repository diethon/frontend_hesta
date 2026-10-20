import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { getDeviceDetail } from '../../services/deviceApi';
import { twinDeviceActions } from '../../services/deviceCommandService';
import { executeTwinCommand } from '../../store/twinCommandSlice';
import { actionOptions, type ActionOption } from '../deviceActionOptions';
import { TwinLayoutButton } from './TwinLayoutButton';
import { knownPower } from './twinPresentation';
import type { DeviceResponse } from '../../types/device';
import { Power } from 'lucide-react';

function ValueControl({ option, initialValue, disabled, onExecute }: { option: ActionOption; initialValue?: unknown; disabled: boolean; onExecute: (parameters: Record<string, unknown>) => void }) {
  const [value, setValue] = useState(typeof initialValue === 'number' || typeof initialValue === 'string' ? String(initialValue) : option.defaultValue);
  if (option.valueKind === 'none' || option.valueKind === 'json' || !option.parameterKey) return null;
  const parameterKey = option.parameterKey;
  const numeric = option.valueKind === 'number' || option.valueKind === 'percentage';
  const valid = numeric ? value.trim() !== '' && Number.isFinite(Number(value))
    && (option.valueKind !== 'percentage' || (Number(value) >= 0 && Number(value) <= 100)) : value.trim() !== '';
  return <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); if (valid && !disabled) onExecute({ [parameterKey]: numeric ? Number(value) : value.trim() }); }}>
    <label className="block text-xs font-semibold text-muted">{option.valueLabel}
      {option.valueKind === 'percentage' ? <span className="mt-3 flex items-center gap-3"><input disabled={disabled} type="range" min={0} max={100} step={1} value={value} onChange={(event) => setValue(event.target.value)} className="twin-control-range min-h-11 min-w-0 flex-1 cursor-pointer disabled:opacity-40" /><output className="min-w-10 text-right text-sm text-text">{value}%</output></span> : <input disabled={disabled} type={numeric ? 'number' : 'text'} step={numeric ? 'any' : undefined} value={value} onChange={(event) => setValue(event.target.value)} className={`mt-2 min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-text ${option.code === 'SET_TEMPERATURE' ? 'py-3 text-center text-3xl font-semibold' : 'text-sm'}`} />}
    </label>
    <TwinLayoutButton disabled={disabled || !valid} type="submit">{option.label}</TwinLayoutButton>
  </form>;
}

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
  const actions = detail ? twinDeviceActions(detail) : [];
  const disabled = !!feedback?.pending || device.status !== 'ONLINE' || device.healthStatus !== 'ACTIVE' || !detail;
  const execute = (action: string, parameters?: Record<string, unknown>) => {
    if (!disabled && actions.includes(action)) void dispatch(executeTwinCommand({ homeId, deviceId, command: { action, parameters } }));
  };
  const power = knownPower(device.currentState);
  const currentValues = device.currentState && typeof device.currentState === 'object' && !Array.isArray(device.currentState) ? device.currentState : {};
  return <section aria-label="Điều khiển thiết bị" className={presentation === 'embedded' ? 'space-y-5' : 'space-y-4 rounded-2xl border border-line bg-app p-4'}>
    <h4 className="text-sm font-semibold text-text">Điều khiển thiết bị</h4>
    {error ? <div role="alert"><p className="text-sm text-error">{error}</p><TwinLayoutButton onClick={() => { setError(null); setRetry((value) => value + 1); }}>Thử lại</TwinLayoutButton></div> : !detail ? <p role="status" className="text-sm text-muted">Đang tải capability…</p> : null}
    {power !== null && actions.includes('TURN_ON') && actions.includes('TURN_OFF') ? <div className="flex items-center justify-between rounded-2xl bg-app p-4"><div><p className="text-sm font-semibold text-text">Nguồn thiết bị</p><p className="mt-1 text-xs text-muted">{power ? 'Đang bật' : 'Đang tắt'}</p></div><button type="button" aria-label={power ? 'Tắt' : 'Bật'} aria-pressed={power} disabled={disabled} onClick={() => execute(power ? 'TURN_OFF' : 'TURN_ON')} className={`flex h-16 w-16 items-center justify-center rounded-2xl transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${power ? 'bg-primary text-white shadow-soft hover:bg-primary-hover' : 'border border-line bg-surface text-muted hover:bg-sidebar-hover'}`}><Power size={27} /></button></div> : actions.includes('TURN_ON') || actions.includes('TURN_OFF') ? <div className="flex flex-wrap items-center gap-2"><span className="mr-auto text-sm text-muted">Nguồn · {power === null ? 'Chưa xác định' : power ? 'ON' : 'OFF'}</span>{(['TURN_ON', 'TURN_OFF'] as const).filter((action) => actions.includes(action)).map((action) => <TwinLayoutButton key={action} disabled={disabled} aria-pressed={power === (action === 'TURN_ON')} onClick={() => execute(action)}>{action === 'TURN_ON' ? 'Bật' : 'Tắt'}</TwinLayoutButton>)}</div> : null}
    {actionOptions.filter((option) => actions.includes(option.code) && option.valueKind !== 'none' && option.valueKind !== 'json').map((option) => { const initialValue = option.code === 'SET_BRIGHTNESS' ? currentValues.brightness ?? currentValues.level : option.parameterKey ? currentValues[option.parameterKey] : undefined; return <ValueControl key={`${option.code}:${String(initialValue)}`} option={option} initialValue={initialValue} disabled={disabled} onExecute={(parameters) => execute(option.code, parameters)} />; })}
    {actions.includes('TOGGLE') ? <TwinLayoutButton disabled={disabled} onClick={() => execute('TOGGLE')}>Đảo trạng thái</TwinLayoutButton> : null}
    {actions.includes('SET_COLOR') ? <label className="flex min-h-11 items-center justify-between gap-3 text-xs font-semibold text-muted">Màu đèn<input type="color" aria-label="Chọn màu đèn" disabled={disabled} defaultValue="#ffffff" onChange={(event) => { const color = event.target.value; execute('SET_COLOR', { r: parseInt(color.slice(1, 3), 16), g: parseInt(color.slice(3, 5), 16), b: parseInt(color.slice(5, 7), 16) }); }} /></label> : null}
    {detail && !actions.length ? <p className="text-sm text-muted">Thiết bị chỉ đọc hoặc chưa khai báo capability điều khiển.</p> : null}
    {feedback?.pending ? <p role="status" className="text-sm text-muted">Đang chờ thiết bị xác nhận…</p> : null}
    {feedback?.error ? <p role="alert" className="text-sm text-error">{feedback.error}</p> : null}
    {feedback?.acknowledged ? <p role="status" className="text-xs text-muted">Thiết bị đã xác nhận lệnh. Trạng thái hiển thị cập nhật từ backend qua realtime.</p> : null}
    {device.status !== 'ONLINE' || device.healthStatus !== 'ACTIVE' ? <p className="text-xs text-muted">Thiết bị chưa trực tuyến. Điều khiển tạm khóa.</p> : null}
  </section>;
}
