import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useAppSelector } from '../../store/hooks';
import {
  getScenes,
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
} from '../../types/scene';
import type { DeviceSummary } from '../../types/automation';
import { formatSceneAction, sceneToggleInput } from './sceneActions';
import { actionLabels } from '../automation/ruleLabels';
import { DashboardNavRail } from '../home/DashboardNavRail';
import { DashboardBottomNav } from '../home/DashboardBottomNav';
import { Icon, type IconName } from '../ui/LucideIcon';
import { AutomationTopBar } from '../automation/AutomationTopBar';
import { notify } from '../ui/notify';
import { getErrorMessage } from '../../utils/errors';
import { SceneEditor } from './SceneEditor';
import { ConfirmModal } from '../ui/ConfirmModal';

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

// One accent hue per kind of scene so tiles are recognisable at a glance.
const SCENE_HUES: Partial<Record<IconName, string>> = {
  sun: '#d17a0b',
  moon: '#6a55e0',
  door: '#5b6b82',
  home: '#2a9456',
  film: '#d9486e',
  briefcase: '#1769d6',
  lamp: '#b8860b',
  energy: '#0d8f8a',
};

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
  const actions = scene.actions || [];
  const sceneIcon = getFigmaIconForScene(scene.name, scene.icon);
  const hue = SCENE_HUES[sceneIcon];

  const status = running
    ? { dot: 'on', text: 'Đang chạy…' }
    : hasFailed
    ? { dot: 'err', text: 'Lần chạy gần nhất lỗi' }
    : scene.enabled
    ? { dot: 'on', text: `${actions.length} hành động` }
    : { dot: '', text: 'Đang tắt' };

  const menuItem = (label: string, icon: IconName, handler: () => void, danger = false) => (
    <button
      type="button"
      className={danger ? 'danger' : ''}
      onClick={(e) => {
        e.stopPropagation();
        setMenu(false);
        handler();
      }}
    >
      <Icon name={icon} />
      {label}
    </button>
  );

  return (
    <article
      className={`st-scene ${scene.enabled ? '' : 'is-off'}`}
      style={hue ? ({ '--hue': hue } as React.CSSProperties) : undefined}
      onClick={onOpen}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && onOpen()}
      aria-label={`Kịch bản ${scene.name}`}
    >
      {running && (
        <span className="st-scene-progress">
          <i />
        </span>
      )}

      <div className="st-scene-head">
        <span className="st-scene-icon">
          <Icon name={sceneIcon} size={24} />
        </span>
        <button
          type="button"
          className={`toggle ${scene.enabled ? 'active' : ''}`}
          aria-pressed={scene.enabled}
          aria-label={scene.enabled ? `Tắt kịch bản ${scene.name}` : `Bật kịch bản ${scene.name}`}
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          title={scene.enabled ? 'Tắt kịch bản' : 'Bật kịch bản'}
        >
          <span />
        </button>
      </div>

      <h3 title={scene.name}>{scene.name}</h3>
      <p className="st-scene-desc" title={scene.description || undefined}>
        {scene.description || 'Chạy thủ công hoặc theo lịch'}
      </p>

      <ul className="st-scene-devices">
        {actions.length === 0 && <li className="more">Chưa có hành động nào</li>}
        {actions.slice(0, 3).map((action, index) => (
          <li key={action.id || index}>
            <Icon name={getFigmaIconForDevice(action.action, action.targetDeviceName)} />
            <span title={action.targetDeviceName || undefined}>{action.targetDeviceName || 'Thiết bị'}</span>
            {(action.action === 'SET_RGB' || (action.action as string) === 'SET_COLOR') && typeof action.value === 'string' && /^#[0-9a-f]{3,8}$/i.test(action.value) ? (
              <em className="st-color-value" title={formatSceneAction(action)}>
                <i style={{ background: action.value }} aria-hidden="true" />
                {action.value.toUpperCase()}
              </em>
            ) : (
              <em title={formatSceneAction(action)}>{formatSceneAction(action)}</em>
            )}
          </li>
        ))}
        {actions.length > 3 && <li className="more">+{actions.length - 3} hành động khác</li>}
      </ul>

      <footer>
        <span className="st-status">
          <i className={`st-dot ${status.dot}`} />
          {status.text}
        </span>

        <button
          type="button"
          className={`st-run ${runSuccess ? 'done' : ''}`}
          disabled={!actions.length || running || !scene.enabled}
          onClick={(e) => {
            e.stopPropagation();
            onRun();
          }}
          title={scene.enabled ? 'Chạy kịch bản ngay' : 'Bật kịch bản để chạy'}
        >
          {running ? <i className="st-spin" /> : <Icon name={runSuccess ? 'check' : 'play'} />}
          {runSuccess ? 'Xong' : 'Chạy'}
        </button>

        <span className="st-menu-wrap">
          <button
            type="button"
            className="st-icon-btn"
            aria-label="Tùy chọn kịch bản"
            aria-expanded={menu}
            onClick={(event) => {
              event.stopPropagation();
              setMenu(!menu);
            }}
          >
            <Icon name="more" size={18} />
          </button>
          {menu && (
            <span className="st-menu up" onClick={(e) => e.stopPropagation()}>
              {menuItem('Chỉnh sửa', 'pencil', onOpen)}
              {menuItem('Xem lịch sử', 'clock', onHistory)}
              {menuItem('Nhân bản', 'copy', onDuplicate)}
              <hr />
              {menuItem('Xóa kịch bản', 'trash', onDelete, true)}
            </span>
          )}
        </span>
      </footer>
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
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '--:--';
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
    if (days === 0) return `Hôm nay ${time}`;
    if (days === 1) return `Hôm qua ${time}`;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${time}`;
  };

  const formatTrigger = (trigger: string) => {
    switch (trigger) {
      case 'MANUAL': return 'Bạn bấm chạy';
      case 'SCHEDULE': return 'Tự chạy theo giờ hẹn';
      case 'AUTOMATION': return 'Do quy tắc tự động';
      case 'VOICE': return 'Ra lệnh bằng giọng nói';
      default: return 'Tự chạy';
    }
  };

  const deviceName = (id?: string) =>
    scene.actions?.find((a) => a.targetDeviceId === id)?.targetDeviceName || 'Thiết bị đã bị xóa';

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
                    <Icon name={isSuccess ? 'check' : 'alert'} size={14} />
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
                          <span title={deviceName(act.deviceId)}>{`${deviceName(act.deviceId)} · ${actionLabels[act.action] || 'Điều khiển'}`}</span>
                          <b className={act.success ? 'text-emerald-600' : 'text-rose-500'}>
                            {act.success ? 'Thành công' : 'Thiết bị không phản hồi'}
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
  onReset,
}: {
  mode: 'empty' | 'search' | 'filter';
  onCreate: () => void;
  onQuickCreate: (name: string) => void;
  onReset: () => void;
}) {
  if (mode !== 'empty') {
    return (
      <div className="st-empty">
        <div className="st-empty-icon">
          <Icon name="search" />
        </div>
        <h3>{mode === 'search' ? 'Không tìm thấy kịch bản' : 'Không có kịch bản nào trong mục này'}</h3>
        <p>Thử từ khóa khác hoặc xem tất cả kịch bản.</p>
        <button type="button" className="st-btn" onClick={onReset}>
          Xem tất cả
        </button>
      </div>
    );
  }
  return (
    <div className="st-empty">
      <div className="st-empty-icon">
        <Icon name="sparkles" />
      </div>
      <h3>Chưa có kịch bản nào</h3>
      <p>Kịch bản gom nhiều thao tác thành một lần chạm. Bắt đầu từ một mẫu quen thuộc:</p>
      <div className="st-chips">
        {['Chào buổi sáng', 'Chúc ngủ ngon', 'Rời khỏi nhà', 'Về đến nhà'].map((item) => (
          <button key={item} type="button" className="st-btn st-btn-sm" onClick={() => onQuickCreate(item)}>
            <Icon name={getFigmaIconForScene(item)} size={16} />
            {item}
          </button>
        ))}
      </div>
      <button className="st-btn st-btn-primary" type="button" onClick={onCreate}>
        <Icon name="plus" size={18} />
        Tạo kịch bản
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
  const currentReduxHomeId = useAppSelector((state) => state.home?.currentHomeId);
  const homeId = routeHomeId || currentReduxHomeId || '';

  const [scenes, setScenes] = useState<SceneResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'Tất cả' | 'Đang bật' | 'Đang tắt'>('Tất cả');
  const [query, setQuery] = useState('');

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
  const resetFilters = () => {
    setQuery('');
    setFilter('Tất cả');
  };
  const userInitial = authUser?.fullName
    ? authUser.fullName.trim().split(' ').slice(-1)[0]?.charAt(0).toUpperCase() || 'M'
    : 'M';

  return (
    <div className="app-shell scenes-page studio st-theme st-pro">
      <DashboardNavRail
        homeId={homeId}
        activeItem="scenes"
        user={authUser || undefined}
        onSelectOverview={() => navigate('/home')}
      />

      <main>
        <AutomationTopBar
          caption={`${scenes.length} kịch bản · ${activeCount} đang bật`}
          title="Kịch bản"
          subtitle="Gom nhiều thao tác thành một lần chạm: chạy ngay, theo lịch hoặc từ quy tắc tự động."
          userInitial={userInitial}
        />

        <div className="st-toolbar">
          <div className="st-seg" role="tablist" aria-label="Lọc kịch bản">
            {(['Tất cả', 'Đang bật', 'Đang tắt'] as const).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={filter === item}
                className={filter === item ? 'active' : ''}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <label className="st-search">
            <Icon name="search" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm kịch bản"
              aria-label="Tìm kịch bản"
            />
          </label>

          <div className="st-toolbar-end">
            <button
              type="button"
              className="st-link"
              onClick={() => navigate(homeId ? `/homes/${homeId}/automation-rules` : '/home')}
            >
              <Icon name="automation" />
              <span>Quy tắc</span>
            </button>
            <button type="button" className="st-link" onClick={() => setSheet({ type: 'ai' })}>
              <Icon name="sparkles" />
              <span>Gợi ý</span>
            </button>
            <button type="button" className="st-btn st-btn-primary" onClick={handleCreateScene}>
              <Icon name="plus" size={18} />
              Tạo kịch bản
            </button>
          </div>
        </div>

        {loading && scenes.length === 0 ? (
          <div className="st-scene-grid" aria-busy="true">
            <span className="sr-only">Đang tải kịch bản...</span>
            {Array.from({ length: 4 }, (_, index) => (
              <div className="st-skeleton" style={{ height: 236 }} key={index} />
            ))}
          </div>
        ) : scenes.length === 0 ? (
          <ScenesEmpty mode="empty" onCreate={handleCreateScene} onQuickCreate={handleQuickCreate} onReset={resetFilters} />
        ) : visibleScenes.length === 0 ? (
          <ScenesEmpty
            mode={query ? 'search' : 'filter'}
            onCreate={handleCreateScene}
            onQuickCreate={handleQuickCreate}
            onReset={resetFilters}
          />
        ) : (
          <div className="st-scene-grid">
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
            {filter !== 'Đang tắt' && !query && (
              <button type="button" className="st-scene-new" onClick={handleCreateScene}>
                <span>
                  <Icon name="plus" />
                </span>
                Kịch bản mới
              </button>
            )}
          </div>
        )}
      </main>

      <DashboardBottomNav activeItem="scenes" homeId={homeId} />

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
        <ConfirmModal
          isOpen={true}
          title={`Xóa “${deletingScene.name}”?`}
          description="Kịch bản sẽ bị xóa khỏi ngôi nhà này. Thao tác này không thể hoàn tác."
          confirmText="Xóa kịch bản"
          cancelText="Hủy"
          variant="danger"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingScene(null)}
        />
      )}
    </div>
  );
}

export default ScenePage;
