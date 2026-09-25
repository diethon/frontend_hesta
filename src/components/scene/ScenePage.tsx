import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { createScene, deleteScene, executeScene, getDevices, getScene, getSceneActionTypes, getSceneExecutions, getScenes, updateScene } from '../../services/sceneApi';
import type { SceneActionType, SceneExecutionResponse, SceneResponse } from '../../types/scene';
import type { DeviceSummary } from '../../types/automation';
import { buildSceneActionInput, formatSceneAction, getSceneDeviceActions, sceneActionsToDraft, sceneToggleInput, type DraftSceneAction } from './sceneActions';
import { SchedulePanel } from '../ui/SchedulePanel';

export function ScenePage() {
  const { homeId = '', sceneId } = useParams();
  return <SceneWorkspace key={`${homeId}:${sceneId ?? 'new'}`} homeId={homeId} sceneId={sceneId} />;
}

function SceneWorkspace({ homeId, sceneId }: { homeId: string; sceneId?: string }) {
  const navigate = useNavigate();
  const [scenes, setScenes] = useState<SceneResponse[]>([]);
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [actionTypes, setActionTypes] = useState<SceneActionType[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [editingScene, setEditingScene] = useState<SceneResponse | null>(null);
  const [loadingScene, setLoadingScene] = useState(Boolean(sceneId));
  const [togglingSceneId, setTogglingSceneId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏠');
  const [description, setDescription] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [actions, setActions] = useState<DraftSceneAction[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [executions, setExecutions] = useState<SceneExecutionResponse[]>([]);
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    try {
      const [sceneResult, deviceResult, typeResult] = await Promise.all([getScenes(homeId), getDevices(homeId), getSceneActionTypes(homeId)]);
      setScenes(sceneResult);
      setDevices(deviceResult);
      setActionTypes(typeResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể tải dữ liệu');
    }
  }, [homeId]);

  useEffect(() => {
    let active = true;
    Promise.all([getScenes(homeId), getDevices(homeId), getSceneActionTypes(homeId)])
      .then(([sceneResult, deviceResult, typeResult]) => {
        if (!active) return;
        setScenes(sceneResult);
        setDevices(deviceResult);
        setActionTypes(typeResult);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : 'Không thể tải dữ liệu');
      })
      .finally(() => { if (active) setLoadingOptions(false); });
    return () => { active = false; };
  }, [homeId]);

  useEffect(() => {
    if (!sceneId) return;
    let active = true;
    getScene(homeId, sceneId)
      .then((scene) => {
        if (!active) return;
        setEditingScene(scene);
        setName(scene.name);
        setIcon(scene.icon ?? '🏠');
        setDescription(scene.description ?? '');
        setEnabled(scene.enabled);
        setActions(sceneActionsToDraft(scene.actions));
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : 'Không thể tải kịch bản.');
      })
      .finally(() => { if (active) setLoadingScene(false); });
    return () => { active = false; };
  }, [homeId, sceneId]);

  const addAction = () => {
    setActions((current) => [...current, { deviceId: '', action: '', value: '' }]);
  };

  const updateAction = (index: number, patch: Partial<DraftSceneAction>) =>
    setActions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));

  const changeActionDevice = (index: number, deviceId: string) => {
    const option = getSceneDeviceActions(devices.find((device) => device.id === deviceId), actionTypes)[0];
    updateAction(index, { deviceId, action: option?.code ?? '', value: option?.defaultValue ?? '' });
  };

  const changeActionType = (index: number, actionCode: string) => {
    const selected = devices.find((device) => device.id === actions[index]?.deviceId);
    const option = getSceneDeviceActions(selected, actionTypes).find((candidate) => candidate.code === actionCode);
    updateAction(index, { action: option?.code ?? '', value: option?.defaultValue ?? '' });
  };

  const moveAction = (index: number, direction: -1 | 1) => setActions((current) => {
    const target = index + direction;
    if (target < 0 || target >= current.length) return current;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const input = {
        name, icon, description, enabled,
        actions: actions.map((action, order) => buildSceneActionInput(action, order, devices, actionTypes)),
      };
      if (sceneId) {
        const updated = await updateScene(homeId, sceneId, input);
        setEditingScene(updated);
        setActions(sceneActionsToDraft(updated.actions));
        setSuccess('Đã lưu thay đổi kịch bản.');
      } else {
        await createScene(homeId, input);
        setName(''); setIcon('🏠'); setDescription(''); setActions([]);
        setSuccess('Đã tạo kịch bản.');
      }
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể lưu kịch bản. Vui lòng kiểm tra hành động.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (sceneId: string) => {
    if (!window.confirm('Xóa kịch bản này? Hành động này không thể hoàn tác.')) return;
    try {
      await deleteScene(homeId, sceneId);
      if (sceneId === editingScene?.id) navigate(`/homes/${homeId}/scenes`);
      else await load();
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể xóa kịch bản'); }
  };

  const run = async (scene: SceneResponse) => {
    setRunningId(scene.id);
    setError(''); setSuccess('');
    try {
      const result = await executeScene(homeId, scene.id);
      setSuccess(`Kịch bản “${scene.name}”: ${result.status} (${result.resultDetail.filter((item) => item.success).length}/${result.resultDetail.length} hành động thành công).`);
      if (historyId === scene.id) setExecutions(await getSceneExecutions(homeId, scene.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể chạy kịch bản.');
    } finally { setRunningId(null); }
  };

  const viewHistory = async (selectedId: string) => {
    if (historyId === selectedId) { setHistoryId(null); return; }
    setHistoryId(selectedId);
    setExecutions([]);
    try { setExecutions(await getSceneExecutions(homeId, selectedId)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể tải lịch sử.'); }
  };

  const toggle = async (scene: SceneResponse) => {
    setTogglingSceneId(scene.id);
    setError('');
    try {
      const updated = await updateScene(homeId, scene.id, sceneToggleInput(scene));
      setScenes((current) => current.map((item) => item.id === updated.id ? updated : item));
      if (scene.id === editingScene?.id) {
        setEditingScene(updated);
        setEnabled(updated.enabled);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể đổi trạng thái kịch bản.');
    } finally {
      setTogglingSceneId(null);
    }
  };

  return <FeatureShell title="Kịch bản" homeId={homeId}>
    {error && <p role="alert" className="rounded-lg bg-rose-950 p-3 text-rose-300">{error}</p>}
    {success && <p role="status" className="rounded-xl bg-success-soft p-3 text-text">{success}</p>}
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="mb-4 text-lg font-semibold">Danh sách kịch bản</h2>
        <div className="space-y-3">
          {scenes.map((scene) => <article key={scene.id} className={`rounded-xl border p-4 ${scene.id === sceneId ? 'border-cyan-500' : 'border-slate-700'}`}>
            <Link to={`/homes/${homeId}/scenes/${scene.id}`} className="block rounded focus-visible:outline-2 focus-visible:outline-cyan-400" aria-label={`Mở kịch bản ${scene.name} để sửa`}>
              <h3 className="font-medium text-cyan-300"><span aria-hidden="true">{scene.icon ?? '🏠'} </span>{scene.name}</h3>
              <p className="text-sm text-slate-400">{scene.actions.length} hành động · {scene.enabled ? 'Đang bật' : 'Đang tắt'}</p>
              <ol className="mt-2 list-inside list-decimal text-sm text-slate-300">
                {scene.actions.map((action) => <li key={action.id}>{action.targetDeviceName}: {formatSceneAction(action)}</li>)}
              </ol>
            </Link>
            <div className="mt-3 flex items-center justify-between border-t border-slate-700 pt-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <span>{scene.enabled ? 'Bật' : 'Tắt'}</span>
                <input type="checkbox" role="switch" aria-label={`Bật hoặc tắt kịch bản ${scene.name}`} checked={scene.enabled} disabled={togglingSceneId === scene.id || (saving && sceneId === scene.id)} onChange={() => void toggle(scene)} className="peer sr-only" />
                <span aria-hidden="true" className="relative h-6 w-11 rounded-full bg-slate-600 transition-colors after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-emerald-500 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-400" />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={!scene.enabled || runningId === scene.id} onClick={() => void run(scene)} className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{runningId === scene.id ? 'Đang chạy...' : 'Chạy'}</button>
                <button type="button" onClick={() => void viewHistory(scene.id)} className="rounded-xl bg-sidebar px-3 py-2 text-sm text-text">Lịch sử</button>
                <button type="button" onClick={() => setScheduleId(scheduleId === scene.id ? null : scene.id)} className="rounded-xl bg-sidebar px-3 py-2 text-sm text-text">Lịch chạy</button>
                <button type="button" onClick={() => void remove(scene.id)} className="rounded-xl bg-error-soft px-3 py-2 text-sm text-text">Xóa</button>
              </div>
            </div>
            {historyId === scene.id && <section aria-label={`Lịch sử kịch bản ${scene.name}`} className="mt-3 rounded-xl bg-sidebar p-3 text-sm text-text">
              {!executions.length ? 'Chưa có lần chạy nào.' : executions.map((item) => <div key={item.id} className="border-b border-line py-2 last:border-0">
                <p>{new Date(item.startedAt).toLocaleString('vi-VN')} · {item.triggerSource === 'MANUAL' ? 'Thủ công' : item.triggerSource === 'AUTOMATION' ? 'Quy tắc tự động' : 'Theo lịch'} · {item.status}</p>
                <p className="text-muted">{item.resultDetail.filter((result) => result.success).length}/{item.resultDetail.length} hành động thành công</p>
                <ol className="mt-1 list-inside list-decimal text-muted">{item.resultDetail.map((result, index) => <li key={`${result.deviceId}-${index}`}>{scene.actions.find((action) => action.targetDeviceId === result.deviceId)?.targetDeviceName ?? result.deviceId}: {result.action} · {result.status}{result.message ? ` · ${result.message}` : ''}</li>)}</ol>
              </div>)}
            </section>}
            {scheduleId === scene.id && <SchedulePanel homeId={homeId} kind="scenes" targetId={scene.id} />}
          </article>)}
          {!scenes.length && <p className="text-sm text-slate-400">Chưa có kịch bản.</p>}
        </div>
      </section>

      {loadingScene ? <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">Đang tải kịch bản...</section> : sceneId && !editingScene ? <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p>Không thể mở kịch bản này.</p><Link to={`/homes/${homeId}/scenes`} className="text-cyan-300">Về danh sách</Link></section> : <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{sceneId ? 'Sửa kịch bản' : 'Tạo kịch bản'}</h2>{sceneId && <Link to={`/homes/${homeId}/scenes`} className="text-sm text-cyan-300">Tạo kịch bản mới</Link>}</div>
        <Field label="Tên"><input required maxLength={150} value={name} onChange={(e) => setName(e.target.value)} className="input" /></Field>
        <Field label="Biểu tượng"><select value={icon} onChange={(e) => setIcon(e.target.value)} className="input"><option value="🏠">🏠 Nhà</option><option value="💡">💡 Đèn</option><option value="🌙">🌙 Ban đêm</option><option value="☀️">☀️ Buổi sáng</option><option value="❄️">❄️ Làm mát</option></select></Field>
        <Field label="Mô tả"><textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input" /></Field>
        <label className="flex gap-2"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Bật kịch bản</label>
        <div className="flex items-center justify-between"><h3 className="font-medium">Hành động</h3><button type="button" onClick={addAction} disabled={saving || loadingOptions || !devices.length || !actionTypes.length} className="button">+ Thêm</button></div>
        {loadingOptions ? <p className="text-sm text-muted">Đang tải thiết bị và hành động...</p> : !devices.length && <p className="text-sm text-muted">Chưa có thiết bị đã ghép nối trong nhà này.</p>}
        {actions.map((action, index) => {
          const selectedDevice = devices.find((device) => device.id === action.deviceId);
          const availableActions = getSceneDeviceActions(selectedDevice, actionTypes);
          const selectedOption = availableActions.find((option) => option.code === action.action);
          return <div key={index} className="space-y-2 rounded-xl border border-slate-700 p-3">
            <label className="block text-sm">Thiết bị hành động {index + 1}<select required value={action.deviceId} onChange={(e) => changeActionDevice(index, e.target.value)} className="input mt-1">
              <option value="" disabled>Chọn thiết bị đã ghép nối</option>
              {devices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}
            </select></label>
            <label className="block text-sm">Hành động<select required value={action.action} onChange={(e) => changeActionType(index, e.target.value)} disabled={!selectedDevice || !availableActions.length} className="input mt-1">
              {!selectedDevice && <option value="">Chọn thiết bị trước</option>}
              {selectedDevice && !availableActions.length && <option value="">Không có hành động phù hợp</option>}
              {availableActions.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
            </select></label>
            {selectedOption?.valueKind === 'none' && <p className="text-sm text-slate-400">Hành động này không cần nhập giá trị.</p>}
            {(selectedOption?.valueKind === 'percentage' || selectedOption?.valueKind === 'number') && <label className="block text-sm">{selectedOption.valueLabel}<input required type="number" min={selectedOption.valueKind === 'percentage' ? 0 : undefined} max={selectedOption.valueKind === 'percentage' ? 100 : undefined} step={selectedOption.valueKind === 'percentage' ? 1 : 'any'} value={action.value} onChange={(e) => updateAction(index, { value: e.target.value })} className="input mt-1" /></label>}
            {selectedOption?.valueKind === 'json' && <label className="block text-sm">{selectedOption.valueLabel}<textarea required value={action.value} onChange={(e) => updateAction(index, { value: e.target.value })} className="input mt-1" placeholder='{"power": "ON"}' /></label>}
            {selectedDevice && !selectedOption && <p className="text-sm text-muted">Thiết bị này chưa hỗ trợ hành động hợp lệ cho kịch bản. Hãy chọn thiết bị khác.</p>}
            <div className="flex gap-3 text-sm"><button type="button" aria-label={`Đưa hành động ${index + 1} lên`} disabled={index === 0} onClick={() => moveAction(index, -1)}>↑</button><button type="button" aria-label={`Đưa hành động ${index + 1} xuống`} disabled={index === actions.length - 1} onClick={() => moveAction(index, 1)}>↓</button><button type="button" onClick={() => setActions((items) => items.filter((_, i) => i !== index))} className="text-rose-400">Xóa</button></div>
          </div>;
        })}
        <button disabled={saving || !actionTypes.length || actions.some((item) => !getSceneDeviceActions(devices.find((device) => device.id === item.deviceId), actionTypes).some((option) => option.code === item.action))} className="button w-full">{saving ? 'Đang lưu...' : sceneId ? 'Lưu thay đổi' : 'Tạo kịch bản'}</button>
      </form>}
    </div>
  </FeatureShell>;
}

function FeatureShell({ title, homeId, children }: { title: string; homeId: string; children: React.ReactNode }) {
  return <main className="min-h-screen bg-slate-950 p-6 text-slate-100"><div className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">{title}</h1><p className="text-xs text-muted">Nhà: {homeId}</p></div><nav aria-label="Điều hướng tự động hóa" className="flex gap-2"><Link to={`/homes/${homeId}/automation-rules`} className="rounded-xl bg-sidebar px-3 py-2 text-sm text-text">Quy tắc</Link><Link to="/home" className="button">Về trang chủ</Link></nav></header>
    {children}
  </div></main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-sm text-slate-300">{label}</span>{children}</label>;
}
