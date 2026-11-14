/* eslint-disable react-refresh/only-export-components */
import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router';
import {
  ArrowUpDown,
  ChevronDown,
  Check,
  Settings2,
  WifiOff,
  Lock,
  Clock,
  Zap,
  AlertTriangle,
  Plus,
  Filter,
} from 'lucide-react';
import { Icon, IconButton } from '../home/HomeIcons';
import { DashboardNavRail } from '../home/DashboardNavRail';
import { DashboardBottomNav } from '../home/DashboardBottomNav';
import { AddDeviceModal } from './AddDeviceModal';
import { RoomManagementModal } from './RoomManagementModal';
import { DeviceDetailModal } from './DeviceDetailModal';
import { DeviceGroupSection } from './DeviceGroupSection';
import { DevicesOverviewStrip } from './DevicesOverviewStrip';
import {
  getDevicesByHome,
  sendDeviceCommand,
  sendManualPowerCommand,
  homeDevicesKey,
} from '../../services/deviceApi';
import { getRooms } from '../../services/roomApi';
import { getHomeEnergyAnalytics, energyAnalyticsKey } from '../../services/energyApi';
import { peekCache } from '../../services/queryCache';
import type { DeviceResponse } from '../../types/device';
import type { RoomResponse } from '../../types/room';
import type { DeviceEnergyBreakdown } from '../../types/energy';
import { getErrorMessage, isDuplicateCommandError } from '../../utils/errors';
import { NotificationBell } from '../notification/NotificationBell';
import { VoiceAssistantButton } from '../ui/VoiceAssistant';
import { currentHomeChanged, currentHomeCleared } from '../../store/homeSlice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { notify } from '../ui/notify';
import { realtimeEventDispatcher } from '../../realtime/realtimeEvents';
import type { RealtimeEvent } from '../../realtime/realtimeTypes';
import { useOverrideCountdown } from './useOverrideCountdown';
import {
  type UIMappedDevice,
  type DeviceSortOption,
  SORT_OPTIONS,
  mapDeviceToUI,
  formatLastSeenVi,
  getDeviceRatedWattage,
  getDeviceTypeColorClass,
} from './devicePageHelpers';
import './devices-page.css';

// Re-export interface and helper to maintain backwards compatibility
export type { UIMappedDevice } from './devicePageHelpers';
export { mapDeviceToUI } from './devicePageHelpers';

// ──────────────────────────────────────────────────────────────────────────
// Subcomponents
// ──────────────────────────────────────────────────────────────────────────

function DevicesTopBar({
  onlineCount,
  activeCount,
  searchQuery,
  onSearchChange,
  userInitial = 'M',
}: {
  onlineCount: number;
  activeCount: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  userInitial?: string;
}) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="topbar devices-topbar">
      <div>
        <span className="eyebrow">
          {onlineCount} TRỰC TUYẾN · {activeCount} ĐANG BẬT
        </span>
        <h2>Thiết bị</h2>
      </div>
      <div className="top-actions">
        {searchOpen && (
          <input
            autoFocus
            className="inline-search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Tìm thiết bị"
          />
        )}
        <IconButton
          icon="search"
          label="Tìm kiếm"
          onClick={() => setSearchOpen(!searchOpen)}
        />
        <VoiceAssistantButton />
        <NotificationBell />
        <div className="avatar">{userInitial}</div>
      </div>
    </header>
  );
}

function RoomFilterStrip({
  rooms,
  activeRoom,
  totalCount,
  roomCounts,
  onChange,
}: {
  rooms: RoomResponse[];
  activeRoom: string;
  totalCount: number;
  roomCounts: Record<string, number>;
  onChange: (roomId: string) => void;
}) {
  return (
    <div className="device-room-strip">
      <button
        type="button"
        className={`${activeRoom === 'ALL' ? 'active' : ''} ${
          totalCount === 0 ? 'empty' : ''
        }`}
        onClick={() => onChange('ALL')}
      >
        Tất cả phòng <span>({totalCount})</span>
      </button>
      {rooms.map((room) => {
        const count = roomCounts[room.id] || 0;
        return (
          <button
            key={room.id}
            type="button"
            className={`${activeRoom === room.id ? 'active' : ''} ${
              count === 0 ? 'empty' : ''
            }`}
            onClick={() => onChange(room.id)}
          >
            {room.name} <span>({count})</span>
          </button>
        );
      })}
    </div>
  );
}

