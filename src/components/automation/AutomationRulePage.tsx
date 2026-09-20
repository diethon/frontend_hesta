import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { createAutomationRule, deleteAutomationRule, getAutomationRules, toggleAutomationRule } from '../../services/automationApi';
import { getDevices } from '../../services/sceneApi';
import type { AutomationRule, DeviceSummary } from '../../types/automation';
import { actionOptions, buildActionInput, getDeviceActions, type DraftAction } from './automationActions';

interface DraftCondition { deviceId: string; attribute: string; operator: 'EQ' | 'NE' | 'GT' | 'GTE' | 'LT' | 'LTE'; expected: string; logicalOperator: 'AND' | 'OR' }

const triggerLabels = { SENSOR: 'Dữ liệu cảm biến', EVENT: 'Sự kiện', SCHEDULE: 'Theo lịch' };
const conditionOperators = [
  { code: 'EQ', label: 'Bằng' }, { code: 'NE', label: 'Khác' },
  { code: 'GT', label: 'Lớn hơn' }, { code: 'GTE', label: 'Lớn hơn hoặc bằng' },
  { code: 'LT', label: 'Nhỏ hơn' }, { code: 'LTE', label: 'Nhỏ hơn hoặc bằng' },
] as const;

export function AutomationRulePage() {
  const { homeId = '' } = useParams();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<'SENSOR' | 'EVENT' | 'SCHEDULE'>('SENSOR');
  const [conditions, setConditions] = useState<DraftCondition[]>([]);
  const [actions, setActions] = useState<DraftAction[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [ruleResult, deviceResult] = await Promise.all([getAutomationRules(homeId), getDevices(homeId)]);
      setRules(ruleResult); setDevices(deviceResult);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể tải dữ liệu'); }
  }, [homeId]);
  useEffect(() => {
    let active = true;
    Promise.all([getAutomationRules(homeId), getDevices(homeId)])
      .then(([ruleResult, deviceResult]) => {
        if (!active) return;
        setRules(ruleResult);
        setDevices(deviceResult);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : 'Không thể tải dữ liệu');
      });
    return () => { active = false; };
  }, [homeId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    try {
      await createAutomationRule(homeId, {
        name, triggerType, enabled: true,
        conditions: conditions.map((item, order) => ({ ...item, expectedValue: parseValue(item.expected), order })),
        actions: actions.map((item, order) => buildActionInput(item, order, devices)),
      });
      setName(''); setConditions([]); setActions([]); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Dữ liệu quy tắc không hợp lệ'); }
  };

  const addCondition = () => setConditions((items) => [...items, { deviceId: devices[0]?.id || '', attribute: 'temperature', operator: 'GT', expected: '30', logicalOperator: 'AND' }]);
  const addAction = () => {
    const device = devices.find((candidate) => getDeviceActions(candidate).length > 0);
    const option = getDeviceActions(device)[0];
    if (device && option) setActions((items) => [...items, { deviceId: device.id, action: option.code, value: option.defaultValue }]);
  };
  const updateCondition = (index: number, patch: Partial<DraftCondition>) => setConditions((items) => items.map((item, i) => i === index ? { ...item, ...patch } : item));
  const updateAction = (index: number, patch: Partial<DraftAction>) => setActions((items) => items.map((item, i) => i === index ? { ...item, ...patch } : item));
  const changeActionDevice = (index: number, deviceId: string) => {
    const option = getDeviceActions(devices.find((device) => device.id === deviceId))[0];
    updateAction(index, { deviceId, action: option?.code ?? '', value: option?.defaultValue ?? '' });
  };
  const changeActionType = (index: number, actionCode: string) => {
    const option = actionOptions.find((candidate) => candidate.code === actionCode);
    updateAction(index, { action: actionCode, value: option?.defaultValue ?? '' });
  };
  const hasActionableDevice = devices.some((device) => getDeviceActions(device).length > 0);

  return <main className="min-h-screen bg-slate-950 p-6 text-slate-100"><div className="mx-auto max-w-6xl space-y-5">
    <header className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">Quy tắc tự động</h1><p className="text-xs text-slate-500">Nhà: {homeId}</p></div><Link to="/home" className="button">Về trang chủ</Link></header>
    {error && <p role="alert" className="rounded-lg bg-rose-950 p-3 text-rose-300">{error}</p>}
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-semibold">Danh sách quy tắc</h2>
        {rules.map((rule) => <article key={rule.id} className="rounded-xl border border-slate-700 p-4">
          <div className="flex justify-between gap-3"><div><h3>{rule.name}</h3><p className="text-sm text-slate-400">{triggerLabels[rule.triggerType]} · {rule.conditions.length} điều kiện · {rule.actions.length} hành động</p></div>
            <div className="flex gap-3 text-sm"><button onClick={() => void toggleAutomationRule(homeId, rule.id, !rule.enabled).then(load).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Không thể đổi trạng thái'))} className="text-cyan-400">{rule.enabled ? 'Tắt' : 'Bật'}</button><button onClick={() => void deleteAutomationRule(homeId, rule.id).then(load).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Không thể xóa'))} className="text-rose-400">Xóa</button></div>
          </div>
        </article>)}
        {!rules.length && <p className="text-sm text-slate-400">Chưa có quy tắc.</p>}
      </section>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-semibold">Tạo quy tắc tự động</h2>
        <label className="block text-sm">Tên<input required value={name} onChange={(e) => setName(e.target.value)} className="input mt-1" /></label>
        <label className="block text-sm">Loại kích hoạt<select value={triggerType} onChange={(e) => setTriggerType(e.target.value as typeof triggerType)} className="input mt-1"><option value="SENSOR">Dữ liệu cảm biến</option><option value="EVENT">Sự kiện</option><option value="SCHEDULE">Theo lịch</option></select></label>
        <div className="flex justify-between"><h3>Điều kiện</h3><button type="button" disabled={!devices.length} onClick={addCondition} className="button">+ Thêm</button></div>
        {conditions.map((condition, index) => <div key={index} className="grid gap-2 rounded-xl border border-slate-700 p-3 sm:grid-cols-2">
          <label className="text-sm">Thiết bị<select value={condition.deviceId} onChange={(e) => updateCondition(index, { deviceId: e.target.value })} className="input mt-1">{devices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}</select></label>
          <label className="text-sm">Thuộc tính<input value={condition.attribute} onChange={(e) => updateCondition(index, { attribute: e.target.value })} className="input mt-1" /></label>
          <label className="text-sm">So sánh<select value={condition.operator} onChange={(e) => updateCondition(index, { operator: e.target.value as DraftCondition['operator'] })} className="input mt-1">{conditionOperators.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label>
          <label className="text-sm">Giá trị điều kiện<input value={condition.expected} onChange={(e) => updateCondition(index, { expected: e.target.value })} className="input mt-1" /></label>
          <button type="button" onClick={() => setConditions((items) => items.filter((_, i) => i !== index))} className="text-left text-sm text-rose-400">Xóa điều kiện</button>
        </div>)}
        <div className="flex justify-between"><h3>Hành động</h3><button type="button" disabled={!hasActionableDevice} onClick={addAction} className="button">+ Thêm</button></div>
        {!hasActionableDevice && <p className="text-sm text-amber-300">Chưa có thiết bị hỗ trợ hành động tự động.</p>}
        {actions.map((action, index) => {
          const selectedDevice = devices.find((device) => device.id === action.deviceId);
          const availableActions = getDeviceActions(selectedDevice);
          const selectedOption = availableActions.find((option) => option.code === action.action);
          return <div key={index} className="grid gap-2 rounded-xl border border-slate-700 p-3 sm:grid-cols-2">
            <label className="text-sm">Thiết bị hành động {index + 1}<select value={action.deviceId} onChange={(e) => changeActionDevice(index, e.target.value)} className="input mt-1">{devices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}</select></label>
            <label className="text-sm">Hành động<select value={action.action} onChange={(e) => changeActionType(index, e.target.value)} disabled={!availableActions.length} className="input mt-1">{!availableActions.length && <option value="">Không có hành động phù hợp</option>}{availableActions.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label>
            {selectedOption?.valueKind === 'none' && <p className="text-sm text-slate-400 sm:col-span-2">Hành động này không cần nhập giá trị.</p>}
            {(selectedOption?.valueKind === 'percentage' || selectedOption?.valueKind === 'number') && <label className="text-sm sm:col-span-2">{selectedOption.valueLabel}<input required type="number" min={selectedOption.valueKind === 'percentage' ? 0 : undefined} max={selectedOption.valueKind === 'percentage' ? 100 : undefined} step={selectedOption.valueKind === 'percentage' ? 1 : 'any'} value={action.value} onChange={(e) => updateAction(index, { value: e.target.value })} className="input mt-1" /></label>}
            {selectedOption?.valueKind === 'text' && <label className="text-sm sm:col-span-2">{selectedOption.valueLabel}<input required value={action.value} onChange={(e) => updateAction(index, { value: e.target.value })} className="input mt-1" /></label>}
            {selectedOption?.valueKind === 'json' && <label className="text-sm sm:col-span-2">{selectedOption.valueLabel}<textarea required value={action.value} onChange={(e) => updateAction(index, { value: e.target.value })} className="input mt-1" placeholder='{"power": "ON"}' /></label>}
            {!selectedOption && <p className="text-sm text-amber-300 sm:col-span-2">Thiết bị này chưa khai báo hành động hợp lệ. Hãy chọn thiết bị khác.</p>}
            <button type="button" onClick={() => setActions((items) => items.filter((_, i) => i !== index))} className="text-left text-sm text-rose-400">Xóa hành động</button>
          </div>;
        })}
        <button disabled={!conditions.length || !actions.length || actions.some((item) => !getDeviceActions(devices.find((device) => device.id === item.deviceId)).some((option) => option.code === item.action))} className="button w-full">Tạo quy tắc</button>
      </form>
    </div>
  </div></main>;
}

function parseValue(value: string): unknown {
  try { return JSON.parse(value) as unknown; } catch { return value; }
}
