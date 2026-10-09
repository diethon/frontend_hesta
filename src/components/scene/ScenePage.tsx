import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  Play,
  Plus,
  Check,
  Search,
  Sparkles,
  Sliders,
  Layers,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Home,
  Zap,
  Trash2,
} from 'lucide-react';
import {
  createScene,
  deleteScene,
  executeScene,
  getDevices,
  getScene,
  getSceneActionTypes,
  getSceneExecutions,
  getScenes,
  updateScene,
} from '../../services/sceneApi';
import type { SceneActionType, SceneExecutionResponse, SceneResponse } from '../../types/scene';
import type { DeviceSummary } from '../../types/automation';
import {
  buildSceneActionInput,
  formatSceneAction,
  getSceneDeviceActions,
  sceneActionsToDraft,
  sceneToggleInput,
  type DraftSceneAction,
} from './sceneActions';
import { SchedulePanel } from '../ui/SchedulePanel';
import { SceneIcon } from './SceneIcon';
import { SCENE_PRESETS, detectSceneTheme, getDeviceTypeIcon, AVAILABLE_ICONS } from './sceneConstants';

export function ScenePage() {
  const { homeId = '', sceneId } = useParams();
  return <SceneWorkspace key={homeId} homeId={homeId} sceneId={sceneId} />;
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
  const [icon, setIcon] = useState('home');
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
  const [selectedSceneId, setSelectedSceneId] = useState(sceneId);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'enabled' | 'disabled'>('all');

  // Reset editor when navigating; keep the workspace data mounted.
  if (selectedSceneId !== sceneId) {
    setSelectedSceneId(sceneId);
    setEditingScene(null);
    setLoadingScene(Boolean(sceneId));
    setName('');
    setIcon('home');
    setDescription('');
    setEnabled(true);
    setActions([]);
    setError('');
    setSuccess('');
  }

  const load = useCallback(async () => {
    try {
      const [sceneResult, deviceResult, typeResult] = await Promise.all([
        getScenes(homeId),
        getDevices(homeId),
        getSceneActionTypes(homeId),
      ]);
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
      .finally(() => {
        if (active) setLoadingOptions(false);
      });
    return () => {
      active = false;
    };
  }, [homeId]);

  useEffect(() => {
    if (!sceneId) return;
    let active = true;
    getScene(homeId, sceneId)
      .then((scene) => {
        if (!active) return;
        setEditingScene(scene);
        setName(scene.name);
        setIcon(scene.icon ?? 'home');
        setDescription(scene.description ?? '');
        setEnabled(scene.enabled);
        setActions(sceneActionsToDraft(scene.actions));
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : 'Không thể tải kịch bản.');
      })
      .finally(() => {
        if (active) setLoadingScene(false);
      });
    return () => {
      active = false;
    };
  }, [homeId, sceneId]);

  const addAction = () => {
    const firstDev = devices[0];
    const available = firstDev ? getSceneDeviceActions(firstDev, actionTypes) : [];
    setActions((current) => [
      ...current,
      {
        deviceId: firstDev?.id ?? '',
        action: available[0]?.code ?? '',
        value: available[0]?.defaultValue ?? '',
      },
    ]);
  };

  const updateAction = (index: number, patch: Partial<DraftSceneAction>) =>
    setActions((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );

  const changeActionDevice = (index: number, deviceId: string) => {
    const option = getSceneDeviceActions(
      devices.find((device) => device.id === deviceId),
      actionTypes,
    )[0];
    updateAction(index, { deviceId, action: option?.code ?? '', value: option?.defaultValue ?? '' });
  };

  const changeActionType = (index: number, actionCode: string) => {
    const selected = devices.find((device) => device.id === actions[index]?.deviceId);
    const option = getSceneDeviceActions(selected, actionTypes).find(
      (candidate) => candidate.code === actionCode,
    );
    updateAction(index, { action: option?.code ?? '', value: option?.defaultValue ?? '' });
  };

  const moveAction = (index: number, direction: -1 | 1) =>
    setActions((current) => {
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
        name: name.trim(),
        icon,
        description: description.trim(),
        enabled,
        actions: actions.map((action, order) =>
          buildSceneActionInput(action, order, devices, actionTypes),
        ),
      };
      if (sceneId) {
        const updated = await updateScene(homeId, sceneId, input);
        setEditingScene(updated);
        setActions(sceneActionsToDraft(updated.actions));
        setSuccess('Đã lưu thay đổi kịch bản.');
      } else {
        await createScene(homeId, input);
        setName('');
        setIcon('home');
        setDescription('');
        setActions([]);
        setSuccess('Đã tạo kịch bản.');
      }
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Không thể lưu kịch bản. Vui lòng kiểm tra hành động.',
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (idToRemove: string) => {
    if (!window.confirm('Xóa kịch bản này? Hành động này không thể hoàn tác.')) return;
    try {
      await deleteScene(homeId, idToRemove);
      setScenes((current) => current.filter((scene) => scene.id !== idToRemove));
      if (idToRemove === editingScene?.id) navigate(`/homes/${homeId}/scenes`);
      else await load();
      setSuccess('Đã xóa kịch bản.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể xóa kịch bản');
    }
  };

  const run = async (scene: SceneResponse) => {
    setRunningId(scene.id);
    setError('');
    setSuccess('');
    try {
      const result = await executeScene(homeId, scene.id);
      const successCount = result.resultDetail.filter((item) => item.success).length;
      setSuccess(
        `Kịch bản “${scene.name}”: ${result.status} (${successCount}/${result.resultDetail.length} hành động thành công).`,
      );
      if (historyId === scene.id) setExecutions(await getSceneExecutions(homeId, scene.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể chạy kịch bản.');
    } finally {
      setRunningId(null);
    }
  };

  const viewHistory = async (selectedIdForHistory: string) => {
    if (historyId === selectedIdForHistory) {
      setHistoryId(null);
      return;
    }
    setHistoryId(selectedIdForHistory);
    setExecutions([]);
    try {
      setExecutions(await getSceneExecutions(homeId, selectedIdForHistory));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể tải lịch sử.');
    }
  };

  const toggle = async (scene: SceneResponse) => {
    setTogglingSceneId(scene.id);
    setError('');
    try {
      const updated = await updateScene(homeId, scene.id, sceneToggleInput(scene));
      setScenes((current) => current.map((item) => (item.id === updated.id ? updated : item)));
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

  const filteredScenes = useMemo(() => {
    return scenes.filter((scene) => {
      const matchesSearch =
        scene.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (scene.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (filterTab === 'enabled') return scene.enabled;
      if (filterTab === 'disabled') return !scene.enabled;
      return true;
    });
  }, [scenes, searchQuery, filterTab]);

  const activeCount = scenes.filter((s) => s.enabled).length;
  const totalActionsCount = scenes.reduce((acc, cur) => acc + cur.actions.length, 0);

  return (
    <FeatureShell title="Kịch bản" homeId={homeId}>
      {/* Alert Notices */}
      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-700 flex items-center justify-between gap-3 shadow-xs"
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
            ✕
          </button>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 flex items-center justify-between gap-3 shadow-xs"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0 stroke-[2.5]" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="text-emerald-600 hover:text-emerald-800">
            ✕
          </button>
        </div>
      )}

      {/* Modern Dashboard Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="surface-card p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Layers size={20} />
          </div>
          <div>
            <span className="text-xs text-muted block font-medium">Tổng kịch bản</span>
            <span className="text-xl font-bold text-text">{scenes.length}</span>
          </div>
        </div>

        <div className="surface-card p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <Check size={20} />
          </div>
          <div>
            <span className="text-xs text-muted block font-medium">Đang hoạt động</span>
            <span className="text-xl font-bold text-text">{activeCount}</span>
          </div>
        </div>

        <div className="surface-card p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
            <Zap size={20} />
          </div>
          <div>
            <span className="text-xs text-muted block font-medium">Tổng lệnh liên kết</span>
            <span className="text-xl font-bold text-text">{totalActionsCount}</span>
          </div>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Scene List */}
        <section className="surface-card p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <div>
              <h2 className="text-lg font-bold text-text tracking-tight">Danh sách kịch bản</h2>
              <p className="text-xs text-muted">
                Bấm vào kịch bản để xem và chỉnh sửa luồng thiết bị.
              </p>
            </div>
            {!sceneId && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                {scenes.length} kịch bản
              </span>
            )}
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Tìm kịch bản..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-line bg-surface text-xs text-text placeholder-muted focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  filterTab === 'all'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-muted hover:text-text'
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('enabled')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  filterTab === 'enabled'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-muted hover:text-text'
                }`}
              >
                Bật
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('disabled')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  filterTab === 'disabled'
                    ? 'bg-slate-600 text-white shadow-xs'
                    : 'text-muted hover:text-text'
                }`}
              >
                Tắt
              </button>
            </div>
          </div>

          {/* Scenes List */}
          <div className="space-y-3.5 pt-1">
            {filteredScenes.map((scene) => {
              const isSelected = scene.id === sceneId;
              const theme = detectSceneTheme(scene.name, scene.icon);

              return (
                <article
                  key={scene.id}
                  className={`relative overflow-hidden rounded-3xl border p-4 sm:p-5 transition-all duration-300 ${
                    isSelected
                      ? 'border-primary ring-4 ring-primary/15 bg-primary/5 shadow-md'
                      : 'border-line bg-surface hover:border-primary/40 shadow-2xs hover:shadow-xs'
                  }`}
                >
                  {/* Subtle top gradient accent */}
                  <div
                    className={`absolute inset-x-0 top-0 h-16 bg-gradient-to-b ${theme.bgGradient} opacity-70 pointer-events-none`}
                    aria-hidden="true"
                  />

                  <Link
                    to={`/homes/${homeId}/scenes/${scene.id}`}
                    className="relative z-10 block rounded-2xl focus-visible:outline-2 focus-visible:outline-primary"
                    aria-label={`Mở kịch bản ${scene.name} để sửa`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3.5">
                        <SceneIcon iconKey={scene.icon} name={scene.name} size="md" />
                        <div>
                          <h3 className="font-bold text-sm text-text flex items-center gap-1.5">
                            <span>{scene.name}</span>
                          </h3>
                          <p className="text-[11px] text-muted mt-0.5 font-medium">
                            {scene.actions.length} lệnh ·{' '}
                            {scene.enabled ? 'Đang bật' : 'Đang tắt'}
                          </p>
                        </div>
                      </div>

                      {/* State tag */}
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                          scene.enabled
                            ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-300/60'
                            : 'bg-slate-200/80 text-slate-600'
                        }`}
                      >
                        {scene.enabled ? 'SẴN SÀNG' : 'TẠM TẮT'}
                      </span>
                    </div>

                    {/* Actions summary preview */}
                    {scene.actions.length > 0 && (
                      <ol className="mt-3.5 space-y-1.5 rounded-2xl bg-sidebar/60 p-3 text-xs text-text border border-line/70">
                        {scene.actions.slice(0, 3).map((action) => {
                          const DevIcon = getDeviceTypeIcon(action.targetDeviceType);
                          return (
                            <li
                              key={action.id}
                              className="truncate text-[11px] flex items-center gap-2"
                            >
                              <DevIcon size={13} className="text-primary shrink-0" />
                              <span className="font-bold text-text truncate max-w-[120px]">
                                {action.targetDeviceName}:
                              </span>
                              <span className="text-muted truncate">
                                {formatSceneAction(action)}
                              </span>
                            </li>
                          );
                        })}
                        {scene.actions.length > 3 && (
                          <li className="text-[10px] text-primary font-bold pl-5">
                            +{scene.actions.length - 3} lệnh khác...
                          </li>
                        )}
                      </ol>
                    )}
                  </Link>

                  {/* Card Controls Footer */}
                  <div className="relative z-10 mt-4 flex flex-wrap items-center justify-between border-t border-line/70 pt-3 gap-2">
                    {/* Toggle Switch */}
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-text">
                      <span className="text-[11px] text-muted">{scene.enabled ? 'Bật' : 'Tắt'}</span>
                      <input
                        type="checkbox"
                        role="switch"
                        aria-label={`Bật hoặc tắt kịch bản ${scene.name}`}
                        checked={scene.enabled}
                        disabled={togglingSceneId === scene.id || (saving && sceneId === scene.id)}
                        onChange={() => void toggle(scene)}
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className="relative h-5 w-10 rounded-full bg-slate-300 transition-colors after:absolute after:left-1 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-emerald-500 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-primary shadow-xs"
                      />
                    </label>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        disabled={!scene.enabled || runningId === scene.id}
                        onClick={() => void run(scene)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary-hover px-3.5 py-1.5 text-xs font-bold text-white shadow-xs disabled:opacity-50 transition-all active:scale-95"
                      >
                        {runningId === scene.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Play size={11} className="fill-current" />
                        )}
                        <span>{runningId === scene.id ? 'Đang chạy...' : 'Chạy ngay'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void viewHistory(scene.id)}
                        className="rounded-xl border border-line bg-surface hover:bg-sidebar px-2.5 py-1.5 text-xs font-semibold text-text transition-colors shadow-2xs"
                      >
                        Lịch sử
                      </button>

                      <button
                        type="button"
                        onClick={() => setScheduleId(scheduleId === scene.id ? null : scene.id)}
                        className={`rounded-xl border border-line px-2.5 py-1.5 text-xs font-semibold transition-colors shadow-2xs ${
                          scheduleId === scene.id
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-surface hover:bg-sidebar text-text'
                        }`}
                      >
                        Lịch chạy
                      </button>

                      <button
                        type="button"
                        onClick={() => void remove(scene.id)}
                        className="rounded-xl bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition-colors border border-rose-200/60"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>

                  {/* Inline History Accordion */}
                  {historyId === scene.id && (
                    <section
                      aria-label={`Lịch sử kịch bản ${scene.name}`}
                      className="mt-3.5 rounded-2xl bg-sidebar/70 p-4 text-xs text-text border border-line space-y-2 animate-in fade-in"
                    >
                      <div className="flex items-center justify-between font-bold text-xs pb-1 border-b border-line/60">
                        <span>Lịch sử chạy gần đây</span>
                        <span className="text-[11px] text-muted">
                          {executions.length} lần thực thi
                        </span>
                      </div>
                      {!executions.length ? (
                        <p className="text-muted italic py-2">Chưa có lần chạy nào.</p>
                      ) : (
                        executions.map((item) => (
                          <div key={item.id} className="border-b border-line/60 py-2 last:border-0">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-text">
                                {new Date(item.startedAt).toLocaleString('vi-VN')}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  item.status === 'SUCCESS'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}
                              >
                                {item.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted mt-0.5">
                              Nguồn: {item.triggerSource === 'MANUAL' ? 'Thủ công' : item.triggerSource === 'AUTOMATION' ? 'Quy tắc tự động' : 'Theo lịch'} ·{' '}
                              {item.resultDetail.filter((result) => result.success).length}/
                              {item.resultDetail.length} hành động thành công
                            </p>
                          </div>
                        ))
                      )}
                    </section>
                  )}

                  {/* Inline Schedule Panel */}
                  {scheduleId === scene.id && (
                    <div className="mt-3.5 pt-3 border-t border-line">
                      <SchedulePanel homeId={homeId} kind="scenes" targetId={scene.id} />
                    </div>
                  )}
                </article>
              );
            })}

            {!filteredScenes.length && (
              <p className="text-xs text-muted italic p-6 text-center bg-sidebar/20 rounded-2xl border border-dashed border-line">
                Chưa có kịch bản.
              </p>
            )}
          </div>
        </section>

        {/* Right Column: Visual Scene Editor Form */}
        {loadingScene ? (
          <section className="surface-card p-6 flex flex-col items-center justify-center min-h-[300px]">
            <Loader2 size={32} className="animate-spin text-primary mb-3" />
            <p className="text-sm font-semibold text-text">Đang tải kịch bản...</p>
          </section>
        ) : sceneId && !editingScene ? (
          <section className="surface-card p-6 text-center space-y-3">
            <AlertCircle size={32} className="mx-auto text-amber-500" />
            <p className="text-sm font-bold text-text">Không thể mở kịch bản này.</p>
            <Link to={`/homes/${homeId}/scenes`} className="text-xs font-semibold text-primary underline">
              Về danh sách kịch bản
            </Link>
          </section>
        ) : (
          <form
            onSubmit={submit}
            className="surface-card p-5 sm:p-6 space-y-5 transition-all shadow-soft"
          >
            {/* Editor Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <div className="flex items-center gap-3">
                <SceneIcon iconKey={icon} name={name} size="md" />
                <div>
                  <h2 className="text-lg font-bold text-text">
                    {sceneId ? 'Sửa kịch bản' : 'Tạo kịch bản'}
                  </h2>
                  <p className="text-xs text-muted">
                    {sceneId ? 'Cập nhật chuỗi lệnh cho kịch bản đã chọn.' : 'Tạo mới một kịch bản thông minh.'}
                  </p>
                </div>
              </div>

              {sceneId && (
                <Link
                  to={`/homes/${homeId}/scenes`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/20"
                >
                  <Plus size={13} />
                  <span>Tạo kịch bản mới</span>
                </Link>
              )}
            </div>

            {/* Quick Templates Bar (if creating new) */}
            {!sceneId && (
              <div className="space-y-1.5 bg-sidebar/50 p-3 rounded-2xl border border-line">
                <span className="text-[11px] font-bold text-muted flex items-center gap-1">
                  <Sparkles size={12} className="text-amber-500" /> Mẫu thông dụng:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SCENE_PRESETS.slice(0, 4).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setName(p.name);
                        setIcon(p.icon);
                        setDescription(p.description);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-surface hover:bg-sidebar text-xs text-text border border-line transition-all hover:scale-102"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Name input */}
            <Field label="Tên">
              <input
                required
                maxLength={150}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: Chào buổi sáng"
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-text focus:border-primary focus:outline-none"
              />
            </Field>

            {/* Icon picker */}
            <Field label="Biểu tượng">
              <div className="flex items-center gap-3">
                <select
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-xs text-text focus:border-primary focus:outline-none"
                >
                  <option value="home">🏠 Ngôi nhà</option>
                  <option value="sun">☀️ Buổi sáng</option>
                  <option value="moon">🌙 Ban đêm</option>
                  <option value="lightbulb">💡 Chiếu sáng</option>
                  <option value="film">🎬 Rạp phim</option>
                  <option value="coffee">☕ Thư giãn</option>
                  <option value="thermometer">❄️ Làm mát</option>
                  <option value="shield">🛡️ An ninh</option>
                  <option value="party">🎉 Tiệc tùng</option>
                </select>
                <SceneIcon iconKey={icon} name={name} size="sm" />
              </div>
            </Field>

            {/* Description input */}
            <Field label="Mô tả">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả tóm tắt mục đích kịch bản..."
                rows={2}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-text focus:border-primary focus:outline-none resize-none"
              />
            </Field>

            {/* Enabled checkbox */}
            <label className="flex items-center gap-2 text-xs font-semibold text-text cursor-pointer p-3 rounded-xl bg-sidebar/40 border border-line">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded accent-primary w-4 h-4 cursor-pointer"
              />
              <span>Bật kịch bản</span>
            </label>

            {/* Action sequence builder */}
            <div className="space-y-3 pt-3 border-t border-line">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xs text-text flex items-center gap-1.5">
                    <Sliders size={14} className="text-primary" />
                    <span>Hành động ({actions.length})</span>
                  </h3>
                  <p className="text-[11px] text-muted">
                    Các lệnh thiết bị chạy tuần tự khi kịch bản được kích hoạt.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addAction}
                  disabled={saving || loadingOptions || !devices.length || !actionTypes.length}
                  className="inline-flex items-center gap-1 rounded-xl bg-primary hover:bg-primary-hover px-3 py-1.5 text-xs font-bold text-white shadow-xs disabled:opacity-50"
                >
                  <Plus size={13} />
                  <span>+ Thêm</span>
                </button>
              </div>

              {loadingOptions ? (
                <p className="text-xs text-muted py-3">Đang tải thiết bị và hành động...</p>
              ) : !devices.length ? (
                <p className="text-xs text-muted py-3 italic">
                  Chưa có thiết bị đã ghép nối trong nhà này.
                </p>
              ) : null}

              <div className="space-y-2.5">
                {actions.map((action, index) => {
                  const selectedDevice = devices.find((device) => device.id === action.deviceId);
                  const availableActions = getSceneDeviceActions(selectedDevice, actionTypes);
                  const selectedOption = availableActions.find(
                    (option) => option.code === action.action,
                  );

                  const DevIcon = getDeviceTypeIcon(selectedDevice?.deviceType);

                  return (
                    <div
                      key={index}
                      className="space-y-3 rounded-2xl border border-line bg-surface p-4 shadow-2xs hover:border-primary/50 transition-all"
                    >
                      <div className="flex items-center justify-between border-b border-line/60 pb-2.5">
                        <span className="text-xs font-bold text-text flex items-center gap-2">
                          <span className="w-6 h-6 rounded-xl bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center border border-primary/20">
                            {index + 1}
                          </span>
                          <span>Bước {index + 1}</span>
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label={`Đưa hành động ${index + 1} lên`}
                            disabled={index === 0}
                            onClick={() => moveAction(index, -1)}
                            className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-sidebar disabled:opacity-25 transition-colors"
                            title="Di chuyển lên"
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Đưa hành động ${index + 1} xuống`}
                            disabled={index === actions.length - 1}
                            onClick={() => moveAction(index, 1)}
                            className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-sidebar disabled:opacity-25 transition-colors"
                            title="Di chuyển xuống"
                          >
                            <ArrowDown size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setActions((items) => items.filter((_, i) => i !== index))}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 text-xs font-semibold ml-1 transition-colors"
                            title="Xóa bước này"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-[11px] font-bold text-muted mb-1 flex items-center gap-1">
                            <DevIcon size={12} className="text-primary" />
                            <span>Thiết bị</span>
                          </label>
                          <select
                            required
                            value={action.deviceId}
                            onChange={(e) => changeActionDevice(index, e.target.value)}
                            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-text focus:border-primary focus:outline-none shadow-2xs"
                          >
                            <option value="" disabled>
                              Chọn thiết bị đã ghép nối
                            </option>
                            {devices.map((device) => (
                              <option key={device.id} value={device.id}>
                                {device.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-muted mb-1">
                            Lệnh thực thi
                          </label>
                          <select
                            required
                            value={action.action}
                            onChange={(e) => changeActionType(index, e.target.value)}
                            disabled={!selectedDevice || !availableActions.length}
                            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-text focus:border-primary focus:outline-none disabled:opacity-50 shadow-2xs"
                          >
                            {!selectedDevice && <option value="">Chọn thiết bị trước</option>}
                            {selectedDevice && !availableActions.length && (
                              <option value="">Không có hành động phù hợp</option>
                            )}
                            {availableActions.map((option) => (
                              <option key={option.code} value={option.code}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {selectedOption?.valueKind === 'none' && (
                        <p className="text-[11px] text-muted italic pt-1">
                          Lệnh này không cần tham số giá trị bổ sung.
                        </p>
                      )}

                      {selectedOption?.valueKind === 'percentage' && (
                        <div className="pt-2 bg-sidebar/30 p-3 rounded-xl border border-line/60">
                          <div className="flex justify-between items-center text-xs font-bold text-text mb-1.5">
                            <span>{selectedOption.valueLabel || 'Mức độ (%)'}</span>
                            <span className="font-extrabold text-primary text-sm px-2 py-0.5 rounded-lg bg-primary/10 border border-primary/20">
                              {action.value || 0}%
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={1}
                              value={action.value || '50'}
                              onChange={(e) => updateAction(index, { value: e.target.value })}
                              className="flex-1 accent-primary cursor-pointer h-2 bg-slate-200 rounded-lg"
                            />
                            <input
                              required
                              type="number"
                              min={0}
                              max={100}
                              value={action.value}
                              onChange={(e) => updateAction(index, { value: e.target.value })}
                              className="w-16 rounded-xl border border-line px-2 py-1.5 text-xs text-center font-bold bg-surface"
                            />
                          </div>
                        </div>
                      )}

                      {selectedOption?.valueKind === 'number' && (
                        <div className="pt-2 bg-sidebar/30 p-3 rounded-xl border border-line/60">
                          <label className="block text-[11px] font-bold text-muted mb-1.5">
                            {selectedOption.valueLabel || 'Nhiệt độ (°C)'}
                          </label>
                          <div className="flex items-center gap-2 max-w-[220px]">
                            <button
                              type="button"
                              onClick={() => {
                                const val = Number(action.value || 25);
                                updateAction(index, { value: String(Math.max(16, val - 1)) });
                              }}
                              className="w-9 h-9 rounded-xl border border-line bg-surface font-extrabold text-base text-text flex items-center justify-center hover:bg-sidebar active:scale-95 shadow-2xs"
                            >
                              -
                            </button>
                            <input
                              required
                              type="number"
                              value={action.value}
                              onChange={(e) => updateAction(index, { value: e.target.value })}
                              className="w-20 rounded-xl border border-line px-2 py-1.5 text-sm text-center font-bold bg-surface"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const val = Number(action.value || 25);
                                updateAction(index, { value: String(Math.min(32, val + 1)) });
                              }}
                              className="w-9 h-9 rounded-xl border border-line bg-surface font-extrabold text-base text-text flex items-center justify-center hover:bg-sidebar active:scale-95 shadow-2xs"
                            >
                              +
                            </button>
                            <span className="text-xs font-bold text-muted ml-1">°C</span>
                          </div>
                        </div>
                      )}

                      {selectedOption?.valueKind === 'json' && (
                        <div className="pt-1">
                          <label className="block text-[11px] font-bold text-muted mb-1">
                            {selectedOption.valueLabel}
                          </label>
                          <textarea
                            required
                            value={action.value}
                            onChange={(e) => updateAction(index, { value: e.target.value })}
                            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-mono text-text focus:border-primary focus:outline-none"
                            placeholder='{"power": "ON"}'
                            rows={2}
                          />
                        </div>
                      )}

                      {selectedDevice && !selectedOption && (
                        <p className="text-[11px] text-amber-600">
                          Thiết bị này chưa hỗ trợ hành động hợp lệ cho kịch bản. Hãy chọn thiết bị khác.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Submit button */}
            <button
              disabled={
                saving ||
                !actionTypes.length ||
                actions.some(
                  (item) =>
                    !getSceneDeviceActions(
                      devices.find((device) => device.id === item.deviceId),
                      actionTypes,
                    ).some((option) => option.code === item.action),
                )
              }
              className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover active:scale-98 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              <span>{saving ? 'Đang lưu...' : sceneId ? 'Lưu thay đổi' : 'Tạo kịch bản'}</span>
            </button>
          </form>
        )}
      </div>
    </FeatureShell>
  );
}

function FeatureShell({
  title,
  homeId,
  children,
}: {
  title: string;
  homeId: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-app p-4 sm:p-7 text-text transition-colors">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-primary" />
              <h1 className="text-2xl font-black text-text tracking-tight">{title}</h1>
            </div>
            <p className="text-xs text-muted mt-0.5">Mã nhà: {homeId}</p>
          </div>

          <nav aria-label="Điều hướng tự động hóa" className="flex items-center gap-2">
            <Link
              to={`/homes/${homeId}/automation-rules`}
              className="rounded-xl border border-line bg-surface hover:bg-sidebar px-3.5 py-2 text-xs font-semibold text-text transition-colors shadow-xs"
            >
              Quy tắc
            </Link>
            <Link
              to={`/homes/${homeId}/recommendations`}
              className="rounded-xl border border-line bg-surface hover:bg-sidebar px-3.5 py-2 text-xs font-semibold text-text transition-colors shadow-xs"
            >
              Gợi ý AI
            </Link>
            <Link
              to="/home"
              className="button inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs"
            >
              <Home size={13} />
              <span>Về trang chủ</span>
            </Link>
          </nav>
        </header>

        {children}
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-text">{label}</span>
      {children}
    </label>
  );
}
