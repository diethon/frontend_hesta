import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { createScene, deleteScene, getDevices, getScene, getScenes, updateScene } from '../../services/sceneApi';
import type { DeviceSummary, Scene } from '../../types/automation';
import { buildSceneActionInput, formatSceneAction, getSceneDeviceActions, sceneActionsToDraft, sceneToggleInput, type DraftSceneAction } from './sceneActions';

export function ScenePage() {
  const { homeId = '', sceneId } = useParams();
  return <SceneWorkspace key={`${homeId}:${sceneId ?? 'new'}`} homeId={homeId} sceneId={sceneId} />;
}

function SceneWorkspace({ homeId, sceneId }: { homeId: string; sceneId?: string }) {
  const navigate = useNavigate();
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [editingScene, setEditingScene] = useState<Scene | null>(null);
  const [loadingScene, setLoadingScene] = useState(Boolean(sceneId));
  const [togglingSceneId, setTogglingSceneId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [actions, setActions] = useState<DraftSceneAction[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [sceneResult, deviceResult] = await Promise.all([getScenes(homeId), getDevices(homeId)]);
      setScenes(sceneResult);
      setDevices(deviceResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể tải dữ liệu');
    }
  }, [homeId]);

  useEffect(() => {
    let active = true;
    Promise.all([getScenes(homeId), getDevices(homeId)])
      .then(([sceneResult, deviceResult]) => {
        if (!active) return;
        setScenes(sceneResult);
        setDevices(deviceResult);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : 'Không thể tải dữ liệu');
      });
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
    const device = devices.find((candidate) => getSceneDeviceActions(candidate).length > 0);
    const option = getSceneDeviceActions(device)[0];
    if (device && option) setActions((current) => [...current, {
      deviceId: device.id, action: option.code, value: option.defaultValue,
    }]);
  };

  const updateAction = (index: number, patch: Partial<DraftSceneAction>) =>
    setActions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));

  const changeActionDevice = (index: number, deviceId: string) => {
    const option = getSceneDeviceActions(devices.find((device) => device.id === deviceId))[0];
    updateAction(index, { deviceId, action: option?.code ?? '', value: option?.defaultValue ?? '' });
  };

  const changeActionType = (index: number, actionCode: string) => {
    const selected = devices.find((device) => device.id === actions[index]?.deviceId);
    const option = getSceneDeviceActions(selected).find((candidate) => candidate.code === actionCode);
    updateAction(index, { action: option?.code ?? '', value: option?.defaultValue ?? '' });
  };

  const hasActionableDevice = devices.some((device) => getSceneDeviceActions(device).length > 0);

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
    try {
      const input = {
        name, description, enabled,
        actions: actions.map((action, order) => buildSceneActionInput(action, order, devices)),
      };
      if (sceneId) {
        const updated = await updateScene(homeId, sceneId, input);
        setEditingScene(updated);
        setActions(sceneActionsToDraft(updated.actions));
      } else {
        await createScene(homeId, input);
        setName(''); setDescription(''); setActions([]);
      }
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể lưu kịch bản. Vui lòng kiểm tra hành động.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (sceneId: string) => {
    try {
      await deleteScene(homeId, sceneId);
      if (sceneId === editingScene?.id) navigate(`/homes/${homeId}/scenes`);
      else await load();
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể xóa kịch bản'); }
  };

  const toggle = async (scene: Scene) => {
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
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="mb-4 text-lg font-semibold">Danh sách kịch bản</h2>
        <div className="space-y-3">
          {scenes.map((scene) => <article key={scene.id} className={`rounded-xl border p-4 ${scene.id === sceneId ? 'border-cyan-500' : 'border-slate-700'}`}>
            <Link to={`/homes/${homeId}/scenes/${scene.id}`} className="block rounded focus-visible:outline-2 focus-visible:outline-cyan-400" aria-label={`Mở kịch bản ${scene.name} để sửa`}>
              <h3 className="font-medium text-cyan-300">{scene.name}</h3>
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
              <button type="button" onClick={() => void remove(scene.id)} className="text-sm text-rose-400">Xóa</button>
            </div>
          </article>)}
          {!scenes.length && <p className="text-sm text-slate-400">Chưa có kịch bản.</p>}
        </div>
      </section>

      {loadingScene ? <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">Đang tải kịch bản...</section> : sceneId && !editingScene ? <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p>Không thể mở kịch bản này.</p><Link to={`/homes/${homeId}/scenes`} className="text-cyan-300">Về danh sách</Link></section> : <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{sceneId ? 'Sửa kịch bản' : 'Tạo kịch bản'}</h2>{sceneId && <Link to={`/homes/${homeId}/scenes`} className="text-sm text-cyan-300">Tạo kịch bản mới</Link>}</div>
        <Field label="Tên"><input required maxLength={150} value={name} onChange={(e) => setName(e.target.value)} className="input" /></Field>
        <Field label="Mô tả"><textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input" /></Field>
        <label className="flex gap-2"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Bật kịch bản</label>
        <div className="flex items-center justify-between"><h3 className="font-medium">Hành động</h3><button type="button" onClick={addAction} disabled={!hasActionableDevice} className="button">+ Thêm</button></div>
        {!hasActionableDevice && <p className="text-sm text-amber-300">Chưa có thiết bị hỗ trợ hành động trong kịch bản.</p>}
        {actions.map((action, index) => {
          const selectedDevice = devices.find((device) => device.id === action.deviceId);
          const availableActions = getSceneDeviceActions(selectedDevice);
          const selectedOption = availableActions.find((option) => option.code === action.action);
          return <div key={index} className="space-y-2 rounded-xl border border-slate-700 p-3">
            <label className="block text-sm">Thiết bị hành động {index + 1}<select value={action.deviceId} onChange={(e) => changeActionDevice(index, e.target.value)} className="input mt-1">
              {devices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}
            </select></label>
            <label className="block text-sm">Hành động<select value={action.action} onChange={(e) => changeActionType(index, e.target.value)} disabled={!availableActions.length} className="input mt-1">
              {!availableActions.length && <option value="">Không có hành động phù hợp</option>}
              {availableActions.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
            </select></label>
            {selectedOption?.valueKind === 'none' && <p className="text-sm text-slate-400">Hành động này không cần nhập giá trị.</p>}
            {(selectedOption?.valueKind === 'percentage' || selectedOption?.valueKind === 'number') && <label className="block text-sm">{selectedOption.valueLabel}<input required type="number" min={selectedOption.valueKind === 'percentage' ? 0 : undefined} max={selectedOption.valueKind === 'percentage' ? 100 : undefined} step={selectedOption.valueKind === 'percentage' ? 1 : 'any'} value={action.value} onChange={(e) => updateAction(index, { value: e.target.value })} className="input mt-1" /></label>}
            {selectedOption?.valueKind === 'json' && <label className="block text-sm">{selectedOption.valueLabel}<textarea required value={action.value} onChange={(e) => updateAction(index, { value: e.target.value })} className="input mt-1" placeholder='{"power": "ON"}' /></label>}
            {!selectedOption && <p className="text-sm text-amber-300">Thiết bị này chưa khai báo hành động hợp lệ cho kịch bản. Hãy chọn thiết bị khác.</p>}
            <div className="flex gap-3 text-sm"><button type="button" aria-label={`Đưa hành động ${index + 1} lên`} disabled={index === 0} onClick={() => moveAction(index, -1)}>↑</button><button type="button" aria-label={`Đưa hành động ${index + 1} xuống`} disabled={index === actions.length - 1} onClick={() => moveAction(index, 1)}>↓</button><button type="button" onClick={() => setActions((items) => items.filter((_, i) => i !== index))} className="text-rose-400">Xóa</button></div>
          </div>;
        })}
        <button disabled={saving || actions.some((item) => !getSceneDeviceActions(devices.find((device) => device.id === item.deviceId)).some((option) => option.code === item.action))} className="button w-full">{saving ? 'Đang lưu...' : sceneId ? 'Lưu thay đổi' : 'Tạo kịch bản'}</button>
      </form>}
    </div>
  </FeatureShell>;
}

function FeatureShell({ title, homeId, children }: { title: string; homeId: string; children: React.ReactNode }) {
  return <main className="min-h-screen bg-slate-950 p-6 text-slate-100"><div className="mx-auto max-w-6xl space-y-5">
    <header className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">{title}</h1><p className="text-xs text-slate-500">Nhà: {homeId}</p></div><Link to="/home" className="button">Về trang chủ</Link></header>
    {children}
  </div></main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-sm text-slate-300">{label}</span>{children}</label>;
}
