import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { createAutomationRule, deleteAutomationRule, getAutomationExecutions, getAutomationRules, testAutomationRule, toggleAutomationRule, updateAutomationRule } from '../../services/automationApi';
import { getDevices, getScenes } from '../../services/sceneApi';
import type { AutomationExecution, AutomationRule, AutomationTestResult, DeviceSummary } from '../../types/automation';
import type { SceneResponse } from '../../types/scene';
import { actionOptions, buildActionInput, getDeviceActions, type DraftAction } from './automationActions';
import { SchedulePanel } from '../ui/SchedulePanel';

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
  const [scenes, setScenes] = useState<SceneResponse[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [historyRuleId, setHistoryRuleId] = useState<string | null>(null);
  const [executions, setExecutions] = useState<AutomationExecution[]>([]);
  const [testRuleId, setTestRuleId] = useState<string | null>(null);
  const [scheduleRuleId, setScheduleRuleId] = useState<string | null>(null);
  const [testData, setTestData] = useState('{}');
  const [testResult, setTestResult] = useState<AutomationTestResult | null>(null);
  const [success, setSuccess] = useState('');
  const [triggerType, setTriggerType] = useState<'SENSOR' | 'EVENT' | 'SCHEDULE'>('SENSOR');
  const [conditions, setConditions] = useState<DraftCondition[]>([]);
  const [actions, setActions] = useState<DraftAction[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [ruleResult, deviceResult, sceneResult] = await Promise.all([getAutomationRules(homeId), getDevices(homeId), getScenes(homeId)]);
      setRules(ruleResult); setDevices(deviceResult); setScenes(sceneResult);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể tải dữ liệu'); }
  }, [homeId]);
  useEffect(() => {
    let active = true;
    Promise.all([getAutomationRules(homeId), getDevices(homeId), getScenes(homeId)])
      .then(([ruleResult, deviceResult, sceneResult]) => {
        if (!active) return;
        setRules(ruleResult);
        setDevices(deviceResult);
        setScenes(sceneResult);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : 'Không thể tải dữ liệu');
      });
    return () => { active = false; };
  }, [homeId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setSuccess('');
    try {
      const input = {
        name, description, triggerType, enabled: editingRule?.enabled ?? true,
        conditions: conditions.map((item, order) => ({ ...item, expectedValue: parseValue(item.expected), order })),
        actions: actions.map((item, order) => buildActionInput(item, order, devices)),
      };
      if (editingRule) await updateAutomationRule(homeId, editingRule.id, input);
      else await createAutomationRule(homeId, input);
      setSuccess(editingRule ? 'Đã lưu quy tắc.' : 'Đã tạo quy tắc.');
      clearEditor(); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Dữ liệu quy tắc không hợp lệ'); }
  };

  const clearEditor = () => {
    setEditingRule(null); setName(''); setDescription(''); setTriggerType('SENSOR');
    setConditions([]); setActions([]);
  };

  const edit = (rule: AutomationRule) => {
    setEditingRule(rule); setName(rule.name); setDescription(rule.description ?? ''); setTriggerType(rule.triggerType);
    setConditions(rule.conditions.map((item) => ({ deviceId: item.deviceId ?? '', attribute: item.attribute,
      operator: item.operator, expected: typeof item.expectedValue === 'string' ? item.expectedValue : JSON.stringify(item.expectedValue),
      logicalOperator: item.logicalOperator })));
    setActions(rule.actions.map((item) => {
      const option = actionOptions.find((candidate) => candidate.code === item.action);
      return { deviceId: item.deviceId ?? '', sceneId: item.sceneId, action: item.action,
        value: option?.valueKind === 'json' ? JSON.stringify(item.parameters)
          : option?.parameterKey ? String(item.parameters[option.parameterKey] ?? '') : '' };
    }));
  };

  const remove = async (rule: AutomationRule) => {
    if (!window.confirm(`Xóa quy tắc “${rule.name}”? Hành động này không thể hoàn tác.`)) return;
    try { await deleteAutomationRule(homeId, rule.id); if (editingRule?.id === rule.id) clearEditor(); await load(); setSuccess('Đã xóa quy tắc.'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể xóa quy tắc.'); }
  };

  const showHistory = async (ruleId: string) => {
    if (historyRuleId === ruleId) { setHistoryRuleId(null); return; }
    setHistoryRuleId(ruleId); setExecutions([]);
    try { setExecutions(await getAutomationExecutions(homeId, ruleId)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể tải lịch sử.'); }
  };

  const openTest = (rule: AutomationRule) => {
    setTestRuleId(rule.id); setTestResult(null);
    const data = Object.fromEntries(rule.conditions.filter((item) => item.attribute !== 'eventType')
      .map((item) => [item.attribute, item.expectedValue]));
    setTestData(JSON.stringify(data, null, 2));
  };

  const runTest = async (rule: AutomationRule) => {
    setError(''); setTestResult(null);
    try {
      const data: unknown = JSON.parse(testData);
      if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('Dữ liệu chạy thử phải là đối tượng JSON.');
      setTestResult(await testAutomationRule(homeId, rule.id, {
        sourceDeviceId: rule.conditions[0]?.deviceId,
        eventType: rule.triggerType === 'SENSOR' ? 'SENSOR_READING' : 'EVENT',
        data: data as Record<string, unknown>,
      }));
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể chạy thử.'); }
  };

  const addCondition = () => setConditions((items) => [...items, { deviceId: devices[0]?.id || '', attribute: 'temperature', operator: 'GT', expected: '30', logicalOperator: 'AND' }]);
  const addAction = () => {
    const device = devices.find((candidate) => getDeviceActions(candidate).length > 0);
    const option = getDeviceActions(device)[0];
    if (device && option) setActions((items) => [...items, { deviceId: device.id, action: option.code, value: option.defaultValue }]);
  };
  const addSceneAction = () => {
    if (availableScenes[0]) setActions((items) => [...items, { deviceId: '', sceneId: availableScenes[0].id, action: 'EXECUTE_SCENE', value: '' }]);
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
  const availableScenes = scenes.filter((scene) => scene.enabled && scene.actions.length > 0);

  return <main className="min-h-screen bg-slate-950 p-6 text-slate-100"><div className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Quy tắc tự động</h1><p className="text-xs text-muted">Nhà: {homeId}</p></div><nav aria-label="Điều hướng tự động hóa" className="flex flex-wrap gap-2"><Link to={`/homes/${homeId}/scenes`} className="rounded-xl bg-sidebar px-3 py-2 text-sm text-text">Kịch bản</Link><Link to={`/homes/${homeId}/recommendations`} className="rounded-xl bg-sidebar px-3 py-2 text-sm text-text">Gợi ý AI</Link><Link to="/home" className="button">Về trang chủ</Link></nav></header>
    {error && <p role="alert" className="rounded-lg bg-rose-950 p-3 text-rose-300">{error}</p>}
    {success && <p role="status" className="rounded-xl bg-success-soft p-3 text-text">{success}</p>}
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-semibold">Danh sách quy tắc</h2>
        {rules.map((rule) => <article key={rule.id} className="rounded-xl border border-slate-700 p-4">
          <div className="flex justify-between gap-3"><div><h3>{rule.name}</h3><p className="text-sm text-slate-400">{triggerLabels[rule.triggerType]} · {rule.conditions.length} điều kiện · {rule.actions.length} hành động</p></div>
            <div className="flex flex-wrap gap-2 text-sm"><button type="button" onClick={() => edit(rule)} className="rounded-xl bg-sidebar px-3 py-2 text-text">Sửa</button><button type="button" onClick={() => openTest(rule)} className="rounded-xl bg-sidebar px-3 py-2 text-text">Chạy thử</button><button type="button" onClick={() => void showHistory(rule.id)} className="rounded-xl bg-sidebar px-3 py-2 text-text">Lịch sử</button>{rule.triggerType === 'SCHEDULE' && <button type="button" onClick={() => setScheduleRuleId(scheduleRuleId === rule.id ? null : rule.id)} className="rounded-xl bg-sidebar px-3 py-2 text-text">Lịch chạy</button>}<button type="button" onClick={() => void toggleAutomationRule(homeId, rule.id, !rule.enabled).then(load).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Không thể đổi trạng thái'))} className="rounded-xl bg-primary px-3 py-2 text-white">{rule.enabled ? 'Tắt' : 'Bật'}</button><button type="button" onClick={() => void remove(rule)} className="rounded-xl bg-error-soft px-3 py-2 text-text">Xóa</button></div>
          </div>
          {testRuleId === rule.id && <div className="mt-3 space-y-2 rounded-xl bg-info-soft p-3 text-sm text-text"><label className="block">Dữ liệu sự kiện để chạy thử<textarea value={testData} onChange={(event) => setTestData(event.target.value)} className="input mt-1" /></label><button type="button" onClick={() => void runTest(rule)} className="rounded-xl bg-primary px-3 py-2 font-semibold text-white">Kiểm tra điều kiện</button>{testResult && <p role="status">{testResult.matched ? `Khớp điều kiện · ${testResult.proposedActions.length} hành động sẽ chạy` : 'Không khớp điều kiện'}. Chạy thử không gửi lệnh tới thiết bị.</p>}</div>}
          {historyRuleId === rule.id && <div className="mt-3 rounded-xl bg-sidebar p-3 text-sm text-text">{executions.length ? executions.map((item) => <div key={item.id} className="border-b border-line py-2 last:border-0"><p>{new Date(item.matchedAt).toLocaleString('vi-VN')} · {item.triggerSource} · {item.status}</p><ol className="mt-1 list-inside list-decimal text-muted">{item.resultDetail.map((result, index) => <li key={`${item.id}-${index}`}>{result.sceneId ? scenes.find((scene) => scene.id === result.sceneId)?.name ?? result.sceneId : devices.find((device) => device.id === result.deviceId)?.name ?? result.deviceId}: {result.action} · {result.status}</li>)}</ol></div>) : 'Chưa có lần thực thi nào.'}</div>}
          {scheduleRuleId === rule.id && <SchedulePanel homeId={homeId} kind="automation-rules" targetId={rule.id} />}
        </article>)}
        {!rules.length && <p className="text-sm text-slate-400">Chưa có quy tắc.</p>}
      </section>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{editingRule ? 'Sửa quy tắc' : 'Tạo quy tắc tự động'}</h2>{editingRule && <button type="button" onClick={clearEditor} className="text-sm text-primary-hover">Tạo mới</button>}</div>
        <label className="block text-sm">Tên<input required value={name} onChange={(e) => setName(e.target.value)} className="input mt-1" /></label>
        <label className="block text-sm">Mô tả<textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input mt-1" /></label>
        <label className="block text-sm">Loại kích hoạt<select value={triggerType} onChange={(e) => { const next = e.target.value as typeof triggerType; setTriggerType(next); if (next === 'SCHEDULE') setConditions([]); }} className="input mt-1"><option value="SENSOR">Dữ liệu cảm biến</option><option value="EVENT">Sự kiện</option><option value="SCHEDULE">Theo lịch</option></select></label>
        <div className="flex justify-between"><h3>Điều kiện{triggerType === 'SCHEDULE' ? ' · thời gian được đặt trong lịch' : ''}</h3>{triggerType !== 'SCHEDULE' && <button type="button" disabled={!devices.length} onClick={addCondition} className="button">+ Thêm</button>}</div>
        {conditions.map((condition, index) => <div key={index} className="grid gap-2 rounded-xl border border-slate-700 p-3 sm:grid-cols-2">
          <label className="text-sm">Thiết bị<select value={condition.deviceId} onChange={(e) => updateCondition(index, { deviceId: e.target.value })} className="input mt-1">{devices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}</select></label>
          <label className="text-sm">Thuộc tính<input value={condition.attribute} onChange={(e) => updateCondition(index, { attribute: e.target.value })} className="input mt-1" /></label>
          <label className="text-sm">So sánh<select value={condition.operator} onChange={(e) => updateCondition(index, { operator: e.target.value as DraftCondition['operator'] })} className="input mt-1">{conditionOperators.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label>
          <label className="text-sm">Giá trị điều kiện<input value={condition.expected} onChange={(e) => updateCondition(index, { expected: e.target.value })} className="input mt-1" /></label>
          <button type="button" onClick={() => setConditions((items) => items.filter((_, i) => i !== index))} className="text-left text-sm text-rose-400">Xóa điều kiện</button>
        </div>)}
        <div className="flex justify-between"><h3>Hành động</h3><div className="flex gap-2"><button type="button" disabled={!hasActionableDevice} onClick={addAction} className="button">+ Thiết bị</button><button type="button" disabled={!availableScenes.length} onClick={addSceneAction} className="button">+ Kịch bản</button></div></div>
        {!hasActionableDevice && !availableScenes.length && <p className="text-sm text-amber-300">Chưa có thiết bị hoặc kịch bản hỗ trợ hành động tự động.</p>}
        {actions.map((action, index) => {
          if (action.action === 'EXECUTE_SCENE') return <div key={index} className="space-y-2 rounded-xl border border-slate-700 p-3"><label className="block text-sm">Kịch bản hành động {index + 1}<select value={action.sceneId ?? ''} onChange={(event) => updateAction(index, { sceneId: event.target.value })} className="input mt-1">{availableScenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.name}</option>)}</select></label><button type="button" onClick={() => setActions((items) => items.filter((_, i) => i !== index))} className="text-sm text-rose-400">Xóa hành động</button></div>;
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
        <button disabled={(triggerType !== 'SCHEDULE' && !conditions.length) || !actions.length || actions.some((item) => item.action === 'EXECUTE_SCENE' ? !availableScenes.some((scene) => scene.id === item.sceneId) : !getDeviceActions(devices.find((device) => device.id === item.deviceId)).some((option) => option.code === item.action))} className="button w-full">{editingRule ? 'Lưu thay đổi' : 'Tạo quy tắc'}</button>
      </form>
    </div>
  </div></main>;
}

function parseValue(value: string): unknown {
  try { return JSON.parse(value) as unknown; } catch { return value; }
}