function QuickFilters({
  active,
  activeCount,
  offlineCount,
  sensorCount,
  lightsOnCount,
  onChange,
  onTurnOffAllLights,
}: {
  active: 'all' | 'on' | 'offline' | 'sensor';
  activeCount: number;
  offlineCount: number;
  sensorCount: number;
  lightsOnCount: number;
  onChange: (filter: 'all' | 'on' | 'offline' | 'sensor') => void;
  onTurnOffAllLights: () => void;
}) {
  return (
    <div className="quick-filters">
      <button
        type="button"
        className={`stat ${active === 'on' ? 'active' : ''}`}
        onClick={() => onChange(active === 'on' ? 'all' : 'on')}
      >
        <Icon name="power" size={16} />
        <span>Đang bật ({activeCount})</span>
      </button>

      <button
        type="button"
        className={`stat ${active === 'offline' ? 'active' : ''}`}
        onClick={() => onChange(active === 'offline' ? 'all' : 'offline')}
      >
        <WifiOff size={15} className="shrink-0" />
        <span>Ngoại tuyến ({offlineCount})</span>
      </button>

      <button
        type="button"
        className={`stat ${active === 'sensor' ? 'active' : ''}`}
        onClick={() => onChange(active === 'sensor' ? 'all' : 'sensor')}
      >
        <Icon name="thermometer" size={16} />
        <span>Cảm biến ({sensorCount})</span>
      </button>

      {active === 'on' && lightsOnCount > 0 && (
        <button
          type="button"
          className="lights-off-action"
          onClick={onTurnOffAllLights}
        >
          Tắt tất cả đèn ({lightsOnCount})
        </button>
      )}
    </div>
  );
}

const resolveGateLabel = (rawState?: unknown) => {
  const s = String(rawState ?? '').toUpperCase();
  if (s === 'OPEN' || s === 'OPENING') return 'Mở';
  if (s === 'CLOSE' || s === 'CLOSED' || s === 'CLOSING') return 'Đóng';
  return 'Dừng';
};

