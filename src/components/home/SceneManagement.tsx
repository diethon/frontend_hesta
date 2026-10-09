import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  Plus,
  Play,
  Check,
  Search,
  LayoutGrid,
  ListOrdered,
  History,
  Calendar,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Zap,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sparkles,
  X,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { getDevicesByHome } from '../../services/deviceApi';
import {
  addSceneAction,
  createScene,
  deleteScene,
  executeScene,
  getScene,
  getSceneActionTypes,
  listScenes,
  removeSceneAction,
  reorderSceneActions,
  updateScene,
} from '../../services/sceneApi';
import type { DeviceResponse } from '../../types/device';
import type { SceneActionType, SceneResponse } from '../../types/scene';
import {
  buildSceneActionInput,
  formatSceneAction,
  getSceneDeviceActions,
  sceneToggleInput,
  type DraftSceneAction,
} from '../scene/sceneActions';
import { SceneCard } from '../scene/SceneCard';
import { SceneIcon } from '../scene/SceneIcon';
import { SceneEditorModal } from '../scene/SceneEditorModal';
import { SceneHistoryModal } from '../scene/SceneHistoryModal';
import { SceneScheduleModal } from '../scene/SceneScheduleModal';
import { detectSceneTheme, getDeviceTypeIcon } from '../scene/sceneConstants';

interface SceneManagementProps {
  homeId: string;
  currentUserRole: 'OWNER' | 'MEMBER';
}

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : 'Đã xảy ra lỗi. Vui lòng thử lại.';

