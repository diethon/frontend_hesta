import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Icon, IconButton, type IconName } from '../home/HomeIcons';
import { DashboardNavRail } from '../home/DashboardNavRail';
import { DashboardBottomNav } from '../home/DashboardBottomNav';
import { AddDeviceModal } from './AddDeviceModal';
import { RoomManagementModal } from './RoomManagementModal';
import { DeviceDetailModal, type FigmaDeviceType } from './DeviceDetailModal';
import { DeviceGroupSection } from './DeviceGroupSection';
import {
  getDevicesByHome,
  sendDeviceCommand,
  sendManualPowerCommand,
} from '../../services/deviceApi';
import { getRooms } from '../../services/roomApi';
import type { DeviceResponse } from '../../types/device';
import type { RoomResponse } from '../../types/room';
import { getErrorMessage, isDuplicateCommandError } from '../../utils/errors';
import { NotificationBell } from '../notification/NotificationBell';
import { VoiceAssistantButton } from '../ui/VoiceAssistant';
import { currentHomeChanged, currentHomeCleared } from '../../store/homeSlice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { notify } from '../ui/notify';
import { realtimeEventDispatcher } from '../../realtime/realtimeEvents';
import type { RealtimeEvent } from '../../realtime/realtimeTypes';

// ──────────────────────────────────────────────────────────────────────────
// Device Mapping & Helper
// ──────────────────────────────────────────────────────────────────────────

export interface UIMappedDevice {
  id: string;
  name: string;
  room: string;
  roomId?: string;
  type: FigmaDeviceType;
  icon: IconName;
  status: string;
  value?: string;
  on?: boolean;
  offline?: boolean;
  sensor?: boolean;
  brightness?: number;
  raw?: DeviceResponse;
}

export function mapDeviceToUI(d: DeviceResponse, localPower: Record<string, boolean>, localBrightness: Record<string, number>): UIMappedDevice {
  const isOffline = d.status === 'OFFLINE';
  const isPowerOn =
    localPower[d.id] !== undefined
      ? localPower[d.id]
      : d.currentState?.power === 'ON' || d.currentState?.power === true || d.currentState?.power === 'true';

  let type: FigmaDeviceType = 'Công tắc';
  let icon: IconName = 'automation';
  let isSensor = false;
  let valueStr: string | undefined;
  let brightness = localBrightness[d.id] ?? (d.currentState?.brightness ? Number(d.currentState.brightness) : 80);

  const typeUpper = (d.deviceType || '').toUpperCase();
  const nameLower = (d.name || '').toLowerCase();

  if (typeUpper.includes('LIGHT') || typeUpper.includes('LED')) {
    type = 'Đèn';
    icon = 'lamp';
  } else if (
    typeUpper.includes('AIR') ||
    typeUpper.includes('CLIMATE') ||
    typeUpper.includes('AC') ||
    nameLower.includes('điều hòa') ||
    nameLower.includes('casper')
  ) {
    type = 'Điều hòa';
    icon = 'snowflake';
    const temp = d.currentState?.temperature || 24;
    valueStr = `${temp}°C`;
  } else if (typeUpper.includes('GATE') || typeUpper.includes('ROLLING') || nameLower.includes('cổng')) {
    type = 'Cổng';
    icon = 'door';
  } else if (typeUpper.includes('TEMP') || typeUpper.includes('HUMID')) {
    type = 'Cảm biến';
    icon = 'thermometer';
    isSensor = true;
    const temp = d.currentState?.temperature ?? 27.7;
    valueStr = `${temp}°C`;
  } else if (typeUpper.includes('LUX') || typeUpper.includes('SUN') || typeUpper.includes('LIGHT_SENSOR')) {
    type = 'Cảm biến';
    icon = 'sun';
    isSensor = true;
    const lux = d.currentState?.lux ?? 820;
    valueStr = `${lux} lx`;
  } else if (typeUpper.includes('MOTION')) {
    type = 'Cảm biến';
    icon = 'activity';
    isSensor = true;
    valueStr = d.currentState?.motion ? 'Chuyển động' : 'Tĩnh';
  } else if (typeUpper.includes('SMOKE')) {
    type = 'Cảm biến';
    icon = 'shield';
    isSensor = true;
    valueStr = d.currentState?.smoke ? 'Cảnh báo' : 'An toàn';
  } else if (typeUpper.includes('CAMERA')) {
    type = 'Camera';
    icon = 'camera';
  } else if (nameLower.includes('bơm')) {
    type = 'Công tắc';
    icon = 'droplet';
  } else if (typeUpper.includes('LOCK') || nameLower.includes('khóa')) {
    type = 'Công tắc';
    icon = 'lock';
  } else {
    type = 'Công tắc';
    icon = 'automation';
  }

  // Construct status text
  let statusText = isOffline ? 'Ngoại tuyến' : isPowerOn ? 'Đang bật' : 'Tắt';
  if (!isOffline) {
    if (type === 'Đèn') {
      statusText = isPowerOn ? `Đang bật · ${brightness}%` : 'Đã tắt';
    } else if (type === 'Điều hòa') {
      statusText = isPowerOn ? `Lạnh · Quạt tự động` : 'Đã tắt';
    } else if (type === 'Cảm biến' && icon === 'thermometer') {
      const hum = d.currentState?.humidity ?? 61.8;
      statusText = `Độ ẩm ${hum}%`;
    } else if (type === 'Cảm biến' && icon === 'sun') {
      statusText = Number(d.currentState?.lux ?? 820) > 200 ? 'Trời sáng' : 'Trời tối';
    } else if (type === 'Cảm biến') {
      statusText = 'Bình thường';
    } else if (type === 'Cổng') {
      statusText = isPowerOn ? 'Đang mở' : 'Đã dừng';
    }
  }

  return {
    id: d.id,
    name: d.name,
    room: d.roomName || 'Phòng khách',
    roomId: d.roomId || undefined,
    type,
    icon,
    status: statusText,
    value: valueStr,
    on: isPowerOn,
    offline: isOffline,
    sensor: isSensor,
    brightness,
    raw: d,
  };
}

