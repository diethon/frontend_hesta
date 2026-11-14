/* eslint-disable react-refresh/only-export-components */
import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router';
import {
  ArrowUpDown,
  Settings2,
  WifiOff,
  Lock,
  Clock,
  Zap,
  AlertTriangle,
  Plus,
  Filter,
  Power,
  Thermometer,
} from 'lucide-react';
import { Icon } from '../home/HomeIcons';
import { DashboardNavRail } from '../home/DashboardNavRail';
import { DashboardBottomNav } from '../home/DashboardBottomNav';
import { AutomationTopBar } from '../automation/AutomationTopBar';
import { DeviceFilterDropdown, DeviceMobileFilterModal } from './DeviceFilterDropdown';
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
  DEVICE_TYPE_FILTER_OPTIONS,
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

function RoomFilterStrip({
  rooms,
  activeRoom,
  totalCount,
  roomCounts,
  onChange,
  loading = false,
}: {
  rooms: RoomResponse[];
  activeRoom: string;
  totalCount: number;
  roomCounts: Record<string, number>;
  onChange: (roomId: string) => void;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-9 w-24 rounded-full bg-[var(--border)]/50 animate-pulse shrink-0"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-w-0">
      <div
        role="tablist"
        aria-label="Lọc theo phòng"
        className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 scroll-smooth"
        style={{
          maskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent 100%)',
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeRoom === 'ALL'}
          onClick={() => onChange('ALL')}
          className={`h-9 px-4 rounded-full text-xs font-medium shrink-0 inline-flex items-center gap-1.5 transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
            activeRoom === 'ALL'
              ? 'bg-[var(--accent)] text-white shadow-xs'
              : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--muted)]/50'
          } ${totalCount === 0 ? 'opacity-60' : ''}`}
        >
          <span>Tất cả phòng</span>
          <span className="tabular-nums">({totalCount})</span>
        </button>
        {rooms.map((room) => {
          const count = roomCounts[room.id] || 0;
          const isSelected = activeRoom === room.id;
          return (
            <button
              key={room.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => onChange(room.id)}
              title={room.name}
              className={`h-9 px-4 rounded-full text-xs font-medium shrink-0 inline-flex items-center gap-1.5 transition-colors cursor-pointer max-w-[200px] select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                isSelected
                  ? 'bg-[var(--accent)] text-white shadow-xs'
                  : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--muted)]/50'
              } ${count === 0 ? 'opacity-60' : ''}`}
            >
              <span className="truncate">{room.name}</span>
              <span className="tabular-nums shrink-0">({count})</span>
            </button>
          );
        })}
      </div>
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
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
      <button
        type="button"
        className={`h-8 px-3 rounded-full text-xs font-medium inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
          active === 'on'
            ? 'bg-[var(--accent)] text-white shadow-xs'
            : 'border border-[var(--border)] bg-transparent text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--muted)]/40'
        }`}
        onClick={() => onChange(active === 'on' ? 'all' : 'on')}
      >
        <Power className="w-3.5 h-3.5 shrink-0" />
        <span>Đang bật ({activeCount})</span>
      </button>

      <button
        type="button"
        className={`h-8 px-3 rounded-full text-xs font-medium inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
          active === 'offline'
            ? 'bg-[var(--accent)] text-white shadow-xs'
            : 'border border-[var(--border)] bg-transparent text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--muted)]/40'
        }`}
        onClick={() => onChange(active === 'offline' ? 'all' : 'offline')}
      >
        <WifiOff className="w-3.5 h-3.5 shrink-0" />
        <span>Ngoại tuyến ({offlineCount})</span>
      </button>

      <button
        type="button"
        className={`h-8 px-3 rounded-full text-xs font-medium inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
          active === 'sensor'
            ? 'bg-[var(--accent)] text-white shadow-xs'
            : 'border border-[var(--border)] bg-transparent text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--muted)]/40'
        }`}
        onClick={() => onChange(active === 'sensor' ? 'all' : 'sensor')}
      >
        <Thermometer className="w-3.5 h-3.5 shrink-0" />
        <span>Cảm biến ({sensorCount})</span>
      </button>

      {active === 'on' && lightsOnCount > 0 && (
        <button
          type="button"
          className="h-8 px-3 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--muted)]/50 text-xs font-medium inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          onClick={onTurnOffAllLights}
        >
          <span>Tắt tất cả đèn ({lightsOnCount})</span>
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('Tất cả');
  const [sort, setSort] = useState<DeviceSortOption>('Nhóm theo phòng');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

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

      <main className="space-y-5">
        {/* Topbar */}
        <AutomationTopBar
          caption={`${onlineCount} trực tuyến · ${activeCount} đang bật`}
          title="Thiết bị"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchOpen={searchOpen}
          onSearchToggle={() => setSearchOpen(!searchOpen)}
          searchPlaceholder="Tìm thiết bị"
          userInitial={userInitial}
        />

        {/* 1. Overview Strip (Compact G1 Container, 4 Cells) */}
        <DevicesOverviewStrip
          onlineCount={onlineCount}
          totalCount={uiDevices.length}
          offlineCount={offlineCount}
          activeCount={activeCount}
          estimatedWattage={totalEstimatedWattage}
          todayKwh={energyData ? energyData.totalKwh : null}
          todayCostVnd={energyData ? energyData.estimatedCostVnd : null}
          loading={loading && devices.length === 0}
          onNavigateToEnergy={
            homeId ? () => navigate(`/home/${homeId}/energy`) : undefined
          }
        />

        {/* 2. Room Navigation & Primary Actions Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <RoomFilterStrip
              rooms={rooms}
              activeRoom={selectedRoomId}
              totalCount={uiDevices.length}
              roomCounts={roomCounts}
              onChange={setSelectedRoomId}
              loading={loading && rooms.length === 0}
            />
            {/* Mobile Quản lý phòng icon button */}
            <button
              type="button"
              className="sm:hidden h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-transparent text-[var(--text)] hover:bg-[var(--muted)]/50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              onClick={() => setIsRoomModalOpen(true)}
              title="Quản lý phòng"
              aria-label="Quản lý phòng"
            >
              <Settings2 className="w-4 h-4 text-[var(--secondary)]" />
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Desktop Quản lý phòng ghost button */}
            <button
              type="button"
              className="hidden sm:inline-flex h-9 px-3.5 rounded-full border border-[var(--border)] bg-transparent hover:bg-[var(--muted)]/50 text-xs font-medium text-[var(--text)] items-center gap-1.5 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              onClick={() => setIsRoomModalOpen(true)}
              title="Quản lý danh sách phòng"
              aria-label="Quản lý danh sách phòng"
            >
              <Settings2 className="w-4 h-4 text-[var(--secondary)] shrink-0" />
              <span>Quản lý phòng</span>
            </button>

            {/* Exactly ONE Primary Button on the screen */}
            <button
              type="button"
              className="w-full sm:w-auto h-9 px-4 rounded-full bg-[var(--accent)] hover:opacity-95 text-white text-xs font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              onClick={() => setIsAddModalOpen(true)}
              title="Thêm thiết bị mới"
              aria-label="Thêm thiết bị mới"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Thêm thiết bị</span>
            </button>
          </div>
        </div>

        {/* 3. Filters & Sort Toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
          <QuickFilters
            active={quickFilter}
            activeCount={activeCount}
            offlineCount={offlineCount}
            sensorCount={sensorCount}
            lightsOnCount={lightsOnCount}
            onChange={setQuickFilter}
            onTurnOffAllLights={handleTurnOffAllLights}
          />

          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {/* Desktop / Tablet: 2 Ghost Dropdowns */}
            <div className="hidden sm:flex items-center gap-2">
              <DeviceFilterDropdown
                labelPrefix="Loại"
                value={typeFilter}
                options={DEVICE_TYPE_FILTER_OPTIONS}
                onChange={setTypeFilter}
                icon={<Filter className="w-3.5 h-3.5 text-[var(--secondary)] shrink-0" />}
              />
              <DeviceFilterDropdown
                labelPrefix="Sắp xếp"
                value={sort}
                options={SORT_OPTIONS}
                onChange={setSort}
                icon={<ArrowUpDown className="w-3.5 h-3.5 text-[var(--secondary)] shrink-0" />}
              />
            </div>

            {/* Mobile: Single "Bộ lọc" icon button */}
            <button
              type="button"
              onClick={() => setMobileFilterOpen(true)}
              className="sm:hidden h-8 px-3 rounded-lg border border-[var(--border)] bg-transparent hover:bg-[var(--muted)]/50 text-xs font-medium text-[var(--text)] inline-flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label="Bộ lọc và sắp xếp"
            >
              <Filter className="w-3.5 h-3.5 text-[var(--secondary)]" />
              <span>Bộ lọc</span>
            </button>
          </div>
        </div>

        {/* Mobile Filter Modal */}
        <DeviceMobileFilterModal
          isOpen={mobileFilterOpen}
          onClose={() => setMobileFilterOpen(false)}
          typeFilter={typeFilter}
          onTypeChange={setTypeFilter}
          sort={sort}
          onSortChange={setSort}
          typeOptions={DEVICE_TYPE_FILTER_OPTIONS}
          sortOptions={SORT_OPTIONS}
        />

        {/* 4. Smart Device Groups Section */}
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