export const SceneManagement: React.FC<SceneManagementProps> = ({
  homeId,
  currentUserRole,
}) => {
  const isOwner = currentUserRole === 'OWNER';
  const [scenes, setScenes] = useState<SceneResponse[]>([]);
  const [devices, setDevices] = useState<DeviceResponse[]>([]);
  const [actionTypes, setActionTypes] = useState<SceneActionType[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'pipeline'>('grid');

  // Modals state
  const [showEditor, setShowEditor] = useState(false);
  const [editingScene, setEditingScene] = useState<SceneResponse | null>(null);
  const [historyScene, setHistoryScene] = useState<SceneResponse | null>(null);
  const [scheduleScene, setScheduleScene] = useState<SceneResponse | null>(null);

  // Quick action form in pipeline view
  const [actionDeviceId, setActionDeviceId] = useState('');
  const [actionType, setActionType] = useState('');
  const [actionValue, setActionValue] = useState('');
  const [executingSceneId, setExecutingSceneId] = useState<string | null>(null);
  const [quickExecutedId, setQuickExecutedId] = useState<string | null>(null);
  const [togglingSceneId, setTogglingSceneId] = useState<string | null>(null);

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

  const selectedScene = useMemo(
    () => scenes.find((scene) => scene.id === selectedId) ?? null,
    [scenes, selectedId],
  );

  const selectedDevice = devices.find((device) => device.id === actionDeviceId);
  const availableActions = getSceneDeviceActions(selectedDevice, actionTypes);
  const selectedAction = availableActions.find((action) => action.code === actionType);

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

  const activeScenesCount = useMemo(() => scenes.filter((s) => s.enabled).length, [scenes]);
  const totalActionsCount = useMemo(
    () => scenes.reduce((sum, s) => sum + s.actions.length, 0),
    [scenes],
  );

  const refreshScene = async (sceneId: string) => {
    const scene = await getScene(homeId, sceneId);
    setScenes((current) => current.map((item) => (item.id === scene.id ? scene : item)));
    setSelectedId(scene.id);
  };

  const handleExecuteScene = async (scene: SceneResponse) => {
    setExecutingSceneId(scene.id);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await executeScene(homeId, scene.id);
      const successCount = result.resultDetail.filter((item) => item.success).length;
      const totalCount = result.resultDetail.length;
      setQuickExecutedId(scene.id);
      setTimeout(() => setQuickExecutedId(null), 2500);

      setSuccessMessage(
        `Kịch bản “${scene.name}”: ${result.status} (${successCount}/${totalCount} lệnh thành công).`,
      );
      setTimeout(() => setSuccessMessage(null), 4500);
      return result.status === 'SUCCESS' || result.status === 'PARTIAL';
    } catch (err) {
      setError(messageOf(err));
      return false;
    } finally {
      setExecutingSceneId(null);
    }
  };

  const handleToggleScene = async (scene: SceneResponse) => {
    setTogglingSceneId(scene.id);
    setError(null);
    try {
      const updated = await updateScene(homeId, scene.id, sceneToggleInput(scene));
      setScenes((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setTogglingSceneId(null);
    }
  };

  const openCreate = () => {
    setEditingScene(null);
    setShowEditor(true);
  };

  const openEdit = (scene: SceneResponse) => {
    setEditingScene(scene);
    setShowEditor(true);
  };

  const saveSceneFromModal = async (payload: {
    name: string;
    icon: string;
    description: string;
    enabled: boolean;
    actions: DraftSceneAction[];
  }) => {
    const actionRequests = payload.actions.map((act, index) =>
      buildSceneActionInput(act, index, devices, actionTypes),
    );

    if (editingScene) {
      const updated = await updateScene(homeId, editingScene.id, {
        name: payload.name,
        icon: payload.icon,
        description: payload.description,
        enabled: payload.enabled,
        actions: actionRequests,
      });
      setScenes((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedId(updated.id);
    } else {
      const created = await createScene(homeId, {
        name: payload.name,
        icon: payload.icon,
        description: payload.description,
        enabled: payload.enabled,
        actions: actionRequests,
      });
      setScenes((current) => [...current, created]);
      setSelectedId(created.id);
    }
  };

  const removeScene = async (scene: SceneResponse) => {
    if (!window.confirm(`Xác nhận xóa kịch bản “${scene.name}”?`)) return;
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

  const addActionToSelected = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedScene) return;
    setSaving(true);
    setError(null);
    try {
      const input = buildSceneActionInput(
        { deviceId: actionDeviceId, action: actionType, value: actionValue },
        selectedScene.actions.length,
        devices,
        actionTypes,
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

  const removeActionFromSelected = async (actionId: string) => {
    if (!selectedScene) return;
    setError(null);
    try {
      await removeSceneAction(homeId, selectedScene.id, actionId);
      await refreshScene(selectedScene.id);
    } catch (err) {
      setError(messageOf(err));
    }
  };

  const moveActionInSelected = async (index: number, direction: -1 | 1) => {
    if (!selectedScene) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= selectedScene.actions.length) return;
    const reordered = [...selectedScene.actions];
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    setError(null);
    try {
      const updated = await reorderSceneActions(
        homeId,
        selectedScene.id,
        reordered.map((action) => action.id),
      );
      setScenes((current) => current.map((scene) => (scene.id === updated.id ? updated : scene)));
    } catch (err) {
      setError(messageOf(err));
    }
  };

  return (
    <section className="surface-card p-5 sm:p-7 relative overflow-hidden transition-all duration-300 rounded-3xl border border-line shadow-soft">
      {/* Decorative ambient top gradient */}
      <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary via-mint to-primary opacity-80" />

      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-primary shadow-xs shadow-primary/50 animate-pulse" />
            <h2 className="text-xl sm:text-2xl font-extrabold text-text tracking-tight">
              Quản lý Kịch bản Thông minh
            </h2>
          </div>
          <p className="text-xs text-muted mt-1 leading-relaxed max-w-xl">
            Tự động hóa toàn diện ngôi nhà: Chạm 1 lần để thực thi chuỗi lệnh đèn, điều hòa, an ninh theo ý muốn.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to={`/homes/${homeId}/scenes`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 transition-all border border-primary/20 shadow-2xs"
            title="Mở toàn màn hình quản lý kịch bản"
          >
            <span>Mở rộng trang</span>
            <ExternalLink size={13} />
          </Link>

          {isOwner && (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover active:scale-95 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-primary/20"
            >
              <Plus size={16} />
              <span>+ Tạo kịch bản mới</span>
            </button>
          )}
        </div>
      </div>

      {/* Real-time Alerts */}
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700 flex items-center justify-between gap-2 shadow-xs animate-in fade-in"
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-rose-500 hover:text-rose-700 p-1"
            title="Đóng thông báo"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 flex items-center justify-between gap-2 shadow-xs animate-in fade-in"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-800 p-1"
            title="Đóng thông báo"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Statistics Cards Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
        <div className="surface-card p-4 rounded-2xl border border-line bg-gradient-to-br from-surface to-sidebar/40 flex items-center gap-3.5 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Sparkles size={20} />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
              Tổng kịch bản
            </span>
            <span className="text-xl font-extrabold text-text">{scenes.length}</span>
          </div>
        </div>

        <div className="surface-card p-4 rounded-2xl border border-line bg-gradient-to-br from-surface to-sidebar/40 flex items-center gap-3.5 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <Check size={20} className="stroke-[2.5]" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
              Đang hoạt động
            </span>
            <span className="text-xl font-extrabold text-emerald-600">{activeScenesCount}</span>
          </div>
        </div>

        <div className="surface-card p-4 rounded-2xl border border-line bg-gradient-to-br from-surface to-sidebar/40 flex items-center gap-3.5 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
            <Zap size={20} />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
              Lệnh thiết bị
            </span>
            <span className="text-xl font-extrabold text-text">{totalActionsCount}</span>
          </div>
        </div>

        <div className="surface-card p-4 rounded-2xl border border-line bg-gradient-to-br from-surface to-sidebar/40 flex items-center gap-3.5 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
            <Play size={18} className="fill-current" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
              1-Chạm sẵn sàng
            </span>
            <span className="text-xl font-extrabold text-amber-600">{activeScenesCount}</span>
          </div>
        </div>
      </div>

      {/* ONE-TOUCH QUICK ACCESS SCENES RIBBON (Apple HomeKit / Mushroom style) */}
      {scenes.filter((s) => s.enabled).length > 0 && (
        <div className="mb-6 p-4 rounded-3xl bg-sidebar/50 border border-line space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-amber-500" />
              <span className="text-xs font-bold text-text uppercase tracking-wider">
                Chạm nhanh kịch bản (1-Touch Trigger)
              </span>
            </div>
            <span className="text-[11px] text-muted font-medium">Bấm để kích hoạt tức thì</span>
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 custom-scrollbar">
            {scenes
              .filter((s) => s.enabled)
              .map((scene) => {
                const theme = detectSceneTheme(scene.name, scene.icon);
                const isRunning = executingSceneId === scene.id;
                const isDone = quickExecutedId === scene.id;

                return (
                  <button
                    key={scene.id}
                    type="button"
                    disabled={isRunning}
                    onClick={() => void handleExecuteScene(scene)}
                    className={`inline-flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border transition-all duration-200 shrink-0 text-left active:scale-95 shadow-2xs ${
                      isDone
                        ? 'bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/30 ring-2 ring-emerald-300'
                        : isRunning
                        ? 'bg-primary text-white border-primary shadow-primary/30'
                        : 'bg-surface hover:bg-sidebar text-text border-line hover:border-primary/40'
                    }`}
                  >
                    <SceneIcon iconKey={scene.icon} name={scene.name} size="xs" />
                    <div>
                      <span className="block text-xs font-bold truncate max-w-[120px]">
                        {scene.name}
                      </span>
                      <span
                        className={`text-[10px] block ${
                          isDone || isRunning ? 'text-white/90' : 'text-muted'
                        }`}
                      >
                        {isRunning ? 'Đang chạy…' : isDone ? 'Đã chạy xong!' : `${scene.actions.length} lệnh`}
                      </span>
                    </div>
                    {isRunning ? (
                      <Loader2 size={13} className="animate-spin text-white shrink-0 ml-1" />
                    ) : isDone ? (
                      <Check size={14} className="stroke-[3] text-white shrink-0 ml-1" />
                    ) : (
                      <Play size={11} className={`fill-current shrink-0 ml-1 ${theme.textColor}`} />
                    )}
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Filter & View Mode Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-line">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Tìm theo tên kịch bản hoặc mô tả..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2 rounded-2xl border border-line bg-surface text-xs font-semibold text-text placeholder-muted focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"
              title="Xóa tìm kiếm"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-sidebar/80 p-1 rounded-2xl border border-line">
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterTab === 'all'
                ? 'bg-surface text-primary shadow-xs'
                : 'text-muted hover:text-text'
            }`}
          >
            Tất cả ({scenes.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('enabled')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterTab === 'enabled'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-muted hover:text-text'
            }`}
          >
            Đang bật ({scenes.filter((s) => s.enabled).length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('disabled')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterTab === 'disabled'
                ? 'bg-slate-600 text-white shadow-xs'
                : 'text-muted hover:text-text'
            }`}
          >
            Đã tắt ({scenes.filter((s) => !s.enabled).length})
          </button>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center p-1 rounded-2xl bg-sidebar/80 border border-line">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'grid'
                ? 'bg-surface text-primary shadow-xs'
                : 'text-muted hover:text-text'
            }`}
            title="Dạng thẻ kịch bản thông minh"
          >
            <LayoutGrid size={14} />
            <span className="hidden sm:inline">Thẻ trực quan</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('pipeline')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'pipeline'
                ? 'bg-surface text-primary shadow-xs'
                : 'text-muted hover:text-text'
            }`}
            title="Xem chuỗi lệnh chi tiết"
          >
            <ListOrdered size={14} />
            <span className="hidden sm:inline">Chuỗi quy trình</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-20 text-center text-muted flex flex-col items-center justify-center">
          <Loader2 size={32} className="animate-spin text-primary mb-3" />
          <p className="text-sm font-semibold text-text">Đang tải danh sách kịch bản…</p>
        </div>
      ) : filteredScenes.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-3xl border border-dashed border-line bg-sidebar/20">
          <div className="w-14 h-14 rounded-2xl bg-sidebar flex items-center justify-center text-muted mx-auto mb-3.5 shadow-2xs">
            <Zap size={26} />
          </div>
          <h3 className="font-bold text-text text-base mb-1">
            {searchQuery ? 'Không tìm thấy kịch bản phù hợp' : 'Chưa có kịch bản nào'}
          </h3>
          <p className="text-xs text-muted max-w-sm mx-auto mb-4 leading-relaxed">
            {searchQuery
              ? 'Thử thay đổi từ khóa tìm kiếm hoặc chọn bộ lọc trạng thái khác.'
              : 'Tạo kịch bản thông minh để điều khiển đồng bộ đèn, điều hòa, quạt và rèm chỉ với 1 lần chạm.'}
          </p>
          {isOwner && !searchQuery && (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-2xl text-xs font-bold hover:bg-primary-hover active:scale-95 transition-all shadow-md shadow-primary/20"
            >
              <Plus size={15} />
              <span>Tạo kịch bản đầu tiên</span>
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW: Apple HomeKit / Mushroom style smart cards */
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredScenes.map((scene) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              isOwner={isOwner}
              isExecuting={executingSceneId === scene.id}
              isToggling={togglingSceneId === scene.id}
              onExecute={handleExecuteScene}
              onToggle={handleToggleScene}
              onEdit={openEdit}
              onDelete={removeScene}
              onOpenHistory={(sc) => setHistoryScene(sc)}
              onOpenSchedule={(sc) => setScheduleScene(sc)}
            />
          ))}
        </div>
      ) : (
        /* PIPELINE / FLOW VIEW: Master-detail view with reorder and inline adding */
        <div className="grid gap-6 lg:grid-cols-[minmax(270px,0.9fr)_minmax(0,2fr)]">
          {/* Left: Scene Selector List */}
          <div className="space-y-2.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted px-1">
              Chọn kịch bản để xem chuỗi lệnh:
            </div>
            {filteredScenes.map((scene) => {
              const isSelected = selectedId === scene.id;
              return (
                <button
                  key={scene.id}
                  onClick={() => setSelectedId(scene.id)}
                  className={`w-full rounded-2xl border p-3.5 text-left transition-all duration-200 flex items-center justify-between gap-3 shadow-2xs ${
                    isSelected
                      ? 'border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20'
                      : 'border-line bg-surface hover:bg-sidebar/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <SceneIcon iconKey={scene.icon} name={scene.name} size="sm" />
                    <div className="min-w-0">
                      <span className="block font-bold text-sm text-text truncate">
                        {scene.name}
                      </span>
                      <span className="text-[11px] text-muted block truncate mt-0.5">
                        {scene.actions.length} lệnh · {scene.enabled ? 'Đang bật' : 'Đang tắt'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight
                    size={16}
                    className={`shrink-0 transition-transform ${
                      isSelected ? 'text-primary translate-x-1' : 'text-muted'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Right: Selected Scene Action Flow Pipeline */}
          {selectedScene && (
            <div className="rounded-3xl border border-line bg-surface p-6 space-y-5 shadow-xs">
              {/* Scene Detail Header */}
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-line">
                <div className="flex items-center gap-3.5">
                  <SceneIcon iconKey={selectedScene.icon} name={selectedScene.name} size="md" />
                  <div>
                    <h3 className="font-extrabold text-base text-text">{selectedScene.name}</h3>
                    <p className="text-xs text-muted mt-0.5">
                      {selectedScene.description || 'Chưa có phần mô tả.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!selectedScene.enabled || executingSceneId === selectedScene.id}
                    onClick={() => void handleExecuteScene(selectedScene)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all disabled:opacity-50 shadow-sm shadow-primary/20 active:scale-95"
                  >
                    {executingSceneId === selectedScene.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Play size={12} className="fill-current" />
                    )}
                    <span>
                      {executingSceneId === selectedScene.id ? 'Đang chạy…' : 'Chạy ngay'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScheduleScene(selectedScene)}
                    className="p-2 rounded-xl border border-line text-muted hover:text-text hover:bg-sidebar transition-colors"
                    title="Lịch trình tự động"
                  >
                    <Calendar size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setHistoryScene(selectedScene)}
                    className="p-2 rounded-xl border border-line text-muted hover:text-text hover:bg-sidebar transition-colors"
                    title="Lịch sử kích hoạt"
                  >
                    <History size={16} />
                  </button>

                  {isOwner && (
                    <>
                      <button
                        onClick={() => openEdit(selectedScene)}
                        className="px-3 py-2 rounded-xl bg-sidebar hover:bg-sidebar-hover text-xs font-bold text-text transition-colors border border-line"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => void removeScene(selectedScene)}
                        className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-xs font-bold text-rose-600 transition-colors border border-rose-200"
                      >
                        Xóa
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Action Pipeline Sequence */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-muted">
                  <span>Trình tự thực thi ({selectedScene.actions.length} bước)</span>
                  <span className="text-[11px] font-normal text-muted">
                    Các lệnh chạy tuần tự từ 1 đến hết
                  </span>
                </div>

                {selectedScene.actions.length === 0 ? (
                  <p className="text-xs text-muted italic p-5 bg-sidebar/30 rounded-2xl border border-dashed border-line text-center">
                    Chưa có hành động nào trong kịch bản này.
                  </p>
                ) : (
                  <div className="space-y-2.5 relative before:absolute before:left-5 before:top-4 before:bottom-4 before:w-0.5 before:bg-line/80 before:-z-0">
                    {selectedScene.actions.map((action, index) => {
                      const DevIcon = getDeviceTypeIcon(action.targetDeviceType);

                      return (
                        <div
                          key={action.id}
                          className="relative z-10 flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface hover:border-primary/50 p-3.5 transition-all shadow-2xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-primary/10 text-primary font-bold text-xs shrink-0 border border-primary/20">
                              {index + 1}
                            </span>
                            <div className="w-8 h-8 rounded-xl bg-sidebar flex items-center justify-center text-primary shrink-0">
                              <DevIcon size={16} />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-text">
                                {action.targetDeviceName}
                              </p>
                              <p className="truncate text-[11px] text-muted font-medium">
                                {formatSceneAction(action)}
                              </p>
                            </div>
                          </div>

                          {isOwner && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                disabled={index === 0}
                                onClick={() => void moveActionInSelected(index, -1)}
                                className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-sidebar disabled:opacity-25 transition-colors"
                                title="Đưa lên"
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                disabled={index === selectedScene.actions.length - 1}
                                onClick={() => void moveActionInSelected(index, 1)}
                                className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-sidebar disabled:opacity-25 transition-colors"
                                title="Đưa xuống"
                              >
                                <ArrowDown size={14} />
                              </button>
                              <button
                                onClick={() => void removeActionFromSelected(action.id)}
                                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors ml-1"
                                title="Xóa lệnh này"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Inline Quick Action Adder (for Owner) */}
              {isOwner && (
                <form
                  onSubmit={addActionToSelected}
                  className="rounded-3xl border border-line bg-sidebar/40 p-4 sm:p-5 space-y-3.5"
                >
                  <div className="text-xs font-bold text-text flex items-center gap-2">
                    <Plus size={15} className="text-primary" />
                    <span>Thêm lệnh nhanh vào kịch bản</span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label className="block text-[11px] font-bold text-muted mb-1">
                        Thiết bị
                      </label>
                      <select
                        required
                        value={actionDeviceId}
                        onChange={(e) => {
                          const nextDeviceId = e.target.value;
                          const dev = devices.find((d) => d.id === nextDeviceId);
                          const actionsForDev = getSceneDeviceActions(dev, actionTypes);
                          setActionDeviceId(nextDeviceId);
                          setActionType(actionsForDev[0]?.code ?? '');
                          setActionValue(actionsForDev[0]?.defaultValue ?? '');
                        }}
                        className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-text focus:border-primary focus:outline-none shadow-2xs"
                      >
                        <option value="" disabled>
                          -- Chọn thiết bị --
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
                        Hành động
                      </label>
                      <select
                        required
                        disabled={!selectedDevice || availableActions.length === 0}
                        value={actionType}
                        onChange={(e) => {
                          const code = e.target.value;
                          const opt = availableActions.find((a) => a.code === code);
                          setActionType(code);
                          setActionValue(opt?.defaultValue ?? '');
                        }}
                        className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-text focus:border-primary focus:outline-none disabled:opacity-50 shadow-2xs"
                      >
                        {!selectedDevice && <option value="">Chọn thiết bị trước</option>}
                        {availableActions.map((opt) => (
                          <option key={opt.code} value={opt.code}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-muted mb-1">
                        {selectedAction?.valueLabel || 'Giá trị tham số'}
                      </label>
                      {selectedAction?.valueKind === 'percentage' ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={actionValue || '50'}
                            onChange={(e) => setActionValue(e.target.value)}
                            className="flex-1 accent-primary cursor-pointer"
                          />
                          <span className="text-xs font-bold text-primary w-10 text-right">
                            {actionValue || 0}%
                          </span>
                        </div>
                      ) : selectedAction?.valueKind === 'number' ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={actionValue}
                            onChange={(e) => setActionValue(e.target.value)}
                            placeholder="Ví dụ: 25"
                            className="w-full rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-bold text-text focus:border-primary focus:outline-none"
                          />
                          <span className="text-xs font-bold text-muted">°C</span>
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={actionValue}
                          disabled={!selectedAction?.valueKind}
                          onChange={(e) => setActionValue(e.target.value)}
                          placeholder={selectedAction?.valueKind ? 'Giá trị...' : 'Không cần tham số'}
                          className="w-full rounded-xl border border-line bg-surface px-3 py-1.5 text-xs text-text focus:border-primary focus:outline-none disabled:opacity-50"
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={saving || !actionDeviceId || !actionType}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold disabled:opacity-50 transition-all shadow-xs active:scale-95"
                    >
                      {saving && <Loader2 size={13} className="animate-spin" />}
                      <span>{saving ? 'Đang thêm…' : '+ Thêm vào chuỗi lệnh'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showEditor && (
        <SceneEditorModal
          homeId={homeId}
          editingScene={editingScene}
          devices={devices}
          actionTypes={actionTypes}
          onClose={() => setShowEditor(false)}
          onSave={saveSceneFromModal}
        />
      )}

      {historyScene && (
        <SceneHistoryModal
          homeId={homeId}
          scene={historyScene}
          onClose={() => setHistoryScene(null)}
        />
      )}

      {scheduleScene && (
        <SceneScheduleModal
          homeId={homeId}
          scene={scheduleScene}
          onClose={() => setScheduleScene(null)}
        />
      )}
    </section>
  );
};
