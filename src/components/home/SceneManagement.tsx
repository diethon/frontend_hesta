import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getDevicesByHome } from '../../services/deviceApi';
import {
  addSceneAction,
  createScene,
  deleteScene,
  getScene,
  getSceneActionTypes,
  listScenes,
  removeSceneAction,
  reorderSceneActions,
  updateScene,
} from '../../services/sceneApi';
import type { DeviceResponse } from '../../types/device';
import type { SceneActionType, SceneResponse } from '../../types/scene';
import { buildSceneActionInput, formatSceneAction, getSceneDeviceActions } from '../scene/sceneActions';

interface SceneManagementProps {
  homeId: string;
  currentUserRole: 'OWNER' | 'MEMBER';
}

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : 'Đã xảy ra lỗi. Vui lòng thử lại.';

export const SceneManagement: React.FC<SceneManagementProps> = ({ homeId, currentUserRole }) => {
  const isOwner = currentUserRole === 'OWNER';
  const [scenes, setScenes] = useState<SceneResponse[]>([]);
  const [devices, setDevices] = useState<DeviceResponse[]>([]);
  const [actionTypes, setActionTypes] = useState<SceneActionType[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [actionDeviceId, setActionDeviceId] = useState('');
  const [actionType, setActionType] = useState('');
  const [actionValue, setActionValue] = useState('');

  const selectedScene = useMemo(
    () => scenes.find((scene) => scene.id === selectedId) ?? null,
    [scenes, selectedId],
  );
  const selectedDevice = devices.find((device) => device.id === actionDeviceId);
  const availableActions = getSceneDeviceActions(selectedDevice, actionTypes);
  const selectedAction = availableActions.find((action) => action.code === actionType);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sceneData, deviceData, typeData] = await Promise.all([
        listScenes(homeId),
        getDevicesByHome(homeId),
        getSceneActionTypes(homeId),
      ]);
      setScenes(sceneData);
      setDevices(deviceData);
      setActionTypes(typeData);
      setActionDeviceId('');
      setActionType('');
      setActionValue('');
      setSelectedId((current) =>
        current && sceneData.some((scene) => scene.id === current)
          ? current
          : sceneData[0]?.id ?? null,
      );
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }, [homeId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const refreshScene = async (sceneId: string) => {
    const scene = await getScene(homeId, sceneId);
    setScenes((current) => current.map((item) => (item.id === scene.id ? scene : item)));
    setSelectedId(scene.id);
  };

  const openCreate = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setEnabled(true);
    setShowEditor(true);
  };

  const openEdit = (scene: SceneResponse) => {
    setEditingId(scene.id);
    setName(scene.name);
    setDescription(scene.description || '');
    setEnabled(scene.enabled);
    setShowEditor(true);
  };

  const saveScene = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const scene = editingId
        ? await updateScene(homeId, editingId, { name: name.trim(), icon: scenes.find((scene) => scene.id === editingId)?.icon,
            description: description.trim(), enabled })
        : await createScene(homeId, { name: name.trim(), description: description.trim(), enabled, actions: [] });
      setScenes((current) =>
        editingId
          ? current.map((item) => (item.id === scene.id ? scene : item))
          : [...current, scene],
      );
      setSelectedId(scene.id);
      setShowEditor(false);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  };

  const removeScene = async (scene: SceneResponse) => {
    if (!window.confirm(`Xóa kịch bản “${scene.name}”?`)) return;
    setError(null);
    try {
      await deleteScene(homeId, scene.id);
      const remaining = scenes.filter((item) => item.id !== scene.id);
      setScenes(remaining);
      setSelectedId(remaining[0]?.id ?? null);
    } catch (err) {
      setError(messageOf(err));
    }
  };

  const addAction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedScene) return;
    setSaving(true);
    setError(null);
    try {
      const input = buildSceneActionInput(
        { deviceId: actionDeviceId, action: actionType, value: actionValue },
        selectedScene.actions.length, devices, actionTypes,
      );
      await addSceneAction(homeId, selectedScene.id, input);
      setActionValue('');
      await refreshScene(selectedScene.id);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  };

  const removeAction = async (actionId: string) => {
    if (!selectedScene) return;
    setError(null);
    try {
      await removeSceneAction(homeId, selectedScene.id, actionId);
      await refreshScene(selectedScene.id);
    } catch (err) {
      setError(messageOf(err));
    }
  };

  const moveAction = async (index: number, direction: -1 | 1) => {
    if (!selectedScene) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= selectedScene.actions.length) return;
    const reordered = [...selectedScene.actions];
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    setError(null);
    try {
      const updated = await reorderSceneActions(homeId, selectedScene.id, reordered.map((action) => action.id));
      setScenes((current) => current.map((scene) => (scene.id === updated.id ? updated : scene)));
    } catch (err) {
      setError(messageOf(err));
    }
  };

  return (
    <section className="surface-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Quản lý Kịch bản</h2>
          <p className="text-xs text-slate-400 mt-1">Thiết lập chuỗi hành động; chưa thực thi trên thiết bị.</p>
        </div>
        {isOwner && (
          <button onClick={openCreate} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium">
            + Tạo kịch bản
          </button>
        )}
      </div>

      {error && <div role="alert" aria-live="polite" className="mb-4 rounded-lg border border-rose-800 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">{error}</div>}
      {loading ? (
        <p role="status" className="text-sm text-slate-400">Đang tải kịch bản…</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,2fr)]">
          <div className="space-y-2">
            {scenes.length === 0 && <p className="text-sm text-slate-500">Chưa có kịch bản nào.</p>}
            {scenes.map((scene) => (
              <button
                key={scene.id}
                onClick={() => setSelectedId(scene.id)}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedId === scene.id ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 bg-slate-950/30 hover:border-slate-700'}`}
              >
                <span className="block font-medium text-slate-100">{scene.name}</span>
                <span className="text-xs text-slate-400">{scene.actions.length} hành động · {scene.enabled ? 'Đang bật' : 'Đang tắt'}</span>
              </button>
            ))}
          </div>

          {selectedScene && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="font-semibold text-white">{selectedScene.name}</h3>
                  <p className="mt-1 text-sm text-slate-400">{selectedScene.description || 'Không có mô tả'}</p>
                </div>
                {isOwner && (
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(selectedScene)} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700">Sửa</button>
                    <button onClick={() => void removeScene(selectedScene)} className="rounded-lg bg-rose-950 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-900">Xóa</button>
                  </div>
                )}
              </div>

              <div className="my-4 space-y-2">
                {selectedScene.actions.length === 0 && <p className="text-sm text-slate-500">Chưa có hành động.</p>}
                {selectedScene.actions.map((action, index) => (
                  <div key={action.id} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
                    <span className="w-6 text-center text-xs font-semibold text-slate-500">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-200">{action.targetDeviceName}</p>
                      <p className="truncate text-xs text-slate-500">{formatSceneAction(action)}</p>
                    </div>
                    {isOwner && (
                      <div className="flex gap-1">
                        <button disabled={index === 0} onClick={() => void moveAction(index, -1)} className="rounded bg-slate-800 px-2 py-1 text-xs disabled:opacity-30">↑</button>
                        <button disabled={index === selectedScene.actions.length - 1} onClick={() => void moveAction(index, 1)} className="rounded bg-slate-800 px-2 py-1 text-xs disabled:opacity-30">↓</button>
                        <button onClick={() => void removeAction(action.id)} className="rounded bg-rose-950 px-2 py-1 text-xs text-rose-300">Xóa</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {isOwner && (
                <form onSubmit={addAction} className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="block text-sm text-text">Thiết bị
                    <select required value={actionDeviceId} onChange={(event) => {
                      const nextDeviceId = event.target.value;
                      const firstAction = getSceneDeviceActions(devices.find((device) => device.id === nextDeviceId), actionTypes)[0];
                      setActionDeviceId(nextDeviceId);
                      setActionType(firstAction?.code ?? '');
                      setActionValue(firstAction?.defaultValue ?? '');
                    }} className="input mt-1">
                      <option value="" disabled>Chọn thiết bị đã ghép nối</option>
                      {devices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}
                    </select>
                  </label>
                  <label className="block text-sm text-text">Hành động
                    <select required value={actionType} onChange={(event) => {
                      const nextAction = availableActions.find((action) => action.code === event.target.value);
                      setActionType(nextAction?.code ?? '');
                      setActionValue(nextAction?.defaultValue ?? '');
                    }} disabled={!selectedDevice || !availableActions.length} className="input mt-1">
                      {!selectedDevice && <option value="">Chọn thiết bị trước</option>}
                      {selectedDevice && !availableActions.length && <option value="">Không có hành động phù hợp</option>}
                      {availableActions.map((action) => <option key={action.code} value={action.code}>{action.label}</option>)}
                    </select>
                  </label>
                  {(selectedAction?.valueKind === 'percentage' || selectedAction?.valueKind === 'number') && (
                    <label className="block text-sm text-text">{selectedAction.valueLabel}
                      <input required type="number" min={selectedAction.valueKind === 'percentage' ? 0 : undefined} max={selectedAction.valueKind === 'percentage' ? 100 : undefined} step={selectedAction.valueKind === 'percentage' ? 1 : 'any'} value={actionValue} onChange={(event) => setActionValue(event.target.value)} className="input mt-1" />
                    </label>
                  )}
                  {selectedAction?.valueKind === 'json' && (
                    <label className="block text-sm text-text">{selectedAction.valueLabel}
                      <textarea required value={actionValue} onChange={(event) => setActionValue(event.target.value)} placeholder='{"power":"ON"}' className="input mt-1" />
                    </label>
                  )}
                  {selectedDevice && !availableActions.length && <p className="text-sm text-muted sm:col-span-2 lg:col-span-3">Thiết bị này chưa hỗ trợ hành động hợp lệ cho kịch bản.</p>}
                  {!devices.length && <p className="text-sm text-muted sm:col-span-2 lg:col-span-3">Chưa có thiết bị đã ghép nối trong nhà này.</p>}
                  <button disabled={saving || !selectedAction} className="rounded-xl bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50 sm:col-span-2 lg:col-span-3">{saving ? 'Đang thêm...' : 'Thêm hành động'}</button>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-text/30 p-4 backdrop-blur-sm">
          <form aria-label={editingId ? 'Chỉnh sửa kịch bản' : 'Tạo kịch bản'} onSubmit={saveScene} className="auth-surface w-full max-w-md space-y-4 p-6">
            <h3 className="text-lg font-bold text-text">{editingId ? 'Chỉnh sửa kịch bản' : 'Tạo kịch bản'}</h3>
            <div>
              <label htmlFor="scene-name" className="mb-2 block text-sm font-medium text-text">Tên kịch bản</label>
              <input id="scene-name" required maxLength={150} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: Buổi tối thư giãn" autoComplete="off" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />
            </div>
            <div>
              <label htmlFor="scene-description" className="mb-2 block text-sm font-medium text-text">Mô tả</label>
              <textarea id="scene-description" maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Mô tả mục đích của kịch bản…" rows={3} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
              Bật kịch bản
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowEditor(false)} className="rounded-lg bg-slate-800 px-4 py-2 text-sm">Hủy</button>
              <button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium disabled:opacity-50">{saving ? 'Đang lưu…' : 'Lưu'}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};
