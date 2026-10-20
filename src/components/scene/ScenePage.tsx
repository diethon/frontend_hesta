import { useEffect, useMemo, useState, type FormEvent } from 'react';
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
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Home,
  Zap,
  Palette,
  Sun,
  Thermometer,
} from 'lucide-react';
import {
  createScene,
  deleteScene,
  executeScene,
  getCachedScenes,
  getDevices,
  getScene,
  getSceneActionTypes,
  getSceneExecutions,
  getScenes,
  updateScene,
} from '../../services/sceneApi';
import type { SceneActionType, SceneExecutionResponse, SceneResponse } from '../../types/scene';
import { HomeSidebar } from '../ui/HomeSidebar';
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
import { AVAILABLE_ICONS, SCENE_PRESETS, detectSceneTheme, getDeviceTypeIcon } from './sceneConstants';
import { notify } from '../ui/notify';
import { ConfirmModal } from '../ui/ConfirmModal';

export function ScenePage() {
  const { homeId = '', sceneId } = useParams();
  return <SceneWorkspace key={homeId} homeId={homeId} sceneId={sceneId} />;
}

function SceneWorkspace({ homeId, sceneId }: { homeId: string; sceneId?: string }) {
  const navigate = useNavigate();
  const cached = useMemo(() => getCachedScenes(homeId), [homeId]);
  const [scenes, setScenes] = useState<SceneResponse[]>(cached || []);
  const [loadingScenes, setLoadingScenes] = useState(!cached?.length);
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [actionTypes, setActionTypes] = useState<SceneActionType[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Pre-fill scene data immediately if sceneId is in cached or scenes
  const initialScene = useMemo(() => {
    if (!sceneId) return null;
    return (cached || scenes).find((s) => s.id === sceneId) || null;
  }, [sceneId, cached, scenes]);

  const [editingScene, setEditingScene] = useState<SceneResponse | null>(initialScene);
  const [loadingScene, setLoadingScene] = useState(Boolean(sceneId && !initialScene));
  const [togglingSceneId, setTogglingSceneId] = useState<string | null>(null);
  const [name, setName] = useState(initialScene?.name ?? '');
  const [icon, setIcon] = useState(initialScene?.icon ?? 'home');
  const [description, setDescription] = useState(initialScene?.description ?? '');
  const [enabled, setEnabled] = useState(initialScene?.enabled ?? true);
  const [actions, setActions] = useState<DraftSceneAction[]>(
    initialScene ? sceneActionsToDraft(initialScene.actions) : [],
  );
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
  const [showIconPicker, setShowIconPicker] = useState(false);

  // Reset editor when navigating; keep the workspace data mounted.
  if (selectedSceneId !== sceneId) {
    setSelectedSceneId(sceneId);
    const existing = (cached || scenes).find((s) => s.id === sceneId);
    if (existing) {
      setEditingScene(existing);
      setName(existing.name);
      setIcon(existing.icon ?? 'home');
      setDescription(existing.description ?? '');
      setEnabled(existing.enabled);
      setActions(sceneActionsToDraft(existing.actions));
      setLoadingScene(false);
    } else {
      setEditingScene(null);
      setLoadingScene(Boolean(sceneId));
      setName('');
      setIcon('home');
      setDescription('');
      setEnabled(true);
      setActions([]);
    }
    setError('');
    setSuccess('');
  }

  // 1. Fast path: load scenes list first
  useEffect(() => {
    let active = true;
    if (!scenes.length) setLoadingScenes(true);

    getScenes(homeId)
      .then((sceneResult) => {
        if (!active) return;
        setScenes(sceneResult);
        setLoadingScenes(false);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : 'Không thể tải danh sách kịch bản');
      })
      .finally(() => {
        if (active) setLoadingScenes(false);
      });

    return () => {
      active = false;
    };
  }, [homeId]);

  // 2. Background path: load devices and action types
  useEffect(() => {
    let active = true;
    Promise.all([
      getDevices(homeId).catch(() => []),
      getSceneActionTypes(homeId).catch(() => []),
    ])
      .then(([devs, types]) => {
        if (!active) return;
        setDevices(devs);
        setActionTypes(types);
      })
      .finally(() => {
        if (active) setLoadingOptions(false);
      });

    return () => {
      active = false;
    };
  }, [homeId]);

  // 3. Scene detail fetching: fast memory lookup first, network fallback
  useEffect(() => {
    if (!sceneId) {
      setEditingScene(null);
      setName('');
      setIcon('home');
      setDescription('');
      setEnabled(true);
      setActions([]);
      setLoadingScene(false);
      return;
    }

    const foundInState = (cached || scenes).find((s) => s.id === sceneId);
    if (foundInState) {
      setEditingScene(foundInState);
      setName(foundInState.name);
      setIcon(foundInState.icon ?? 'home');
      setDescription(foundInState.description ?? '');
      setEnabled(foundInState.enabled);
      setActions(sceneActionsToDraft(foundInState.actions));
      setLoadingScene(false);
      return;
    }

    let active = true;
    setLoadingScene(true);
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
        if (active) {
          setError(caught instanceof Error ? caught.message : 'Không thể tải kịch bản.');
        }
      })
      .finally(() => {
        if (active) setLoadingScene(false);
      });

    return () => {
      active = false;
    };
  }, [homeId, sceneId]);

  const addAction = () => {
    const firstDev =
      devices.find((d) => getSceneDeviceActions(d, actionTypes).length > 0) || devices[0];
    const available = firstDev ? getSceneDeviceActions(firstDev, actionTypes) : [];
    const firstOpt = available[0];
    setActions((current) => [
      ...current,
      {
        deviceId: firstDev?.id ?? '',
        action: firstOpt?.code ?? '',
        value: firstOpt?.defaultValue ?? '',
      },
    ]);
  };

  const updateAction = (index: number, patch: Partial<DraftSceneAction>) =>
    setActions((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );

  const changeActionDevice = (index: number, deviceId: string) => {
    const selected = devices.find((device) => device.id === deviceId);
    const available = getSceneDeviceActions(selected, actionTypes);
    const option = available[0];
    updateAction(index, { deviceId, action: option?.code ?? '', value: option?.defaultValue ?? '' });
  };

  const changeActionType = (index: number, actionCode: string) => {
    const selected = devices.find((device) => device.id === actions[index]?.deviceId);
    const option = getSceneDeviceActions(selected, actionTypes).find(
      (candidate) => candidate.code === actionCode,
    );
    updateAction(index, { action: actionCode, value: option?.defaultValue ?? '' });
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
        setScenes((current) => current.map((s) => (s.id === updated.id ? updated : s)));
        notify.success('Lưu kịch bản thành công', `Đã cập nhật kịch bản "${updated.name}".`);
      } else {
        const created = await createScene(homeId, input);
        setScenes((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
        setName('');
        setDescription('');
        setActions([]);
        notify.success('Tạo kịch bản thành công', `Đã tạo kịch bản "${input.name}" với ${input.actions.length} hành động.`);
      }
    } catch (caught) {
      const msg = caught instanceof Error
        ? caught.message
        : 'Không thể lưu kịch bản. Vui lòng kiểm tra hành động.';
      setError(msg);
      notify.error('Lưu kịch bản thất bại', msg);
    } finally {
      setSaving(false);
    }
  };

  const [deletingScene, setDeletingScene] = useState<SceneResponse | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deletingScene) return;
    setDeleteLoading(true);
    try {
      await deleteScene(homeId, deletingScene.id);
      setScenes((current) => current.filter((scene) => scene.id !== deletingScene.id));
      if (deletingScene.id === editingScene?.id) navigate(`/homes/${homeId}/scenes`);
      notify.success('Xóa kịch bản thành công', `Kịch bản "${deletingScene.name}" đã được xóa khỏi hệ thống.`);
      setDeletingScene(null);
    } catch (caught) {
      const msg = caught instanceof Error ? caught.message : 'Không thể xóa kịch bản';
      setError(msg);
      notify.error('Xóa kịch bản thất bại', msg);
    } finally {
      setDeleteLoading(false);
    }
  };

  const run = async (scene: SceneResponse) => {
    setRunningId(scene.id);
    setError('');
    setSuccess('');
    try {
      const result = await executeScene(homeId, scene.id);
      const successCount = result.resultDetail.filter((item) => item.success).length;
      const totalCount = result.resultDetail.length;
      if (result.status === 'SUCCESS' || (totalCount > 0 && successCount === totalCount)) {
        notify.success(
          'Kích hoạt kịch bản thành công',
          `Kịch bản "${scene.name}": hoàn thành ${successCount}/${totalCount} hành động.`,
        );
      } else {
        notify.warning(
          `Kịch bản "${scene.name}": ${result.status}`,
          `${successCount}/${totalCount} hành động thành công.`,
        );
      }
      if (historyId === scene.id) setExecutions(await getSceneExecutions(homeId, scene.id));
    } catch (caught) {
      const msg = caught instanceof Error ? caught.message : 'Không thể chạy kịch bản.';
      setError(msg);
      notify.error('Kích hoạt kịch bản thất bại', msg);
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
      const msg = caught instanceof Error ? caught.message : 'Không thể tải lịch sử.';
      setError(msg);
      notify.error('Không thể tải lịch sử thực thi', msg);
    }
  };

  const toggle = async (scene: SceneResponse) => {
    const nextState = !scene.enabled;
    setTogglingSceneId(scene.id);
    setError('');

    // Optimistic UI update: flip switch immediately
    setScenes((current) =>
      current.map((item) => (item.id === scene.id ? { ...item, enabled: nextState } : item))
    );
    if (scene.id === editingScene?.id) {
      setEnabled(nextState);
      setEditingScene((prev) => (prev ? { ...prev, enabled: nextState } : null));
    }

    try {
      const updated = await updateScene(homeId, scene.id, sceneToggleInput(scene));
      setScenes((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      if (scene.id === editingScene?.id) {
        setEditingScene(updated);
        setEnabled(updated.enabled);
      }
      notify.success(
        updated.enabled ? 'Đã kích hoạt kịch bản' : 'Đã tạm dừng kịch bản',
        `Kịch bản "${scene.name}" hiện đang ${updated.enabled ? 'bật' : 'tắt'}.`,
      );
    } catch (caught) {
      // Revert optimistic toggle
      setScenes((current) =>
        current.map((item) => (item.id === scene.id ? { ...item, enabled: scene.enabled } : item))
      );
      if (scene.id === editingScene?.id) {
        setEnabled(scene.enabled);
        setEditingScene((prev) => (prev ? { ...prev, enabled: scene.enabled } : null));
      }
      const msg = caught instanceof Error ? caught.message : 'Không thể đổi trạng thái kịch bản.';
      setError(msg);
      notify.error('Lỗi khi đổi trạng thái kịch bản', msg);
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
            {loadingScenes ? (
              <span className="h-6 w-10 bg-sidebar rounded animate-pulse block mt-1" />
            ) : (
              <span className="text-xl font-bold text-text">{scenes.length}</span>
            )}
          </div>
        </div>

        <div className="surface-card p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <Check size={20} />
          </div>
          <div>
            <span className="text-xs text-muted block font-medium">Đang hoạt động</span>
            {loadingScenes ? (
              <span className="h-6 w-10 bg-sidebar rounded animate-pulse block mt-1" />
            ) : (
              <span className="text-xl font-bold text-text">{activeCount}</span>
            )}
          </div>
        </div>

        <div className="surface-card p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
            <Zap size={20} />
          </div>
          <div>
            <span className="text-xs text-muted block font-medium">Tổng lệnh liên kết</span>
            {loadingScenes ? (
              <span className="h-6 w-10 bg-sidebar rounded animate-pulse block mt-1" />
            ) : (
              <span className="text-xl font-bold text-text">{totalActionsCount}</span>
            )}
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
            {loadingScenes && !scenes.length ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="rounded-3xl border border-line bg-surface p-4 sm:p-5 animate-pulse space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="h-4 w-32 bg-sidebar rounded" />
                      <div className="h-5 w-16 bg-sidebar rounded-full" />
                    </div>
                    <div className="h-3 w-48 bg-sidebar/60 rounded" />
                    <div className="h-8 bg-sidebar/40 rounded-xl mt-2" />
                  </div>
                ))}
              </div>
            ) : filteredScenes.map((scene) => {
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
                                {formatSceneAction(action, devices)}
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
                        onClick={() => setDeletingScene(scene)}
                        className="rounded-xl bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition-colors border border-rose-200/60 cursor-pointer"
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

            {!loadingScenes && !filteredScenes.length && (
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
              <div className="relative">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowIconPicker(!showIconPicker)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-line bg-surface hover:bg-sidebar text-xs font-semibold text-text transition-all cursor-pointer shadow-2xs"
                    title="Bấm để đổi biểu tượng"
                  >
                    <SceneIcon iconKey={icon} name={name} size="xs" />
                    <span>{AVAILABLE_ICONS.find((i) => i.key === icon)?.label || 'Chọn biểu tượng'}</span>
                  </button>
                  <span className="text-[11px] text-muted">Bấm vào nút để chọn biểu tượng kịch bản</span>
                </div>

                {showIconPicker && (
                  <div className="absolute left-0 top-full mt-2 z-50 w-72 max-h-64 overflow-y-auto rounded-2xl border border-line bg-surface p-3 shadow-xl grid grid-cols-4 gap-1.5 backdrop-blur-md">
                    {AVAILABLE_ICONS.map((item) => {
                      const isSelected = icon === item.key;
                      const IconComp = item.icon;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            setIcon(item.key);
                            setShowIconPicker(false);
                          }}
                          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-primary text-white shadow-xs scale-105'
                              : 'hover:bg-sidebar text-text'
                          }`}
                          title={item.label}
                        >
                          <IconComp size={18} />
                          <span className="text-[10px] mt-1 font-medium truncate max-w-full">
                            {item.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
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
                  disabled={saving || loadingOptions || !devices.length}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary-hover px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Thêm hành động</span>
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

                      {/* 1. POWER (TURN_ON / TURN_OFF / TOGGLE) quick toggle buttons */}
                      {(action.action === 'TURN_ON' || action.action === 'TURN_OFF' || action.action === 'TOGGLE') && (
                        <div className="space-y-1.5 pt-2">
                          <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
                            Chế độ nguồn:
                          </span>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => changeActionType(index, 'TURN_ON')}
                              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                action.action === 'TURN_ON'
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-surface hover:bg-sidebar text-text border border-line'
                              }`}
                            >
                              Bật nguồn (ON)
                            </button>
                            <button
                              type="button"
                              onClick={() => changeActionType(index, 'TURN_OFF')}
                              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                action.action === 'TURN_OFF'
                                  ? 'bg-slate-700 text-white shadow-xs'
                                  : 'bg-surface hover:bg-sidebar text-text border border-line'
                              }`}
                            >
                              Tắt nguồn (OFF)
                            </button>
                            <button
                              type="button"
                              onClick={() => changeActionType(index, 'TOGGLE')}
                              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                action.action === 'TOGGLE'
                                  ? 'bg-primary text-white shadow-xs'
                                  : 'bg-surface hover:bg-sidebar text-text border border-line'
                              }`}
                            >
                              Đảo bật/tắt
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 2. BRIGHTNESS / PERCENTAGE */}
                      {selectedOption?.valueKind === 'percentage' && (
                        <div className="pt-2 bg-sidebar/30 p-3 rounded-xl border border-line/60 space-y-2">
                          <div className="flex justify-between items-center text-xs font-bold text-text mb-1.5">
                            <span className="flex items-center gap-1.5">
                              <Sun size={14} className="text-amber-500" />
                              <span>{selectedOption.valueLabel || 'Mức độ (%)'}</span>
                            </span>
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
                          {/* Quick presets for brightness */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {[
                              { label: '25% (Ngủ)', val: '25' },
                              { label: '50% (Dịu)', val: '50' },
                              { label: '75% (Chuẩn)', val: '75' },
                              { label: '100% (Sáng)', val: '100' },
                            ].map((preset) => (
                              <button
                                key={preset.val}
                                type="button"
                                onClick={() => updateAction(index, { value: preset.val })}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                  action.value === preset.val
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-surface hover:bg-sidebar text-text border border-line'
                                }`}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 3. TEMPERATURE / NUMBER */}
                      {selectedOption?.valueKind === 'number' && (
                        <div className="pt-2 bg-sidebar/30 p-3 rounded-xl border border-line/60">
                          <label className="block text-[11px] font-bold text-muted mb-1.5 flex items-center gap-1.5">
                            <Thermometer size={14} className="text-primary" />
                            <span>{selectedOption.valueLabel || 'Nhiệt độ (°C)'}</span>
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

                      {/* 4. JSON */}
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

                      {/* 5. COLOR (SET_RGB / SET_COLOR / valueKind === 'color') */}
                      {(selectedOption?.valueKind === 'color' || action.action === 'SET_RGB' || action.action === 'SET_COLOR') && (
                        <div className="pt-2 bg-sidebar/30 p-3 rounded-xl border border-line/60 space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-muted flex items-center gap-1.5">
                              <Palette size={14} className="text-primary" />
                              <span>{selectedOption?.valueLabel || 'Màu sắc RGB'}</span>
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={action.value?.startsWith('#') ? action.value : '#ffc107'}
                                onChange={(e) => updateAction(index, { value: e.target.value })}
                                className="w-7 h-7 rounded-lg border border-line cursor-pointer p-0.5 bg-surface"
                              />
                              <span className="text-xs font-mono font-bold text-text uppercase">
                                {action.value || '#ffc107'}
                              </span>
                            </div>
                          </div>
                          {/* Color swatches with checkmarks */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {[
                              { label: 'Trắng ấm', hex: '#fff4e5' },
                              { label: 'Vàng nắng', hex: '#ffc107' },
                              { label: 'Cam hoàng hôn', hex: '#ff7043' },
                              { label: 'Đỏ', hex: '#f44336' },
                              { label: 'Xanh lá', hex: '#4caf50' },
                              { label: 'Xanh băng', hex: '#00bcd4' },
                              { label: 'Xanh dương', hex: '#2196f3' },
                              { label: 'Tím', hex: '#9c27b0' },
                              { label: 'Hồng', hex: '#e91e63' },
                            ].map((preset) => {
                              const isSelected = (action.value || '#ffc107').toLowerCase() === preset.hex.toLowerCase();
                              return (
                                <button
                                  key={preset.hex}
                                  type="button"
                                  onClick={() => updateAction(index, { value: preset.hex })}
                                  className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-all flex items-center gap-1.5 cursor-pointer ${
                                    isSelected
                                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs ring-1 ring-primary/40'
                                      : 'border-line/70 bg-surface text-text hover:border-line'
                                  }`}
                                >
                                  <span
                                    className="w-3 h-3 rounded-full inline-flex items-center justify-center border border-black/10 shrink-0"
                                    style={{ backgroundColor: preset.hex }}
                                  >
                                    {isSelected && <Check size={8} className="text-slate-800" />}
                                  </span>
                                  {preset.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* 6. GENERAL TEXT (not color) */}
                      {selectedOption?.valueKind === 'text' && action.action !== 'SET_COLOR' && action.action !== 'SET_RGB' && (
                        <div className="pt-1">
                          <label className="block text-[11px] font-bold text-muted mb-1">
                            {selectedOption.valueLabel}
                          </label>
                          <input
                            required
                            type="text"
                            value={action.value}
                            onChange={(e) => updateAction(index, { value: e.target.value })}
                            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-text focus:border-primary focus:outline-none"
                            placeholder="Nhập giá trị..."
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
                actions.some(
                  (item) =>
                    !getSceneDeviceActions(
                      devices.find((device) => device.id === item.deviceId),
                      actionTypes,
                    ).some((option) => option.code === item.action),
                )
              }
              className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover active:scale-98 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              <span>{saving ? 'Đang lưu...' : sceneId ? 'Lưu thay đổi' : 'Tạo kịch bản'}</span>
            </button>
          </form>
        )}
      </div>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={!!deletingScene}
        title="Xóa kịch bản"
        description={`Bạn có chắc chắn muốn xóa kịch bản "${deletingScene?.name || ''}" không? Hành động này không thể hoàn tác.`}
        confirmText="Xóa kịch bản"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingScene(null)}
      />
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
    <div className="app-shell relative min-h-screen text-text">
      <HomeSidebar activeItem="scenes" homeId={homeId} />
      <main className="min-w-0 flex-1 p-4 sm:p-7 lg:pl-64 space-y-6 max-w-7xl mx-auto transition-colors">
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
      </main>
    </div>
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
