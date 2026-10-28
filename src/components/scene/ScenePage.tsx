import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useAppSelector } from '../../store/hooks';
import {
  getScenes,
  getScene,
  createScene,
  updateScene,
  deleteScene,
  executeScene,
  getSceneExecutions,
  getDevices,
  getSceneActionTypes,
} from '../../services/sceneApi';
import type {
  SceneResponse,
  SceneExecutionResponse,
  SceneActionType,
  DeviceResponse,
} from '../../types/scene';
import type { DeviceSummary } from '../../types/automation';
import {
  sceneActionsToDraft,
  buildSceneActionInput,
  sceneToggleInput,
  getSceneDeviceActions,
  type DraftSceneAction,
  type AnyDevice,
} from './sceneActions';
import { DashboardNavRail } from '../home/DashboardNavRail';
import { Icon, IconButton, type IconName } from '../home/HomeIcons';
import { VoiceAssistantButton } from '../ui/VoiceAssistant';
import { NotificationBell } from '../notification/NotificationBell';
import { notify } from '../ui/notify';
import { getErrorMessage } from '../../utils/errors';
import { SceneEditor } from './SceneEditor';

// ──────────────────────────────────────────────────────────────────────────
// Icon Mapping Helpers
// ──────────────────────────────────────────────────────────────────────────

export function getFigmaIconForScene(name?: string, icon?: string | null): IconName {
  const text = `${name ?? ''} ${icon ?? ''}`.toLowerCase();
  if (text.includes('sáng') || text.includes('sun') || text.includes('morning')) return 'sun';
  if (text.includes('ngủ') || text.includes('moon') || text.includes('tối') || text.includes('night')) return 'moon';
  if (text.includes('rời') || text.includes('ra ngoài') || text.includes('away') || text.includes('door') || text.includes('cổng')) return 'door';
  if (text.includes('về') || text.includes('home') || text.includes('nhà')) return 'home';
  if (text.includes('phim') || text.includes('film') || text.includes('movie') || text.includes('cinema')) return 'film';
  if (text.includes('việc') || text.includes('work') || text.includes('briefcase')) return 'briefcase';
  if (text.includes('thư giãn') || text.includes('relax') || text.includes('coffee') || text.includes('đọc sách')) return 'lamp';
  if (text.includes('tiệc') || text.includes('party')) return 'sparkles';
  if (text.includes('năng lượng') || text.includes('tiết kiệm') || text.includes('energy')) return 'energy';
  return 'sparkles';
}

export function getFigmaIconForDevice(action?: string, deviceName?: string): IconName {
  const text = `${action ?? ''} ${deviceName ?? ''}`.toUpperCase();
  if (text.includes('LIGHT') || text.includes('LED') || text.includes('ĐÈN') || text.includes('LAMP') || text.includes('RGB')) return 'lamp';
  if (text.includes('AC') || text.includes('AIR') || text.includes('LẠNH') || text.includes('ĐIỀU HÒA') || text.includes('CASPER')) return 'snowflake';
  if (text.includes('GATE') || text.includes('DOOR') || text.includes('CỔNG') || text.includes('CỬA') || text.includes('OPEN') || text.includes('CLOSE')) return 'door';
  if (text.includes('LOCK') || text.includes('KHÓA')) return 'lock';
  if (text.includes('CAMERA')) return 'camera';
  if (text.includes('BƠM') || text.includes('PUMP')) return 'droplet';
  if (text.includes('TEMP') || text.includes('HUMID') || text.includes('NHIỆT')) return 'thermometer';
  if (text.includes('MOTION') || text.includes('CHUYỂN ĐỘNG')) return 'activity';
  if (text.includes('FAN') || text.includes('QUẠT') || text.includes('SPEED')) return 'automation';
  return 'grid';
}

// ──────────────────────────────────────────────────────────────────────────
// Subcomponents matching Figma Design v3
// ──────────────────────────────────────────────────────────────────────────