function DevicesDeviceCard({
  device,
  grouped,
  kwhToday,
  onToggle,
  onOpen,
  onGateCommand,
}: {
  device: UIMappedDevice;
  grouped: boolean;
  kwhToday?: number;
  onToggle: () => void;
  onOpen: () => void;
  onGateCommand: (cmd: 'Mở' | 'Dừng' | 'Đóng') => void;
}) {
  const rawGateState = device.raw?.currentState?.state;
  const [prevRawGateState, setPrevRawGateState] = useState(rawGateState);
  const [gate, setGate] = useState(() => resolveGateLabel(rawGateState));

  if (rawGateState !== prevRawGateState) {
    setPrevRawGateState(rawGateState);
    setGate(resolveGateLabel(rawGateState));
  }

  const { isOverrideActive, formattedTime } = useOverrideCountdown(
    device.manualOverrideUntil
  );

  const colorClass = getDeviceTypeColorClass(device.type);
  const isPowerDevice =
    !device.sensor && device.type !== 'Cảm biến' && device.type !== 'Camera';
  const showKwh = isPowerDevice && !device.offline && (kwhToday ?? 0) > 0;
  const lastSeenText = formatLastSeenVi(device.raw?.lastSeen || device.raw?.updatedAt);

  return (
    <article
      className={`devices-device-card glass-g1 ${device.on ? 'on' : ''} ${
        device.offline ? 'offline' : ''
      }`}
      tabIndex={0}
      role="button"
      aria-label={`${device.name}, ${device.room}, ${device.status}`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="device-top">
        <div className="icon-tile-wrap">
          <span className={`device-icon type-${colorClass}`}>
            <Icon name={device.icon} />
            <span
              className={`status-dot ${
                device.raw?.status === 'UNKNOWN'
                  ? 'unknown'
                  : device.offline
                  ? 'offline'
                  : 'online'
              }`}
              title={
                device.raw?.status === 'UNKNOWN'
                  ? 'Không xác định'
                  : device.offline
                  ? 'Ngoại tuyến'
                  : 'Trực tuyến'
              }
            />
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {isOverrideActive && (
            <span
              className="override-badge"
              title="Đang ưu tiên thủ công (Quy tắc tự động tạm dừng). Bấm để xem chi tiết"
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
            >
              <Lock size={10} className="shrink-0" />
              <span>{formattedTime}</span>
            </span>
          )}
          {!device.offline && !device.sensor && device.type !== 'Cổng' ? (
            <button
              type="button"
              className={`toggle ${device.on ? 'active' : ''}`}
              onClick={(event) => {
                event.stopPropagation();
                onToggle();
              }}
              aria-pressed={device.on}
              aria-label={`${device.on ? 'Tắt' : 'Bật'} ${device.name}`}
            >
              <span />
            </button>
          ) : (
            <button
              type="button"
              className="card-affordance"
              aria-label={`Mở ${device.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
            >
              <Icon name="more" size={19} />
            </button>
          )}
        </div>
      </div>

      {device.value && (
        <strong className="devices-value">{device.value}</strong>
      )}

      <div className="device-copy">
        <h3 title={device.name}>{device.name}</h3>
        <p>{device.status}</p>
      </div>

      {device.type === 'Đèn' && device.on && (
        <div
          className="brightness"
          aria-label={`Độ sáng ${device.brightness || 80}%`}
        >
          <span style={{ width: `${device.brightness || 80}%` }} />
          <b>{device.brightness || 80}%</b>
        </div>
      )}

      {device.type === 'Cổng' && (
        <div className="gate-controls">
          {(['Mở', 'Dừng', 'Đóng'] as const).map((item) => (
            <button
              type="button"
              key={item}
              className={gate === item ? 'active' : ''}
              onClick={(event) => {
                event.stopPropagation();
                setGate(item);
                onGateCommand(item);
              }}
            >
              {item}
            </button>
          ))}
        </div>
      )}

      <div className="device-card-footer">
        <span className="footer-metric">
          {showKwh ? (
            <span className="footer-energy">
              <Zap size={11} className="inline mr-1" />
              {(kwhToday ?? 0).toFixed(2)} kWh hôm nay
            </span>
          ) : device.raw?.status === 'UNKNOWN' ? (
            <span className="footer-time text-amber-600 dark:text-amber-400">
              <AlertTriangle size={11} className="inline mr-1" />
              Không xác định{lastSeenText && lastSeenText !== 'Chưa có dữ liệu' ? ` · ${lastSeenText}` : ''}
            </span>
          ) : device.offline ? (
            <span className="footer-time text-offline">
              <WifiOff size={11} className="inline mr-1" />
              Ngoại tuyến{lastSeenText && lastSeenText !== 'Chưa có dữ liệu' ? ` · ${lastSeenText}` : ''}
            </span>
          ) : (
            <span className="footer-time">
              <Clock size={11} className="inline mr-1" />
              Cập nhật {lastSeenText}
            </span>
          )}
        </span>
        {!grouped && <span className="room-label">{device.room}</span>}
      </div>
    </article>
  );
}

function EmptyState({
  mode,
  onResetSearch,
  onAddDevice,
}: {
  mode: 'home' | 'search' | 'room';
  onResetSearch?: () => void;
  onAddDevice?: () => void;
}) {
  const copy =
    mode === 'search'
      ? ['Không tìm thấy thiết bị', 'Thử từ khóa khác hoặc xóa bộ lọc tìm kiếm.']
      : mode === 'room'
      ? [
          'Phòng này chưa có thiết bị',
          'Các thiết bị mới được gán sẽ xuất hiện tại đây.',
        ]
      : [
          'Ngôi nhà chưa có thiết bị',
          'Kết nối thiết bị đầu tiên để bắt đầu quản lý.',
        ];

  return (
    <div className="devices-empty glass-g1">
      <Icon name="grid" size={38} />
      <strong>{copy[0]}</strong>
      <p>{copy[1]}</p>
      {mode === 'search' && onResetSearch && (
        <button
          type="button"
          className="secondary-button"
          onClick={onResetSearch}
        >
          Xóa tìm kiếm
        </button>
      )}
      {mode === 'home' && onAddDevice && (
        <button type="button" className="add-device" onClick={onAddDevice}>
          + Thêm thiết bị đầu tiên
        </button>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Main DevicePage Component
// ──────────────────────────────────────────────────────────────────────────

function getInitialDeviceEnergyData(homeId?: string): {
  totalKwh: number;
  estimatedCostVnd: number;
  breakdown: Record<string, DeviceEnergyBreakdown>;
} | null {
  if (!homeId) return null;
  const res = peekCache<import('../../types/energy').EnergyAnalyticsResponse>(energyAnalyticsKey(homeId, '24H'));
  if (res && res.summary) {
    const bMap: Record<string, DeviceEnergyBreakdown> = {};
    if (Array.isArray(res.breakdown)) {
      res.breakdown.forEach((item) => {
        if (item.deviceId) {
          bMap[item.deviceId] = item;
        }
      });
    }
    return {
      totalKwh: res.summary.totalKwh ?? 0,
      estimatedCostVnd: res.summary.estimatedCostVnd ?? 0,
      breakdown: bMap,
    };
  }
  return null;
}

export const DevicePage: React.FC = () => {
  const { homeId } = useParams<{ homeId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.auth.user);

  // Core filter and view state
  const [rooms, setRooms] = useState<RoomResponse[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('ALL');
  const [quickFilter, setQuickFilter] = useState<
    'all' | 'on' | 'offline' | 'sensor'
  >('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('Tất cả');
  const [sort, setSort] = useState<DeviceSortOption>('Nhóm theo phòng');
  const [sortOpen, setSortOpen] = useState(false);
  const sortWrapRef = useRef<HTMLDivElement>(null);
  const sortButtonRef = useRef<HTMLButtonElement>(null);

  // Devices & local optimistic states
  const [devices, setDevices] = useState<DeviceResponse[]>(() => {
    if (homeId) {
      const cached = peekCache<DeviceResponse[]>(homeDevicesKey(homeId));
      if (cached) return cached;
    }
    return [];
  });
  const [localPower, setLocalPower] = useState<Record<string, boolean>>({});
  const [localBrightness, setLocalBrightness] = useState<
    Record<string, number>
  >({});

  // Energy analytics state
  const [energyData, setEnergyData] = useState<{
    totalKwh: number;
    estimatedCostVnd: number;
    breakdown: Record<string, DeviceEnergyBreakdown>;
  } | null>(() => getInitialDeviceEnergyData(homeId));

  const [loading, setLoading] = useState<boolean>(() => {
    if (homeId) {
      return !peekCache(homeDevicesKey(homeId));
    }
    return true;
  });
  const [error, setError] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);

  // Selected device for Detail modal/drawer
  const [selectedDevice, setSelectedDevice] = useState<UIMappedDevice | null>(
    null
  );

  // Outside click & Escape dismiss for Sort Popover
  useEffect(() => {
    if (!sortOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sortWrapRef.current &&
        !sortWrapRef.current.contains(event.target as Node)
      ) {
        setSortOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSortOpen(false);
        sortButtonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [sortOpen]);

  // Sync homeId in Redux
  useEffect(() => {
    dispatch(currentHomeChanged(homeId ?? null));
    return () => {
      dispatch(currentHomeCleared());
    };
  }, [dispatch, homeId]);

  // Micro-batching realtime MQTT sync
  const pendingUpdatesRef = useRef<
    Map<
      string,
      {
        currentState?: Record<string, unknown>;
        status?: DeviceResponse['status'];
        lastSeen?: string | null;
      }
    >
  >(new Map());
  const rafIdRef = useRef<number | null>(null);

  const flushDeviceUpdates = useCallback(() => {
    rafIdRef.current = null;
    if (pendingUpdatesRef.current.size === 0) return;

    const updates = new Map(pendingUpdatesRef.current);
    pendingUpdatesRef.current.clear();

    setDevices((prev) => {
      let hasChanges = false;
      const next = prev.map((d) => {
        const patch = updates.get(d.id);
        if (!patch) return d;
        hasChanges = true;
        return {
          ...d,
          currentState: patch.currentState
            ? { ...d.currentState, ...patch.currentState }
            : d.currentState,
          status: patch.status ?? d.status,
          lastSeen: patch.lastSeen ?? d.lastSeen,
        };
      });
      return hasChanges ? next : prev;
    });

    setSelectedDevice((prev) => {
      if (!prev) return null;
      const patch = updates.get(prev.id);
      if (!patch || !prev.raw) return prev;
      const updatedRaw: DeviceResponse = {
        ...prev.raw,
        currentState: patch.currentState
          ? { ...prev.raw.currentState, ...patch.currentState }
          : prev.raw.currentState,
        status: patch.status ?? prev.raw.status,
        lastSeen: patch.lastSeen ?? prev.raw.lastSeen,
      };
      return mapDeviceToUI(updatedRaw, localPower, localBrightness);
    });
  }, [localPower, localBrightness]);

  const handleDeviceStateChanged = useCallback(
    (event: RealtimeEvent<unknown>) => {
      if (!event || event.type !== 'DEVICE_STATE_CHANGED' || !event.data) return;
      const data = event.data as {
        id?: string;
        deviceId?: string;
        currentState?: Record<string, unknown>;
        status?: string;
        lastSeen?: string | null;
      };
      const targetId = data.id || data.deviceId || event.deviceId;
      if (!targetId) return;

      const existing = pendingUpdatesRef.current.get(targetId);
      pendingUpdatesRef.current.set(targetId, {
        currentState: {
          ...(existing?.currentState ?? {}),
          ...(data.currentState ?? {}),
        },
        status: (data.status as DeviceResponse['status']) ?? existing?.status,
        lastSeen: data.lastSeen ?? existing?.lastSeen,
      });

      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(flushDeviceUpdates);
      }
    },
    [flushDeviceUpdates]
  );

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return realtimeEventDispatcher.register(
      'DEVICE_STATE_CHANGED',
      handleDeviceStateChanged
    );
  }, [handleDeviceStateChanged]);

  // Fetch rooms and devices
  const fetchRooms = useCallback(async () => {
    if (!homeId) return;
    try {
      const data = await getRooms(homeId);
      setRooms(data || []);
    } catch (err: unknown) {
      console.error('Lỗi tải danh sách phòng:', err);
    }
  }, [homeId]);

  const fetchEnergy = useCallback(async () => {
    if (!homeId) return;
    try {
      const res = await getHomeEnergyAnalytics(homeId, '24H');
      if (res && res.summary) {
        const bMap: Record<string, DeviceEnergyBreakdown> = {};
        if (Array.isArray(res.breakdown)) {
          res.breakdown.forEach((item) => {
            if (item.deviceId) {
              bMap[item.deviceId] = item;
            }
          });
        }
        setEnergyData({
          totalKwh: res.summary.totalKwh ?? 0,
          estimatedCostVnd: res.summary.estimatedCostVnd ?? 0,
          breakdown: bMap,
        });
      }
    } catch {
      // Silent on error: hide energy numbers without toast
    }
  }, [homeId]);

  const fetchDevices = useCallback(
    async (silent = false) => {
      if (!homeId) return;
      try {
        if (!silent) setLoading(true);
        setError('');
        const data = await getDevicesByHome(homeId);
        setDevices(data || []);
        void fetchEnergy();
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Lỗi tải danh sách thiết bị'));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [homeId, fetchEnergy]
  );

  useEffect(() => {
    let active = true;
    const initData = async () => {
      if (!homeId) return;
      const cached = peekCache<DeviceResponse[]>(homeDevicesKey(homeId));
      if (cached) {
        setDevices(cached);
        setLoading(false);
      }
      const initialEnergy = getInitialDeviceEnergyData(homeId);
      if (initialEnergy) {
        setEnergyData(initialEnergy);
      }
      try {
        const [roomsData, devicesData] = await Promise.all([
          getRooms(homeId).catch((err) => {
            console.error('Lỗi tải danh sách phòng:', err);
            return [];
          }),
          getDevicesByHome(homeId).catch((err) => {
            if (active) setError(getErrorMessage(err, 'Lỗi tải danh sách thiết bị'));
            return [];
          }),
        ]);
        if (active) {
          setRooms(roomsData || []);
          setDevices(devicesData || []);
          setLoading(false);
          void fetchEnergy();
        }
      } catch {
        if (active) setLoading(false);
      }
    };
    void initData();
    return () => {
      active = false;
    };
  }, [homeId, fetchEnergy]);

  // Toggle power handler
  const handleTogglePower = async (deviceId: string) => {
    const dev = devices.find((d) => d.id === deviceId);
    if (!dev) {
      setLocalPower((prev) => ({
        ...prev,
        [deviceId]: prev[deviceId] !== undefined ? !prev[deviceId] : false,
      }));
      return;
    }

    const currentOn =
      localPower[deviceId] !== undefined
        ? localPower[deviceId]
        : dev.currentState?.power === 'ON' ||
          dev.currentState?.power === true ||
          dev.currentState?.power === 'true';

    const nextOn = !currentOn;
    const action = nextOn ? 'TURN_ON' : 'TURN_OFF';

    setLocalPower((prev) => ({ ...prev, [deviceId]: nextOn }));

    try {
      const result = await sendManualPowerCommand(deviceId, action);
      if (!result.command.success) {
        setLocalPower((prev) => ({ ...prev, [deviceId]: currentOn }));
        notify.error(result.command.message || 'Thiết bị không nhận lệnh');
      } else {
        void fetchDevices(true);
      }
    } catch (e) {
      if (!isDuplicateCommandError(e)) {
        setLocalPower((prev) => ({ ...prev, [deviceId]: currentOn }));
        notify.error(getErrorMessage(e, 'Không thể gửi lệnh'));
      }
    }
  };

  // Turn off all lights
  const handleTurnOffAllLights = async () => {
    const onLights = devices.filter((d) => {
      const isLight =
        (d.deviceType || '').toUpperCase().includes('LIGHT') ||
        (d.deviceType || '').toUpperCase().includes('LED');
      if (!isLight) return false;
      const isPowerOn =
        localPower[d.id] !== undefined
          ? localPower[d.id]
          : d.currentState?.power === 'ON' ||
            d.currentState?.power === true ||
            d.currentState?.power === 'true';
      return isPowerOn;
    });

    if (onLights.length === 0) {
      notify.info('Không có đèn nào đang bật');
      return;
    }

    notify.info(`Đang tắt ${onLights.length} đèn...`);
    const nextPowerMap: Record<string, boolean> = { ...localPower };
    onLights.forEach((l) => {
      nextPowerMap[l.id] = false;
    });
    setLocalPower(nextPowerMap);

    await Promise.allSettled(
      onLights.map((l) =>
        sendManualPowerCommand(l.id, 'TURN_OFF').catch(console.warn)
      )
    );
    notify.success('Đã tắt toàn bộ đèn');
    void fetchDevices(true);
  };

  // Gate command
  const handleGateCommand = async (
    deviceId: string,
    cmd: 'Mở' | 'Dừng' | 'Đóng'
  ) => {
    const dev = devices.find((d) => d.id === deviceId);
    if (!dev) return;
    const action = cmd === 'Mở' ? 'OPEN' : cmd === 'Đóng' ? 'CLOSE' : 'STOP';
    try {
      await sendDeviceCommand(deviceId, action);
      notify.success(`Đã gửi lệnh ${cmd} cổng`);
    } catch (e) {
      notify.error(getErrorMessage(e, 'Lỗi điều khiển cổng'));
    }
  };

  // Brightness change
  const handleBrightnessChange = async (
    deviceId: string,
    brightness: number
  ) => {
    setLocalBrightness((prev) => ({ ...prev, [deviceId]: brightness }));
    const dev = devices.find((d) => d.id === deviceId);
    if (!dev) return;
    try {
      await sendDeviceCommand(deviceId, 'SET_BRIGHTNESS', { brightness });
    } catch (e) {
      console.warn('Set brightness error:', e);
    }
  };

  // Color change
  const handleColorChange = async (
    deviceId: string,
    r: number,
    g: number,
    b: number
  ) => {
    const brightness = localBrightness[deviceId] || 80;
    const dev = devices.find((d) => d.id === deviceId);
    if (!dev) return;
    try {
      await sendDeviceCommand(deviceId, 'SET_RGB', { r, g, b, brightness });
    } catch (e) {
      console.warn('Set color error:', e);
    }
  };

  // Map all devices to UI representation directly from BE
  const uiDevices: UIMappedDevice[] = useMemo(() => {
    return devices.map((d) => mapDeviceToUI(d, localPower, localBrightness));
  }, [devices, localPower, localBrightness]);

  // Statistics
  const roomCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    uiDevices.forEach((d) => {
      if (d.roomId) {
        counts[d.roomId] = (counts[d.roomId] || 0) + 1;
      }
      if (d.room) {
        counts[d.room] = (counts[d.room] || 0) + 1;
      }
    });
    return counts;
  }, [uiDevices]);

  const onlineCount = useMemo(() => {
    return uiDevices.filter((d) => !d.offline).length;
  }, [uiDevices]);

  const activeCount = useMemo(() => {
    return uiDevices.filter((d) => !d.offline && d.on).length;
  }, [uiDevices]);

  const offlineCount = useMemo(() => {
    return uiDevices.filter((d) => d.offline).length;
  }, [uiDevices]);

  const sensorCount = useMemo(() => {
    return uiDevices.filter((d) => d.sensor).length;
  }, [uiDevices]);

  const lightsOnCount = useMemo(() => {
    return uiDevices.filter((d) => d.type === 'Đèn' && d.on && !d.offline).length;
  }, [uiDevices]);

  // Estimated load in Watts
  const totalEstimatedWattage = useMemo(() => {
    return uiDevices.reduce((sum, d) => {
      if (d.offline || !d.on) return sum;
      const bWattage =
        energyData?.breakdown[d.id]?.wattage ??
        energyData?.breakdown[d.id]?.ratedPowerWatts;
      return sum + getDeviceRatedWattage(d, bWattage);
    }, 0);
  }, [uiDevices, energyData]);

  // Filtered devices
  const visibleDevices = useMemo(() => {
    return uiDevices.filter((device) => {
      // Room filter
      if (selectedRoomId !== 'ALL') {
        const matchId = device.roomId === selectedRoomId;
        const matchName = device.room === selectedRoomId;
        if (!matchId && !matchName) return false;
      }
      // Type dropdown filter
      if (typeFilter !== 'Tất cả' && device.type !== typeFilter) {
        return false;
      }
      // Quick filter
      if (quickFilter === 'on' && !device.on) return false;
      if (quickFilter === 'offline' && !device.offline) return false;
      if (quickFilter === 'sensor' && !device.sensor) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = device.name.toLowerCase().includes(q);
        const matchRoom = device.room.toLowerCase().includes(q);
        const matchType = device.type.toLowerCase().includes(q);
        if (!matchName && !matchRoom && !matchType) return false;
      }
      return true;
    });
  }, [uiDevices, selectedRoomId, typeFilter, quickFilter, searchQuery]);

  // Grouped and sorted devices
  const isGrouped = sort.startsWith('Nhóm');

  const groups = useMemo(() => {
    if (sort === 'Nhóm theo phòng') {
      const map: Record<string, UIMappedDevice[]> = {};
      visibleDevices.forEach((d) => {
        const key = d.room || 'Chưa phân phòng';
        if (!map[key]) map[key] = [];
        map[key].push(d);
      });
      return map;
    }

    if (sort === 'Nhóm theo loại') {
      const map: Record<string, UIMappedDevice[]> = {};
      visibleDevices.forEach((d) => {
        const key = d.type || 'Khác';
        if (!map[key]) map[key] = [];
        map[key].push(d);
      });
      return map;
    }

    // Flat modes:
    const list = [...visibleDevices];

    if (sort === 'Tên A–Z') {
      list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    } else if (sort === 'Trạng thái (đang bật trước)') {
      list.sort((a, b) => {
        const getRank = (d: UIMappedDevice) => {
          if (d.offline) return 3;
          if (d.on) return 1;
          return 2;
        };
        const rankDiff = getRank(a) - getRank(b);
        if (rankDiff !== 0) return rankDiff;
        return a.name.localeCompare(b.name, 'vi');
      });
    } else if (sort === 'Gần đây nhất') {
      list.sort((a, b) => {
        const timeA = a.raw?.lastSeen ? new Date(a.raw.lastSeen).getTime() : -1;
        const timeB = b.raw?.lastSeen ? new Date(b.raw.lastSeen).getTime() : -1;
        if (timeA !== timeB) {
          return timeB - timeA;
        }
        return a.name.localeCompare(b.name, 'vi');
      });
    }

    return { 'Tất cả thiết bị': list };
  }, [visibleDevices, sort]);

  const userInitial = currentUser?.fullName
    ? currentUser.fullName.trim().split(' ').slice(-1)[0]?.charAt(0).toUpperCase() || 'M'
    : 'M';

  // Admin routing check AFTER all hooks to adhere to Rules of Hooks
  if (currentUser?.platformRole === 'ADMIN') {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="app-shell devices-page">
      {/* 3 Pastel glowing meshes */}
      <div className="mesh mesh-one" />
      <div className="mesh mesh-two" />
      <div className="mesh mesh-three" />

      {/* NavRail sidebar */}
      <DashboardNavRail
        homeId={homeId}
        activeItem="devices"
        user={currentUser || undefined}
        onSelectOverview={() => navigate('/home')}
      />

      <main>
        {/* Topbar */}
        <DevicesTopBar
          onlineCount={onlineCount}
          activeCount={activeCount}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          userInitial={userInitial}
        />

        {/* 1. Overview Strip (4 Glass Tiles) */}
        <DevicesOverviewStrip
          onlineCount={onlineCount}
          totalCount={uiDevices.length}
          offlineCount={offlineCount}
          activeCount={activeCount}
          estimatedWattage={totalEstimatedWattage}
          todayKwh={energyData ? energyData.totalKwh : null}
          todayCostVnd={energyData ? energyData.estimatedCostVnd : null}
          onNavigateToEnergy={
            homeId ? () => navigate(`/home/${homeId}/energy`) : undefined
          }
        />

        {/* 1. Room Navigation & Primary Actions Row */}
        <div className="devices-rooms-header-row">
          <div className="devices-room-strip-wrapper">
            <RoomFilterStrip
              rooms={rooms}
              activeRoom={selectedRoomId}
              totalCount={uiDevices.length}
              roomCounts={roomCounts}
              onChange={setSelectedRoomId}
            />
          </div>

          <div className="devices-primary-actions">
            <button
              type="button"
              className="room-manage-btn"
              onClick={() => setIsRoomModalOpen(true)}
              title="Quản lý danh sách phòng"
              aria-label="Quản lý danh sách phòng"
            >
              <Settings2 size={14} className="shrink-0" />
              <span>Quản lý phòng</span>
            </button>

            <button
              type="button"
              className="add-device-btn"
              onClick={() => setIsAddModalOpen(true)}
              title="Thêm thiết bị mới"
              aria-label="Thêm thiết bị mới"
            >
              <Plus size={15} className="shrink-0" />
              <span>Thêm thiết bị</span>
            </button>
          </div>
        </div>

        {/* 2. Filters & Sort Toolbar */}
        <div className="devices-filter-toolbar">
          <QuickFilters
            active={quickFilter}
            activeCount={activeCount}
            offlineCount={offlineCount}
            sensorCount={sensorCount}
            lightsOnCount={lightsOnCount}
            onChange={setQuickFilter}
            onTurnOffAllLights={handleTurnOffAllLights}
          />

          <div className="devices-filter-controls">
            <label className="type-filter-pill">
              <Filter size={13} className="shrink-0 filter-icon" />
              <span className="type-filter-label">Loại:</span>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                aria-label="Lọc theo loại thiết bị"
              >
                <option>Tất cả</option>
                <option>Đèn</option>
                <option>Điều hòa</option>
                <option>Cảm biến</option>
                <option>Cổng</option>
                <option>Công tắc</option>
                <option>Camera</option>
              </select>
              <ChevronDown size={13} className="shrink-0 chevron-icon" />
            </label>

            <div className="sort-wrap" ref={sortWrapRef}>
              <button
                ref={sortButtonRef}
                type="button"
                className="sort-pill-button"
                onClick={() => setSortOpen(!sortOpen)}
                aria-haspopup="listbox"
                aria-expanded={sortOpen}
                aria-label={`Sắp xếp: ${sort}`}
              >
                <ArrowUpDown size={14} className="shrink-0" />
                <span>
                  Sắp xếp: <strong>{sort}</strong>
                </span>
                <ChevronDown
                  size={14}
                  className={`shrink-0 transition-transform ${
                    sortOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {sortOpen && (
                <div
                  className="sort-popover glass-g2"
                  role="listbox"
                  aria-label="Tùy chọn sắp xếp"
                >
                  {SORT_OPTIONS.map((item) => {
                    const isActive = sort === item;
                    return (
                      <button
                        key={item}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        className={`sort-option ${isActive ? 'active' : ''}`}
                        onClick={() => {
                          setSort(item);
                          setSortOpen(false);
                        }}
                      >
                        <span>{item}</span>
                        {isActive && (
                          <Check size={14} className="shrink-0 text-accent" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Smart Device Groups Section */}
        {homeId && (
          <section className="groups-section">
            <DeviceGroupSection
              homeId={homeId}
              availableDevices={devices}
              onRefreshDevices={() => fetchDevices(true)}
            />
          </section>
        )}

        {/* Room / Type Grouped Grid */}
        <section className="room-groups">
          {loading && devices.length === 0 ? (
            <div className="devices-grid">
              {Array.from({ length: 8 }, (_, i) => (
                <div className="device-skeleton glass-g1" key={i}>
                  <span />
                  <i />
                  <i />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="devices-empty glass-g1">
              <Icon name="shield" size={38} />
              <strong className="text-danger">{error}</strong>
              <button
                type="button"
                className="secondary-button"
                onClick={() => fetchDevices()}
              >
                Thử lại
              </button>
            </div>
          ) : searchQuery && visibleDevices.length === 0 ? (
            <EmptyState
              mode="search"
              onResetSearch={() => setSearchQuery('')}
            />
          ) : selectedRoomId !== 'ALL' && visibleDevices.length === 0 ? (
            <EmptyState
              mode="room"
              onAddDevice={() => setIsAddModalOpen(true)}
            />
          ) : visibleDevices.length === 0 ? (
            <EmptyState
              mode="home"
              onAddDevice={() => setIsAddModalOpen(true)}
            />
          ) : (
            Object.entries(groups).map(([label, list]) => (
              <div className="room-device-group" key={label}>
                <div className="room-group-title">
                  <span>{label}</span>
                  <small>
                    {list.length} thiết bị ·{' '}
                    {list.filter((d) => !d.offline && d.on).length} đang bật
                  </small>
                </div>
                <div className="devices-grid">
                  {list.map((device) => (
                    <DevicesDeviceCard
                      key={device.id}
                      device={device}
                      grouped={isGrouped}
                      kwhToday={
                        energyData?.breakdown[device.id]?.kwh ??
                        energyData?.breakdown[device.id]?.energyKwh
                      }
                      onToggle={() => handleTogglePower(device.id)}
                      onOpen={() => setSelectedDevice(device)}
                      onGateCommand={(cmd) => handleGateCommand(device.id, cmd)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
      </main>

      {/* Mobile Bottom Nav */}
      <DashboardBottomNav
        homeId={homeId}
        activeItem="devices"
        onSelectOverview={() => navigate('/home')}
      />

      {/* Device Detail Modal/Drawer */}
      {selectedDevice && (
        <DeviceDetailModal
          device={selectedDevice}
          placement="side"
          onClose={() => setSelectedDevice(null)}
          onDeviceUpdated={(updated) => {
            if (updated?.id) {
              setDevices((prev) =>
                prev.map((d) =>
                  d.id === updated.id
                    ? { ...d, ...updated, settings: { ...(d.settings || {}), ...(updated.settings || {}) } }
                    : d
                )
              );
              setSelectedDevice(
                mapDeviceToUI(updated, localPower, localBrightness)
              );
            }
            void fetchDevices(true);
          }}
          onDeviceRemoved={(removedId) => {
            setDevices((prev) => prev.filter((d) => d.id !== removedId));
            setSelectedDevice(null);
          }}
          onTogglePower={() => handleTogglePower(selectedDevice.id)}
          onBrightnessChange={(brightness) =>
            handleBrightnessChange(selectedDevice.id, brightness)
          }
          onColorChange={(r, g, b) =>
            handleColorChange(selectedDevice.id, r, g, b)
          }
        />
      )}

      {/* Add Device Modal */}
      {homeId && (
        <AddDeviceModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          homeId={homeId}
          rooms={rooms}
          selectedRoomId={selectedRoomId === 'ALL' ? '' : selectedRoomId}
          onSuccess={() => {
            void fetchDevices(true);
          }}
        />
      )}

      {/* Room Management Modal */}
      {homeId && (
        <RoomManagementModal
          isOpen={isRoomModalOpen}
          onClose={() => setIsRoomModalOpen(false)}
          homeId={homeId}
          onRoomsChanged={() => {
            void fetchRooms();
            void fetchDevices(true);
          }}
          onRoomDeleted={(deletedRoomId) => {
            if (selectedRoomId === deletedRoomId) {
              setSelectedRoomId('ALL');
            }
          }}
        />
      )}
    </div>
  );
};

export default DevicePage;
