import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getDevicesByHome } from '../../services/deviceApi';
import {
  addSceneAction,
  createScene,
  deleteScene,
  getScene,
  listScenes,
  removeSceneAction,
  reorderSceneActions,
  updateScene,
} from '../../services/sceneApi';
import type { DeviceResponse } from '../../types/device';
import type { SceneActionType, SceneResponse } from '../../types/scene';

interface SceneManagementProps {
  homeId: string;
  currentUserRole: 'OWNER' | 'MEMBER';
}

const ACTION_LABELS: Record<SceneActionType, string> = {
  TURN_ON: 'Bật thiết bị',
  TURN_OFF: 'Tắt thiết bị',
  SET_BRIGHTNESS: 'Đặt độ sáng',
  SET_TEMPERATURE: 'Đặt nhiệt độ',
  SET_SPEED: 'Đặt tốc độ',
  SET_STATE: 'Đặt trạng thái JSON',
};

const ACTIONS = Object.keys(ACTION_LABELS) as SceneActionType[];

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : 'Đã xảy ra lỗi. Vui lòng thử lại.';

const displayValue = (value: unknown) => {
  if (value === null || value === undefined) return 'Không có giá trị';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
};

export const SceneManagement: React.FC<SceneManagementProps> = ({ homeId, currentUserRole }) => {
  const isOwner = currentUserRole === 'OWNER';
  const [scenes, setScenes] = useState<SceneResponse[]>([]);
  const [devices, setDevices] = useState<DeviceResponse[]>([]);
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
  const [actionType, setActionType] = useState<SceneActionType>('TURN_OFF');
  const [actionValue, setActionValue] = useState('');

  const selectedScene = useMemo(
    () => scenes.find((scene) => scene.id === selectedId) ?? null,
    [scenes, selectedId],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sceneData, deviceData] = await Promise.all([
        listScenes(homeId),
        getDevicesByHome(homeId),
      ]);
      setScenes(sceneData);
      setDevices(deviceData);
      setActionDeviceId((current) => current || deviceData[0]?.id || '');
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
        ? await updateScene(homeId, editingId, { name: name.trim(), description: description.trim(), enabled })
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

  const parseActionValue = (): unknown | null => {
    if (actionType === 'TURN_ON' || actionType === 'TURN_OFF') return null;
    if (actionType === 'SET_STATE') {
      const parsed: unknown = JSON.parse(actionValue);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        throw new Error('Trạng thái phải là một đối tượng JSON.');
      }
      return parsed;
    }
    const parsed = Number(actionValue);
    if (!Number.isFinite(parsed)) throw new Error('Giá trị hành động phải là số.');
    return parsed;
  };

  const addAction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedScene || !actionDeviceId) return;
    setSaving(true);
    setError(null);
    try {
      await addSceneAction(homeId, selectedScene.id, {
        targetDeviceId: actionDeviceId,
        action: actionType,
        value: parseActionValue(),
        order: selectedScene.actions.length,
      });
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
    <section className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 shadow-xl">
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

      {error && <div className="mb-4 rounded-lg border border-rose-800 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">{error}</div>}
      {loading ? (
        <p className="text-sm text-slate-400">Đang tải kịch bản...</p>
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
                      <p className="truncate text-xs text-slate-500">{ACTION_LABELS[action.action]} · {displayValue(action.value)}</p>
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
                <form onSubmit={addAction} className="grid gap-2 border-t border-slate-800 pt-4 md:grid-cols-4">
                  <select required value={actionDeviceId} onChange={(event) => setActionDeviceId(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                    <option value="">Chọn thiết bị</option>
                    {devices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}
                  </select>
                  <select value={actionType} onChange={(event) => { setActionType(event.target.value as SceneActionType); setActionValue(''); }} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                    {ACTIONS.map((action) => <option key={action} value={action}>{ACTION_LABELS[action]}</option>)}
                  </select>
                  <input
                    value={actionValue}
                    onChange={(event) => setActionValue(event.target.value)}
                    disabled={actionType === 'TURN_ON' || actionType === 'TURN_OFF'}
                    required={actionType !== 'TURN_ON' && actionType !== 'TURN_OFF'}
                    placeholder={actionType === 'SET_STATE' ? '{"mode":"eco"}' : 'Giá trị'}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm disabled:opacity-40"
                  />
                  <button disabled={saving || devices.length === 0} className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium disabled:opacity-50">Thêm hành động</button>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <form onSubmit={saveScene} className="w-full max-w-md space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">{editingId ? 'Chỉnh sửa kịch bản' : 'Tạo kịch bản'}</h3>
            <input required maxLength={150} value={name} onChange={(event) => setName(event.target.value)} placeholder="Tên kịch bản" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />
            <textarea maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Mô tả" rows={3} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
              Bật kịch bản
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowEditor(false)} className="rounded-lg bg-slate-800 px-4 py-2 text-sm">Hủy</button>
              <button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu'}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};