function ScenesTopBar({
  totalCount,
  activeCount,
  userInitial = 'M',
}: {
  totalCount: number;
  activeCount: number;
  userInitial?: string;
}) {
  return (
    <header className="topbar scenes-topbar">
      <div>
        <span className="eyebrow">
          {totalCount} KỊCH BẢN · {activeCount} ĐANG BẬT
        </span>
        <h2>Kịch bản</h2>
      </div>
      <div className="top-actions">
        <VoiceAssistantButton />
        <NotificationBell />
        <div className="avatar">{userInitial}</div>
      </div>
    </header>
  );
}

function ScenarioCard({
  scene,
  onToggle,
  onOpen,
  onHistory,
  onDuplicate,
  onDelete,
  onRun,
  running,
  runSuccess,
  hasFailed,
}: {
  scene: SceneResponse;
  onToggle: () => void;
  onOpen: () => void;
  onHistory: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onRun: () => void;
  running: boolean;
  runSuccess: boolean;
  hasFailed?: boolean;
}) {
  const [menu, setMenu] = useState(false);
  const actionCount = scene.actions?.length || 0;

  // Extract unique device icons from scene actions
  const deviceIcons = useMemo(() => {
    if (!scene.actions || scene.actions.length === 0) {
      return ['lamp', 'snowflake'] as IconName[];
    }
    const icons: IconName[] = [];
    scene.actions.forEach((a) => {
      const ic = getFigmaIconForDevice(a.action, a.targetDeviceName);
      if (!icons.includes(ic)) icons.push(ic);
    });
    return icons.length > 0 ? icons : (['lamp'] as IconName[]);
  }, [scene.actions]);

  const sceneIcon = getFigmaIconForScene(scene.name, scene.icon);

  const caption = running
    ? `Đang chạy 1/${Math.max(1, actionCount)}…`
    : hasFailed
    ? 'Lần chạy gần nhất lỗi'
    : actionCount
    ? `${actionCount} hành động · Chạy thủ công`
    : 'Chưa có hành động';

  return (
    <article
      className={`scenario-card glass-g1 ${scene.enabled ? 'on' : 'off'} ${
        hasFailed ? 'failed' : ''
      } ${running ? 'running' : ''}`}
      onClick={onOpen}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
    >
      <div className="scenario-top">
        <span className="scenario-icon">
          <Icon name={sceneIcon} />
        </span>
        <button
          type="button"
          className={`toggle ${scene.enabled ? 'active' : ''}`}
          aria-pressed={scene.enabled}
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          title={scene.enabled ? 'Tắt kịch bản' : 'Bật kịch bản'}
        >
          <span />
        </button>
      </div>

      <div className="scenario-copy">
        <h3>{scene.name}</h3>
        <p>{caption}</p>
      </div>

      <div className="scenario-bottom">
        <div className="scenario-devices">
          {deviceIcons.slice(0, 3).map((icon, index) => (
            <span key={`${icon}-${index}`}>
              <Icon name={icon} size={13} />
            </span>
          ))}
          {deviceIcons.length > 3 && <b>+{deviceIcons.length - 3}</b>}
        </div>

        <button
          type="button"
          className="run-scene"
          disabled={!actionCount || running}
          onClick={(e) => {
            e.stopPropagation();
            onRun();
          }}
          title="Chạy kịch bản ngay"
        >
          {running ? <i /> : runSuccess ? '✓' : '▶'}
        </button>

        <span className="scene-menu-wrap">
          <button
            type="button"
            className="card-affordance"
            onClick={(event) => {
              event.stopPropagation();
              setMenu(!menu);
            }}
            title="Tùy chọn kịch bản"
          >
            <Icon name="more" size={19} />
          </button>
          {menu && (
            <span className="scene-menu glass-g2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenu(false);
                  onOpen();
                }}
              >
                Chỉnh sửa
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenu(false);
                  onHistory();
                }}
              >
                Xem lịch sử
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenu(false);
                  onDuplicate();
                }}
              >
                Nhân bản
              </button>
              <button
                type="button"
                className="danger"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenu(false);
                  onDelete();
                }}
              >
                Xóa kịch bản
              </button>
            </span>
          )}
        </span>
      </div>

      {running && (
        <span className="scenario-progress">
          <i />
        </span>
      )}
    </article>
  );
}