const FIGMA_SEED_DEVICES: UIMappedDevice[] = [
  {
    id: 'seed-1',
    name: 'Đèn ngủ',
    room: 'Phòng của quán',
    type: 'Đèn',
    icon: 'lamp',
    status: 'Đang bật · 12%',
    on: true,
    brightness: 12,
  },
  {
    id: 'seed-2',
    name: 'Điều hòa Casper',
    room: 'Phòng khách',
    type: 'Điều hòa',
    icon: 'snowflake',
    status: 'Hút ẩm · Quạt tự động',
    value: '23°C',
    on: true,
  },
  {
    id: 'seed-3',
    name: 'Cảm biến nhiệt ẩm',
    room: 'Phòng khách',
    type: 'Cảm biến',
    icon: 'thermometer',
    status: 'Độ ẩm 61.8%',
    value: '27.7°C',
    sensor: true,
  },
  {
    id: 'seed-4',
    name: 'Cảm biến ánh sáng',
    room: 'Phòng của quán',
    type: 'Cảm biến',
    icon: 'sun',
    status: 'Trời sáng',
    value: '820 lx',
    sensor: true,
  },
  {
    id: 'seed-5',
    name: 'Cảm biến chuyển động',
    room: 'Phòng khách',
    type: 'Cảm biến',
    icon: 'activity',
    status: 'Bình thường',
    value: 'Tĩnh',
    sensor: true,
  },
  {
    id: 'seed-6',
    name: 'Quạt trần',
    room: 'Phòng khách',
    type: 'Công tắc',
    icon: 'automation',
    status: 'Tắt',
    on: false,
  },
  {
    id: 'seed-7',
    name: 'Cổng chính',
    room: 'Garage',
    type: 'Cổng',
    icon: 'door',
    status: 'Đã dừng',
    on: false,
  },
  {
    id: 'seed-8',
    name: 'Máy bơm nước',
    room: 'Garden',
    type: 'Công tắc',
    icon: 'droplet',
    status: 'Tắt',
    on: false,
  },
  {
    id: 'seed-9',
    name: 'Camera sân',
    room: 'Garden',
    type: 'Camera',
    icon: 'camera',
    status: 'Ngoại tuyến',
    offline: true,
    on: false,
  },
];

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
  const items: ['on' | 'offline' | 'sensor', string, IconName][] = [
    ['on', `Đang bật (${activeCount})`, 'power'],
    ['offline', `Ngoại tuyến (${offlineCount})`, 'camera'],
    ['sensor', `Cảm biến (${sensorCount})`, 'thermometer'],
  ];

  return (
    <div className="quick-filters">
      {items.map(([key, label, icon]) => (
        <button
          key={key}
          type="button"
          className={`stat ${active === key ? 'active' : ''}`}
          onClick={() => onChange(active === key ? 'all' : key)}
        >
          <Icon name={icon} size={16} />
          {label}
        </button>
      ))}
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

function DevicesDeviceCard({
  device,
  grouped,
  onToggle,
  onOpen,
  onGateCommand,
}: {
  device: UIMappedDevice;
  grouped: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onGateCommand: (cmd: 'Mở' | 'Dừng' | 'Đóng') => void;
}) {
  const [gate, setGate] = useState('Dừng');

  return (
    <article
      className={`devices-device-card glass-g1 ${device.on ? 'on' : ''} ${
        device.offline ? 'offline' : ''
      }`}
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => event.key === 'Enter' && onOpen()}
    >
      <div className="device-top">
        <span className="device-icon">
          <Icon name={device.icon} />
        </span>
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

      {device.value && (
        <strong className="devices-value">{device.value}</strong>
      )}

      <div className="device-copy">
        <h3 title={device.name}>{device.name}</h3>
        <p>{device.status}</p>
      </div>

      {device.type === 'Đèn' && device.on && (
        <div className="brightness" aria-label={`Độ sáng ${device.brightness || 80}%`}>
          <span style={{ width: `${device.brightness || 80}%` }} />
          <b>{device.brightness || 80}%</b>
        </div>
      )}

      {device.sensor && (
        <svg
          className="sparkline"
          viewBox="0 0 120 22"
          preserveAspectRatio="none"
        >
          <path d="M1 16 20 13 37 15 54 7 70 11 88 5 103 9 119 3" />
        </svg>
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

      {!grouped && <span className="room-label">{device.room}</span>}
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
      ? ['Phòng này chưa có thiết bị', 'Các thiết bị mới được gán sẽ xuất hiện tại đây.']
      : ['Ngôi nhà chưa có thiết bị', 'Kết nối thiết bị đầu tiên để bắt đầu quản lý.'];

  return (
    <div className="devices-empty glass-g1">
      <Icon name="grid" size={38} />
      <strong>{copy[0]}</strong>
      <p>{copy[1]}</p>
      {mode === 'search' && onResetSearch && (
        <button type="button" className="secondary-button" onClick={onResetSearch}>
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

export const DevicePage: React.FC = () => {
  const { homeId } = useParams<{ homeId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.auth.user);

  // Core state
  const [rooms, setRooms] = useState<RoomResponse[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('ALL');
  const [quickFilter, setQuickFilter] = useState<'all' | 'on' | 'offline' | 'sensor'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('Tất cả');
  const [sort, setSort] = useState<string>('Nhóm theo phòng');
  const [sortOpen, setSortOpen] = useState(false);

  const [devices, setDevices] = useState<DeviceResponse[]>([]);
  const devicesRef = useRef(devices);
  devicesRef.current = devices;

  const [localPower, setLocalPower] = useState<Record<string, boolean>>({});
  const [localBrightness, setLocalBrightness] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);

  // Selected device for Detail modal/drawer
  const [selectedDevice, setSelectedDevice] = useState<UIMappedDevice | null>(null);

  // Sync homeId in Redux
  useEffect(() => {
    dispatch(currentHomeChanged(homeId ?? null));
    return () => {
      dispatch(currentHomeCleared());
    };
  }, [dispatch, homeId]);

  // Micro-batching realtime MQTT sync
  const pendingUpdatesRef = useRef<Map<string, { currentState?: Record<string, unknown>; status?: DeviceResponse['status'] }>>(new Map());
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
          currentState: patch.currentState ? { ...d.currentState, ...patch.currentState } : d.currentState,
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
        currentState: patch.currentState ? { ...prev.raw.currentState, ...patch.currentState } : prev.raw.currentState,
        status: patch.status ?? prev.raw.status,
      };
      return mapDeviceToUI(updatedRaw, localPower, localBrightness);
    });
  }, [localPower, localBrightness]);

  const handleDeviceStateChanged = useCallback((event: RealtimeEvent<any>) => {
    if (!event || event.type !== 'DEVICE_STATE_CHANGED' || !event.data) return;
    const data = event.data as { id?: string; deviceId?: string; currentState?: Record<string, unknown>; status?: string };
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
  }, [flushDeviceUpdates]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return realtimeEventDispatcher.register('DEVICE_STATE_CHANGED', handleDeviceStateChanged);
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

  const fetchDevices = useCallback(async (silent = false) => {
    if (!homeId) return;
    try {
      if (!silent) setLoading(true);
      setError('');
      const data = await getDevicesByHome(homeId);
      setDevices(data || []);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Lỗi tải danh sách thiết bị'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [homeId]);

  useEffect(() => {
    void fetchRooms();
    void fetchDevices();
  }, [fetchRooms, fetchDevices]);

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
        : dev.currentState?.power === 'ON' || dev.currentState?.power === true || dev.currentState?.power === 'true';

    const nextOn = !currentOn;
    const action = nextOn ? 'TURN_ON' : 'TURN_OFF';

    setLocalPower((prev) => ({ ...prev, [deviceId]: nextOn }));

    try {
      const result = await sendManualPowerCommand(deviceId, action);
      if (!result.command.success) {
        // Rollback
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
    const isMock = devices.length === 0;
    if (isMock) {
      const nextPowerMap: Record<string, boolean> = { ...localPower };
      FIGMA_SEED_DEVICES.filter((d) => d.type === 'Đèn').forEach((d) => {
        nextPowerMap[d.id] = false;
      });
      setLocalPower(nextPowerMap);
      notify.success('Đã tắt toàn bộ đèn');
      return;
    }

    const onLights = devices.filter((d) => {
      const isLight = (d.deviceType || '').toUpperCase().includes('LIGHT') || (d.deviceType || '').toUpperCase().includes('LED');
      if (!isLight) return false;
      const isPowerOn =
        localPower[d.id] !== undefined
          ? localPower[d.id]
          : d.currentState?.power === 'ON' || d.currentState?.power === true || d.currentState?.power === 'true';
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
      onLights.map((l) => sendManualPowerCommand(l.id, 'TURN_OFF').catch(console.warn))
    );
    notify.success('Đã tắt toàn bộ đèn');
    void fetchDevices(true);
  };

  // Gate command
  const handleGateCommand = async (deviceId: string, cmd: 'Mở' | 'Dừng' | 'Đóng') => {
    const dev = devices.find((d) => d.id === deviceId);
    if (!dev) {
      notify.success(`Đã gửi lệnh ${cmd} cổng`);
      return;
    }
    const action = cmd === 'Mở' ? 'OPEN' : cmd === 'Đóng' ? 'CLOSE' : 'STOP';
    try {
      await sendDeviceCommand(deviceId, action);
      notify.success(`Đã gửi lệnh ${cmd} cổng`);
    } catch (e) {
      notify.error(getErrorMessage(e, 'Lỗi điều khiển cổng'));
    }
  };

  // Brightness change
  const handleBrightnessChange = async (deviceId: string, brightness: number) => {
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
  const handleColorChange = async (deviceId: string, r: number, g: number, b: number) => {
    const brightness = localBrightness[deviceId] || 80;
    const dev = devices.find((d) => d.id === deviceId);
    if (!dev) return;
    try {
      await sendDeviceCommand(deviceId, 'SET_RGB', { r, g, b, brightness });
    } catch (e) {
      console.warn('Set color error:', e);
    }
  };

  // Fallback rooms matching Figma design if BE rooms are empty
  const displayRooms: RoomResponse[] = useMemo(() => {
    if (rooms.length > 0) return rooms;
    return [
      { id: 'Phòng của quán', name: 'Phòng của quán', homeId: homeId || '', createdAt: '', updatedAt: '' },
      { id: 'Phòng khách', name: 'Phòng khách', homeId: homeId || '', createdAt: '', updatedAt: '' },
      { id: 'Garage', name: 'Garage', homeId: homeId || '', createdAt: '', updatedAt: '' },
      { id: 'Garden', name: 'Garden', homeId: homeId || '', createdAt: '', updatedAt: '' },
      { id: 'Phòng bếp', name: 'Phòng bếp', homeId: homeId || '', createdAt: '', updatedAt: '' },
    ];
  }, [rooms, homeId]);

  // Map all devices to UI representation (with fallback seeds if BE has 0 devices)
  const uiDevices: UIMappedDevice[] = useMemo(() => {
    if (devices.length === 0) {
      return FIGMA_SEED_DEVICES.map((s) => {
        const isPowerOn = localPower[s.id] !== undefined ? localPower[s.id] : s.on;
        const curBrightness = localBrightness[s.id] !== undefined ? localBrightness[s.id] : s.brightness;
        let statusText = s.status;
        if (s.type === 'Đèn') {
          statusText = isPowerOn ? `Đang bật · ${curBrightness ?? 80}%` : 'Đã tắt';
        } else if (s.type === 'Công tắc') {
          statusText = isPowerOn ? 'Đang bật' : 'Tắt';
        }
        return {
          ...s,
          on: isPowerOn,
          brightness: curBrightness,
          status: statusText,
        };
      });
    }
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

  // Grouped devices
  const groups = useMemo(() => {
    const map: Record<string, UIMappedDevice[]> = {};
    visibleDevices.forEach((d) => {
      const key = sort === 'Nhóm theo loại' ? d.type : d.room;
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return map;
  }, [visibleDevices, sort]);

  const userInitial = currentUser?.fullName
    ? currentUser.fullName.trim().split(' ').slice(-1)[0]?.charAt(0).toUpperCase() || 'M'
    : 'M';

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

        {/* Actions Row */}
        <div className="devices-actions">
          <RoomFilterStrip
            rooms={displayRooms}
            activeRoom={selectedRoomId}
            totalCount={uiDevices.length}
            roomCounts={roomCounts}
            onChange={setSelectedRoomId}
          />

          <div className="devices-tools">
            <div className="sort-wrap">
              <IconButton
                icon="automation"
                label="Sắp xếp"
                onClick={() => setSortOpen(!sortOpen)}
              />
              {sortOpen && (
                <div className="sort-popover glass-g2">
                  {[
                    'Nhóm theo phòng',
                    'Nhóm theo loại',
                    'Tên A–Z',
                    'Trạng thái (đang bật trước)',
                    'Gần đây nhất',
                  ].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setSort(item);
                        setSortOpen(false);
                      }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <label className="type-filter">
              Loại:{' '}
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
              >
                <option>Tất cả</option>
                <option>Đèn</option>
                <option>Điều hòa</option>
                <option>Cảm biến</option>
                <option>Cổng</option>
                <option>Công tắc</option>
                <option>Camera</option>
              </select>
            </label>

            <button
              type="button"
              className="add-device"
              onClick={() => setIsAddModalOpen(true)}
            >
              + Thêm thiết bị
            </button>
          </div>
        </div>

        {/* Quick Filters */}
        <QuickFilters
          active={quickFilter}
          activeCount={activeCount}
          offlineCount={offlineCount}
          sensorCount={sensorCount}
          lightsOnCount={lightsOnCount}
          onChange={setQuickFilter}
          onTurnOffAllLights={handleTurnOffAllLights}
        />

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
                  <small>{list.length} thiết bị</small>
                </div>
                <div className="devices-grid">
                  {list.map((device) => (
                    <DevicesDeviceCard
                      key={device.id}
                      device={device}
                      grouped={sort.startsWith('Nhóm')}
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
          onDeviceUpdated={() => {
            void fetchDevices(true);
            setSelectedDevice(null);
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
