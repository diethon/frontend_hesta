import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { sceneRunMessage } from './sceneRunMessage';
import { useNavigate, useParams } from 'react-router';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { currentHomeChanged, currentHomeCleared } from '../../store/homeSlice';
import {
  getScenes,
  createScene,
  updateScene,
  deleteScene,
  executeScene,
  runSceneLater,
  cancelSceneRunLater,
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
import { SceneEditor, ICON_POPOVER_LIST } from './SceneEditor';
import { ConfirmModal } from '../ui/ConfirmModal';
import { useRealtimeRefetch } from '../../realtime/useRealtimeRefetch';
import { iconHue } from '../automation/iconHue';

const SCENE_REFRESH_EVENTS = ['SCENE_CHANGED'] as const;

/** A run counts as successful only once it finished; an empty or PENDING result is not a success. */
function runSucceeded(run: SceneExecutionResponse): boolean {
  if (run.status === 'SUCCESS') return true;
  if (run.status === 'PENDING' || !run.resultDetail?.length) return false;
  return run.resultDetail.every((r) => r.success);
}

// Same presets as the mobile app (scene_timer.dart).
const RUN_LATER_PRESETS = [
  { label: '10 giây', seconds: 10 },
  { label: '1 phút', seconds: 60 },
  { label: '5 phút', seconds: 300 },
  { label: '15 phút', seconds: 900 },
  { label: '30 phút', seconds: 1800 },
  { label: '1 giờ', seconds: 3600 },
];
const RUN_LATER_UNITS = [
  { label: 'giây', seconds: 1 },
  { label: 'phút', seconds: 60 },
  { label: 'giờ', seconds: 3600 },
];
const MAX_RUN_LATER_SECONDS = 24 * 3600;

/** "1:05:09" / "4:07" countdown to `runAt`. */
export function formatCountdown(runAt: string, now: number): string {
  const total = Math.max(0, Math.ceil((new Date(runAt).getTime() - now) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** Re-renders every second while `active`, for countdowns. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

function RunLaterForm({ onSubmit }: { onSubmit: (seconds: number) => Promise<void> }) {
  const [amount, setAmount] = useState('2');
  const [unit, setUnit] = useState(60);
  const [busy, setBusy] = useState(false);
  const seconds = Math.round(Number(amount) * unit);
  const valid = Number.isFinite(seconds) && seconds >= 1 && seconds <= MAX_RUN_LATER_SECONDS;
  const submit = async (value: number) => {
    setBusy(true);
    try {
      await onSubmit(value);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="st-run-later">
      <p className="st-subtitle">Kịch bản sẽ tự chạy một lần sau khoảng thời gian bạn chọn. Đặt lại sẽ thay hẹn giờ cũ.</p>
      <div className="st-run-later-presets">
        {RUN_LATER_PRESETS.map((preset) => (
          <button key={preset.seconds} type="button" className="st-btn st-btn-sm" disabled={busy}
            onClick={() => void submit(preset.seconds)}>
            {preset.label}
          </button>
        ))}
      </div>
      <form className="st-run-later-custom" onSubmit={(e) => { e.preventDefault(); if (valid) void submit(seconds); }}>
        <label>
          <span>Hoặc tự nhập</span>
          <input type="number" min={1} step="any" inputMode="decimal" value={amount}
            aria-label="Số lượng" onChange={(e) => setAmount(e.target.value)} />
        </label>
        <select aria-label="Đơn vị" value={unit} onChange={(e) => setUnit(Number(e.target.value))}>
          {RUN_LATER_UNITS.map((u) => <option key={u.seconds} value={u.seconds}>{u.label}</option>)}
        </select>
        <button type="submit" className="st-btn st-btn-primary" disabled={!valid || busy}>Hẹn giờ</button>
      </form>
      {!valid && <small className="st-run-later-error">Chọn từ 1 giây đến 24 giờ.</small>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Icon Mapping Helpers
// ──────────────────────────────────────────────────────────────────────────

export function getFigmaIconForScene(name?: string, icon?: string | null): IconName {
  // An icon picked in the editor wins; name keywords only cover old scenes saved without one.
  if (icon && (ICON_POPOVER_LIST as string[]).includes(icon)) return icon as IconName;
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

function ScenarioCard({
  scene,
  onToggle,
  onOpen,
  onHistory,
  onDuplicate,
  onDelete,
  onRun,
  onRunLater,
  onCancelRunLater,
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
  onRunLater: () => void;
  onCancelRunLater: () => void;
  running: boolean;
  runSuccess: boolean;
  hasFailed?: boolean;
}) {
  const [menu, setMenu] = useState(false);
  const actions = scene.actions || [];
  const sceneIcon = getFigmaIconForScene(scene.name, scene.icon);

  const pendingRunAt = scene.pendingRunAt ?? null;
  const now = useNow(!!pendingRunAt);
  const status = running
    ? { dot: 'on', text: 'Đang chạy…' }
    : pendingRunAt
    ? { dot: 'on', text: new Date(pendingRunAt).getTime() <= now ? 'Đang chạy…' : `Chạy sau ${formatCountdown(pendingRunAt, now)}` }
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
        <span className="st-scene-icon" style={iconHue(sceneIcon)}>
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
          <li key={action.id || index} style={iconHue(getFigmaIconForDevice(action.action, action.targetDeviceName))}>
            <Icon name={getFigmaIconForDevice(action.action, action.targetDeviceName)} />
            <span title={action.targetDeviceName || undefined}>{action.targetDeviceName || 'Thiết bị'}</span>
            {(action.action === 'SET_RGB' || (action.action as string) === 'SET_COLOR') && typeof action.value === 'string' && /^#[0-9a-f]{3,8}$/i.test(action.value) ? (
              <em className="st-color-value" title={formatSceneAction(action)}>
                <i style={{ background: action.value }} aria-hidden="true" />
                Đổi màu
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
              {scene.enabled && actions.length > 0 && menuItem(pendingRunAt ? 'Đổi hẹn giờ chạy' : 'Chạy sau…', 'clock', onRunLater)}
              {pendingRunAt && menuItem('Hủy hẹn giờ chạy', 'x', onCancelRunLater)}
              {menuItem('Xem lịch sử', 'clock', onHistory)}
              {menuItem('Nhân bản', 'copy', onDuplicate)}
              <hr />
              {menuItem('Xóa kịch bản', 'trash', onDelete, true)}
            </span>
          )}
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
      <aside className="scene-panel glass-g2" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-handle" />
        <header className="scene-panel-header">
          <button className="detail-icon-button" onClick={onClose} type="button" aria-label="Đóng">
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
      const isSuccess = runSucceeded(ex);
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
      case 'TIMER': return 'Hẹn giờ chạy một lần';
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
            const isSuccess = runSucceeded(ex);
            const isRunning = ex.status === 'PENDING';
            const totalActions = ex.resultDetail?.length || scene.actions?.length || 1;
            const successActions = ex.resultDetail?.filter((r) => r.success).length || (isSuccess ? totalActions : 0);
            const isExp = expandedId === ex.id;

            return (
              <div className="scene-run" key={ex.id}>
                <button
                  type="button"
                  onClick={() => setExpandedId(isExp ? null : ex.id)}
                >
                  <span className={isSuccess || isRunning ? '' : 'error'}>
                    <Icon name={isRunning ? 'clock' : isSuccess ? 'check' : 'alert'} size={14} />
                  </span>
                  <strong>{formatTime(ex.startedAt)}</strong>
                  <p>{formatTrigger(ex.triggerSource)}</p>
                  <small>{isRunning ? 'Đang chờ thiết bị phản hồi…' : `${successActions}/${totalActions} hành động`}</small>
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
  const dispatch = useAppDispatch();

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
    | { type: 'timer'; scene: SceneResponse };

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

  // Subscribe the realtime socket to this home even when the page is opened directly.
  useEffect(() => {
    dispatch(currentHomeChanged(homeId || null));
    return () => {
      dispatch(currentHomeCleared());
    };
  }, [dispatch, homeId]);

  // Another member edited, ran or scheduled a scene: refresh quietly (RealtimeLifecycle already dropped the cache).
  useRealtimeRefetch(SCENE_REFRESH_EVENTS, homeId, () => void fetchScenes(true));

  // Handle sceneId param from URL if navigated directly
  // Open once per deep link: realtime refetches replace `scenes` and must not reopen a closed editor.
  const openedDeepLinkRef = useRef<string | null>(null);
  useEffect(() => {
    if (sceneId && scenes.length > 0 && openedDeepLinkRef.current !== sceneId) {
      const found = scenes.find((s) => s.id === sceneId);
      if (found) {
        openedDeepLinkRef.current = sceneId;
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
      const isOk = runSucceeded(res);
      if (isOk) {
        setSuccessId(scene.id);
        setFailedIds((prev) => ({ ...prev, [scene.id]: false }));
        notify.success(sceneRunMessage(scene, res).text);
        window.setTimeout(() => setSuccessId(null), 1400);
      } else {
        setFailedIds((prev) => ({ ...prev, [scene.id]: true }));
        const msg = sceneRunMessage(scene, res);
        notify[msg.kind](msg.text);
      }
    } catch (err: unknown) {
      setFailedIds((prev) => ({ ...prev, [scene.id]: true }));
      notify.error(getErrorMessage(err, 'Lỗi khi kích hoạt kịch bản'));
    } finally {
      setRunningId(null);
    }
  };

  const setPendingRun = (sceneId: string, pendingRunAt: string | null) =>
    setScenes((prev) => prev.map((s) => (s.id === sceneId ? { ...s, pendingRunAt } : s)));

  const handleRunLater = async (scene: SceneResponse, seconds: number) => {
    try {
      const runAt = await runSceneLater(homeId, scene.id, seconds);
      setPendingRun(scene.id, runAt);
      setSheet(null);
      notify.success(`"${scene.name}" sẽ chạy lúc ${new Date(runAt).toLocaleTimeString('vi-VN', { hour12: false })}`);
    } catch (err: unknown) {
      notify.error(getErrorMessage(err, 'Không hẹn giờ được kịch bản'));
    }
  };

  const handleCancelRunLater = async (scene: SceneResponse) => {
    try {
      await cancelSceneRunLater(homeId, scene.id);
      setPendingRun(scene.id, null);
      notify.info(`Đã hủy hẹn giờ "${scene.name}"`);
    } catch (err: unknown) {
      notify.error(getErrorMessage(err, 'Không hủy được hẹn giờ'));
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
      <div className="mesh mesh-one" />
      <div className="mesh mesh-two" />
      <div className="mesh mesh-three" />
      <DashboardNavRail
        homeId={homeId}
        activeItem="scenes"
        user={authUser || undefined}
        onSelectOverview={() => navigate('/home')}
      />

      <main>
        <AutomationTopBar
          caption={loading && scenes.length === 0 ? 'Đang tải kịch bản...' : `${scenes.length} kịch bản · ${activeCount} đang bật`}
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
                onRunLater={() => setSheet({ type: 'timer', scene })}
                onCancelRunLater={() => void handleCancelRunLater(scene)}
                running={runningId === scene.id}
                runSuccess={successId === scene.id}
                hasFailed={failedIds[scene.id]}
              />
            ))}
          </div>
        )}
      </main>

      <DashboardBottomNav activeItem="scenes" homeId={homeId} />

      {/* Side Panels / Sheets */}
      {sheet && (
        <>
          {sheet.type === 'timer' && (
            <PanelShell title={sheet.scene.name} caption="Hẹn giờ chạy một lần" onClose={() => setSheet(null)}>
              <RunLaterForm onSubmit={(seconds) => handleRunLater(sheet.scene, seconds)} />
            </PanelShell>
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