function PanelShell({
  title,
  caption,
  onClose,
  children,
}: {
  title: string;
  caption: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="scene-layer">
      <button className="detail-scrim" onClick={onClose} aria-label="Đóng" type="button" />
      <aside className="scene-panel glass-g2">
        <div className="sheet-handle" />
        <header className="scene-panel-header">
          <button className="detail-icon-button" onClick={onClose} type="button">
            ×
          </button>
          <div>
            <strong>{title}</strong>
            <small>{caption}</small>
          </div>
        </header>
        <div className="scene-panel-scroll">{children}</div>
      </aside>
    </div>
  );
}

export function SceneHistory({
  scene,
  homeId,
  onRerun,
}: {
  scene: SceneResponse;
  homeId: string;
  onRerun?: () => void;
}) {
  const [filter, setFilter] = useState<'Tất cả' | 'Thành công' | 'Có lỗi'>('Tất cả');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [executions, setExecutions] = useState<SceneExecutionResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getSceneExecutions(homeId, scene.id)
      .then((res) => {
        if (active) setExecutions(res || []);
      })
      .catch((err) => {
        console.warn('Lỗi tải lịch sử kịch bản:', err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [homeId, scene.id]);

  const filtered = useMemo(() => {
    return executions.filter((ex) => {
      const isSuccess = ex.status === 'SUCCESS' || ex.resultDetail?.every((r) => r.success);
      if (filter === 'Thành công') return isSuccess;
      if (filter === 'Có lỗi') return !isSuccess;
      return true;
    });
  }, [executions, filter]);

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch {
      return '00:00';
    }
  };

  const formatTrigger = (trigger: string) => {
    switch (trigger) {
      case 'MANUAL': return 'Chạy thủ công';
      case 'SCHEDULE': return 'Theo lịch trình';
      case 'AUTOMATION': return 'Theo tự động hóa';
      case 'VOICE': return 'Giọng nói AI';
      default: return 'Kích hoạt';
    }
  };

  return (
    <div className="scene-panel-content">
      <div className="history-filters">
        {(['Tất cả', 'Thành công', 'Có lỗi'] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={filter === item ? 'active' : ''}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400">
          Đang tải lịch sử thực thi...
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-400">
          Chưa có lịch sử thực thi nào cho kịch bản này.
        </div>
      ) : (
        <>
          <h3>Lần chạy gần đây</h3>
          {filtered.map((ex) => {
            const isSuccess = ex.status === 'SUCCESS' || ex.resultDetail?.every((r) => r.success);
            const totalActions = ex.resultDetail?.length || scene.actions?.length || 1;
            const successActions = ex.resultDetail?.filter((r) => r.success).length || (isSuccess ? totalActions : 0);
            const isExp = expandedId === ex.id;

            return (
              <div className="scene-run" key={ex.id}>
                <button
                  type="button"
                  onClick={() => setExpandedId(isExp ? null : ex.id)}
                >
                  <span className={isSuccess ? '' : 'error'}>
                    {isSuccess ? '✓' : '!'}
                  </span>
                  <strong>{formatTime(ex.startedAt)}</strong>
                  <p>{formatTrigger(ex.triggerSource)}</p>
                  <small>{`${successActions}/${totalActions} hành động`}</small>
                </button>

                {isExp && (
                  <div className="run-actions">
                    {ex.resultDetail && ex.resultDetail.length > 0 ? (
                      ex.resultDetail.map((act, idx) => (
                        <p key={idx}>
                          <span>{`Thiết bị ${act.deviceId?.slice(0, 8) || ''} · ${act.action}`}</span>
                          <b className={act.success ? 'text-emerald-600' : 'text-rose-500'}>
                            {act.success ? 'Thành công' : act.message || 'Không phản hồi'}
                          </b>
                        </p>
                      ))
                    ) : (
                      <p>
                        <span>{scene.name}</span>
                        <b>{isSuccess ? 'Thành công' : 'Có lỗi'}</b>
                      </p>
                    )}
                    {!isSuccess && onRerun && (
                      <button type="button" onClick={onRerun}>
                        Chạy lại kịch bản
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function AiSuggestions({
  onClose,
  onApplySuggestion,
}: {
  onClose: () => void;
  onApplySuggestion: (name: string, description: string, icon: IconName) => void;
}) {
  const [list, setList] = useState<[IconName, string, string, string][]>([
    [
      'moon',
      'Chuẩn bị đi ngủ',
      'Bạn thường tắt đèn lúc 23:00',
      'Tắt đèn · Khóa cửa',
    ],
    [
      'energy',
      'Tiết kiệm điện',
      'Điều hòa thường bật khi không có người',
      'Tắt điều hòa · Tắt đèn',
    ],
    [
      'home',
      'Chào đón về nhà',
      'Bạn thường về nhà lúc 18:15',
      'Mở đèn · Bật điều hòa',
    ],
    [
      'film',
      'Xem phim cuối tuần',
      'Thường kích hoạt vào tối thứ Bảy',
      'Đổi màu đèn sang Điện ảnh · Bật quạt',
    ],
  ]);

  const handleDismiss = (name: string) => {
    setList((prev) => prev.filter((item) => item[1] !== name));
  };

  return (
    <PanelShell
      title="Gợi ý cho bạn"
      caption="Dựa trên thói quen gần đây"
      onClose={onClose}
    >
      <div className="ai-list">
        {list.map(([icon, name, reason, actions]) => (
          <article className="ai-card glass-g1" key={name}>
            <span>
              <Icon name={icon} />
            </span>
            <div>
              <strong>{name}</strong>
              <p>{reason}</p>
            </div>
            <small>{actions}</small>
            <footer>
              <button type="button" onClick={() => handleDismiss(name)}>
                Bỏ qua
              </button>
              <button
                type="button"
                onClick={() => {
                  onApplySuggestion(name, reason, icon);
                  onClose();
                }}
              >
                Thêm kịch bản
              </button>
            </footer>
          </article>
        ))}
        {list.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-400">
            Không còn gợi ý nào mới.
          </div>
        )}
      </div>
    </PanelShell>
  );
}





function ScenesEmpty({
  mode,
  onCreate,
  onQuickCreate,
}: {
  mode: 'empty' | 'search' | 'active';
  onCreate: () => void;
  onQuickCreate: (name: string) => void;
}) {
  if (mode !== 'empty') {
    return (
      <div className="scenes-empty">
        <strong>
          {mode === 'search'
            ? 'Không tìm thấy kịch bản'
            : 'Chưa có kịch bản đang bật'}
        </strong>
        <p>
          {mode === 'search'
            ? 'Thử từ khóa khác hoặc xóa bộ lọc.'
            : 'Bật một kịch bản để hiển thị tại đây.'}
        </p>
      </div>
    );
  }
  return (
    <div className="scenes-empty">
      <strong>Chưa có kịch bản nào</strong>
      <p>Kịch bản giúp điều khiển nhiều thiết bị chỉ với một lần chạm</p>
      <div>
        {['Chào buổi sáng', 'Chúc ngủ ngon', 'Rời khỏi nhà', 'Về đến nhà'].map(
          (item) => (
            <button key={item} type="button" onClick={() => onQuickCreate(item)}>
              {item}
            </button>
          )
        )}
      </div>
      <button className="add-device" type="button" onClick={onCreate}>
        + Tạo kịch bản
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Main ScenePage Component
// ──────────────────────────────────────────────────────────────────────────

export function ScenePage() {
  const navigate = useNavigate();
  const { homeId: routeHomeId, sceneId } = useParams<{ homeId?: string; sceneId?: string }>();
  const authUser = useAppSelector((state) => state.auth.user);
  const currentReduxHomeId = useAppSelector((state) => state.auth.currentHomeId);
  const homeId = routeHomeId || currentReduxHomeId || authUser?.homeId || '';

  const [scenes, setScenes] = useState<SceneResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'Tất cả' | 'Đang bật' | 'Đang tắt'>('Tất cả');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  // Devices & Action Types for Editor
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [actionTypes, setActionTypes] = useState<SceneActionType[]>([]);

  // Execution states
  const [runningId, setRunningId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [failedIds, setFailedIds] = useState<Record<string, boolean>>({});

  // Sheets & Dialogs
  type SheetType =
    | null
    | { type: 'editor'; scene?: SceneResponse | null }
    | { type: 'history'; scene: SceneResponse }
    | { type: 'ai' };

  const [sheet, setSheet] = useState<SheetType>(null);
  const [deletingScene, setDeletingScene] = useState<SceneResponse | null>(null);

  // Fetch scenes from backend
  const fetchScenes = useCallback(async (silent = false) => {
    if (!homeId) return;
    try {
      if (!silent) setLoading(true);
      const data = await getScenes(homeId);
      setScenes(data || []);
    } catch (err: unknown) {
      notify.error(getErrorMessage(err, 'Lỗi tải danh sách kịch bản'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [homeId]);

  // Initial load
  useEffect(() => {
    void fetchScenes();
    if (homeId) {
      Promise.all([
        getDevices(homeId).catch(() => []),
        getSceneActionTypes(homeId).catch(() => []),
      ]).then(([devs, types]) => {
        setDevices(devs);
        setActionTypes(types);
      });
    }
  }, [fetchScenes, homeId]);

  // Handle sceneId param from URL if navigated directly
  useEffect(() => {
    if (sceneId && scenes.length > 0) {
      const found = scenes.find((s) => s.id === sceneId);
      if (found) {
        setSheet({ type: 'editor', scene: found });
      }
    }
  }, [sceneId, scenes]);

  // Toggle active/inactive
  const handleToggle = async (scene: SceneResponse) => {
    const nextState = !scene.enabled;
    // Optimistic UI update
    setScenes((prev) =>
      prev.map((s) => (s.id === scene.id ? { ...s, enabled: nextState } : s))
    );

    try {
      const updated = await updateScene(homeId, scene.id, sceneToggleInput(scene));
      setScenes((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s))
      );
      notify.success(
        updated.enabled ? `Đã bật "${scene.name}"` : `Đã tắt "${scene.name}"`
      );
    } catch (err: unknown) {
      // Revert optimistic update
      setScenes((prev) =>
        prev.map((s) => (s.id === scene.id ? { ...s, enabled: scene.enabled } : s))
      );
      notify.error(getErrorMessage(err, 'Không thể cập nhật trạng thái kịch bản'));
    }
  };

  // Run scene
  const handleRun = async (scene: SceneResponse) => {
    if (!scene.actions?.length) {
      notify.info('Kịch bản chưa có hành động nào để thực thi');
      return;
    }
    setRunningId(scene.id);
    try {
      const res = await executeScene(homeId, scene.id);
      const isOk = res.status === 'SUCCESS' || res.resultDetail?.every((r) => r.success);
      if (isOk) {
        setSuccessId(scene.id);
        setFailedIds((prev) => ({ ...prev, [scene.id]: false }));
        notify.success(`Đã kích hoạt "${scene.name}" thành công`);
        window.setTimeout(() => setSuccessId(null), 1400);
      } else {
        setFailedIds((prev) => ({ ...prev, [scene.id]: true }));
        notify.warning(`Kịch bản "${scene.name}" chạy với một số lỗi`);
      }
    } catch (err: unknown) {
      setFailedIds((prev) => ({ ...prev, [scene.id]: true }));
      notify.error(getErrorMessage(err, 'Lỗi khi kích hoạt kịch bản'));
    } finally {
      setRunningId(null);
    }
  };

  // Duplicate scene
  const handleDuplicate = async (scene: SceneResponse) => {
    try {
      const duplicatePayload = {
        name: `${scene.name} (Bản sao)`,
        description: scene.description || undefined,
        icon: scene.icon,
        enabled: scene.enabled,
        actions: (scene.actions || []).map((a, idx) => ({
          targetDeviceId: a.targetDeviceId,
          action: a.action,
          value: a.value,
          order: idx,
        })),
      };
      const created = await createScene(homeId, duplicatePayload);
      setScenes((prev) => [...prev, created]);
      notify.success(`Đã nhân bản kịch bản "${created.name}"`);
    } catch (err: unknown) {
      notify.error(getErrorMessage(err, 'Không thể nhân bản kịch bản'));
    }
  };

  // Delete scene
  const handleDeleteConfirm = async () => {
    if (!deletingScene) return;
    try {
      await deleteScene(homeId, deletingScene.id);
      setScenes((prev) => prev.filter((s) => s.id !== deletingScene.id));
      notify.success(`Đã xóa kịch bản "${deletingScene.name}"`);
      setDeletingScene(null);
    } catch (err: unknown) {
      notify.error(getErrorMessage(err, 'Không thể xóa kịch bản'));
    }
  };

  // Quick create from empty state or suggestions
  const handleQuickCreate = (name: string, reason?: string, ic?: IconName) => {
    setSheet({
      type: 'editor',
      scene: {
        id: '',
        homeId,
        name,
        description: reason || '',
        icon: ic || getFigmaIconForScene(name),
        enabled: true,
        actions: [],
        createdAt: '',
        updatedAt: '',
      },
    });
  };

  const handleCreateScene = () => {
    setSheet({ type: 'editor', scene: null });
  };

  // Filtered list
  const visibleScenes = useMemo(() => {
    return scenes.filter((scene) => {
      const matchesSearch =
        scene.name.toLowerCase().includes(query.toLowerCase()) ||
        (scene.description || '').toLowerCase().includes(query.toLowerCase());
      if (!matchesSearch) return false;
      if (filter === 'Đang bật') return scene.enabled;
      if (filter === 'Đang tắt') return !scene.enabled;
      return true;
    });
  }, [scenes, query, filter]);

  const activeCount = scenes.filter((s) => s.enabled).length;
  const totalActions = scenes.reduce((acc, cur) => acc + (cur.actions?.length || 0), 0);
  const userInitial = authUser?.fullName
    ? authUser.fullName.trim().split(' ').slice(-1)[0]?.charAt(0).toUpperCase() || 'M'
    : 'M';

  return (
    <div className="app-shell scenes-page">
      {/* 3 Pastel glowing background meshes */}
      <div className="mesh mesh-one" />
      <div className="mesh mesh-two" />
      <div className="mesh mesh-three" />

      {/* Unified NavRail sidebar */}
      <DashboardNavRail
        homeId={homeId}
        activeItem="scenes"
        user={authUser || undefined}
        onSelectOverview={() => navigate('/home')}
      />

      <main>
        {/* Topbar */}
        <ScenesTopBar
          totalCount={scenes.length}
          activeCount={activeCount}
          userInitial={userInitial}
        />

        {/* Actions Bar */}
        <div className="scenes-actions">
          <div className="scene-filter">
            {(['Tất cả', 'Đang bật', 'Đang tắt'] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={filter === item ? 'active' : ''}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="scene-actions-right">
            {searchOpen && (
              <input
                autoFocus
                className="inline-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm kịch bản"
              />
            )}
            <IconButton
              icon="search"
              label="Tìm kiếm"
              onClick={() => setSearchOpen(!searchOpen)}
            />
            <button
              type="button"
              className="scene-ghost"
              onClick={() => navigate(homeId ? `/homes/${homeId}/automation-rules` : '/home')}
            >
              Quy tắc
            </button>
            <button
              type="button"
              className="scene-ghost"
              onClick={() => setSheet({ type: 'ai' })}
            >
              <Icon name="sparkles" size={17} />
              Gợi ý AI
            </button>
            <button
              type="button"
              className="add-device"
              onClick={handleCreateScene}
            >
              + Tạo kịch bản
            </button>
          </div>
        </div>

        {/* Summary Strip */}
        <div className="scene-summary">
          <span className="stat">{scenes.length} kịch bản</span>
          <span className="stat">{activeCount} đang bật</span>
          <span className="stat">{totalActions} hành động</span>
        </div>

        {/* Main Content: Skeleton, Empty, or Grid */}
        {loading && scenes.length === 0 ? (
          <div className="scenarios-grid">
            {Array.from({ length: 6 }, (_, index) => (
              <div className="scenario-skeleton glass-g1" key={index}>
                <i />
                <i />
                <i />
              </div>
            ))}
          </div>
        ) : query && visibleScenes.length === 0 ? (
          <ScenesEmpty
            mode="search"
            onCreate={handleCreateScene}
            onQuickCreate={handleQuickCreate}
          />
        ) : filter === 'Đang bật' && visibleScenes.length === 0 ? (
          <ScenesEmpty
            mode="active"
            onCreate={handleCreateScene}
            onQuickCreate={handleQuickCreate}
          />
        ) : scenes.length === 0 ? (
          <ScenesEmpty
            mode="empty"
            onCreate={handleCreateScene}
            onQuickCreate={handleQuickCreate}
          />
        ) : (
          <div className="scenarios-grid">
            {visibleScenes.map((scene) => (
              <ScenarioCard
                key={scene.id}
                scene={scene}
                onToggle={() => handleToggle(scene)}
                onOpen={() => setSheet({ type: 'editor', scene })}
                onHistory={() => setSheet({ type: 'history', scene })}
                onDuplicate={() => handleDuplicate(scene)}
                onDelete={() => setDeletingScene(scene)}
                onRun={() => handleRun(scene)}
                running={runningId === scene.id}
                runSuccess={successId === scene.id}
                hasFailed={failedIds[scene.id]}
              />
            ))}
          </div>
        )}
      </main>

      {/* Side Panels / Sheets */}
      {sheet && (
        <>
          {sheet.type === 'ai' && (
            <AiSuggestions
              onClose={() => setSheet(null)}
              onApplySuggestion={handleQuickCreate}
            />
          )}

          {sheet.type === 'history' && (
            <PanelShell
              title={sheet.scene.name}
              caption="Lịch sử thực thi"
              onClose={() => setSheet(null)}
            >
              <SceneHistory
                scene={sheet.scene}
                homeId={homeId}
                onRerun={() => handleRun(sheet.scene)}
              />
            </PanelShell>
          )}

          {sheet.type === 'editor' && (
            <SceneEditor
              scene={sheet.scene}
              homeId={homeId}
              devices={devices}
              actionTypes={actionTypes}
              onClose={() => setSheet(null)}
              onSaved={(saved) => {
                setScenes((prev) => {
                  const exists = prev.some((s) => s.id === saved.id);
                  if (exists) return prev.map((s) => (s.id === saved.id ? saved : s));
                  return [...prev, saved];
                });
              }}
              onDuplicate={(s) => void handleDuplicate(s)}
              onDelete={(s) => setDeletingScene(s)}
            />
          )}
        </>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingScene && (
        <div className="delete-dialog glass-g2">
          <strong>Xóa {deletingScene.name}?</strong>
          <p>Kịch bản sẽ bị xóa khỏi ngôi nhà này.</p>
          <div>
            <button type="button" onClick={() => setDeletingScene(null)}>
              Hủy
            </button>
            <button
              type="button"
              className="danger"
              onClick={handleDeleteConfirm}
            >
              Xóa kịch bản
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ScenePage;
