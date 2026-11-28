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
  Search,
  X,
} from 'lucide-react';
import { Icon } from '../home/HomeIcons';
import { DashboardNavRail } from '../home/DashboardNavRail';
import { DashboardBottomNav } from '../home/DashboardBottomNav';
import { AutomationTopBar } from '../automation/AutomationTopBar';
import { DeviceFilterDropdown, DeviceMobileFilterModal } from './DeviceFilterDropdown';
import { AddDeviceModal } from './AddDeviceModal';
import { RoomManagementModal } from './RoomManagementModal';
import { DeviceDetailModal } from './DeviceDetailModal';
import { DeviceVisual } from './DeviceVisual';
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
import { peekCache, invalidateCache } from '../../services/queryCache';
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
import { DevicePowerSprite } from './DevicePowerSprite';
import { powerSpriteKind } from './powerSprite';
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
import {
  APERTURE_TRANSIT_LOCK_MS,
  getApertureInterlock,
  isRgbLightDevice,
  resolveDeviceRgb,
  isFanDevice,
  isTvDevice,
  extractSensorMetrics,
  resolveFanSpeedLevel,
  normalizeSensorReadingPatch,
  AC_MODE_CODE_TO_LABEL,
} from './deviceHelpers';
import './devices-page.css';

// Re-export interface and helper to maintain backwards compatibility
export type { UIMappedDevice } from './devicePageHelpers';
export { mapDeviceToUI } from './devicePageHelpers';

export function normalizeSearchText(value: string): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

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
          className={`h-9 px-4 rounded-full text-xs shrink-0 inline-flex items-center gap-1.5 transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] ${
            activeRoom === 'ALL'
              ? 'bg-[#2563eb] text-white border border-[#1d4ed8] shadow-xs font-semibold'
              : 'bg-white border border-[#94a3b8]/75 text-[#0f172a] font-medium shadow-2xs hover:border-[#2563eb]/65 hover:bg-[#eff6ff] hover:text-[#1d4ed8]'
          } ${totalCount === 0 ? 'opacity-65' : ''}`}
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
              className={`h-9 px-4 rounded-full text-xs shrink-0 inline-flex items-center gap-1.5 transition-colors cursor-pointer max-w-[200px] select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] ${
                isSelected
                  ? 'bg-[#2563eb] text-white border border-[#1d4ed8] shadow-xs font-semibold'
                  : 'bg-white border border-[#94a3b8]/75 text-[#0f172a] font-medium shadow-2xs hover:border-[#2563eb]/65 hover:bg-[#eff6ff] hover:text-[#1d4ed8]'
              } ${count === 0 ? 'opacity-65' : ''}`}
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
        className={`h-9 px-3.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] ${
          active === 'on'
            ? 'bg-[#2563eb] text-white border border-[#1d4ed8] shadow-xs'
            : 'bg-white border border-[#3b82f6]/55 text-[#0f172a] shadow-2xs hover:bg-[#eff6ff] hover:border-[#2563eb]'
        }`}
        onClick={() => onChange(active === 'on' ? 'all' : 'on')}
      >
        <Power className={`w-3.5 h-3.5 shrink-0 ${active === 'on' ? 'text-white' : 'text-[#2563eb]'}`} />
        <span>Đang bật ({activeCount})</span>
      </button>

      <button
        type="button"
        className={`h-9 px-3.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#475569] ${
          active === 'offline'
            ? 'bg-[#475569] text-white border border-[#334155] shadow-xs'
            : 'bg-white border border-[#94a3b8]/75 text-[#0f172a] shadow-2xs hover:bg-[#f1f5f9] hover:border-[#64748b]'
        }`}
        onClick={() => onChange(active === 'offline' ? 'all' : 'offline')}
      >
        <WifiOff className={`w-3.5 h-3.5 shrink-0 ${active === 'offline' ? 'text-white' : 'text-[#64748b]'}`} />
        <span>Ngoại tuyến ({offlineCount})</span>
      </button>

      <button
        type="button"
        className={`h-9 px-3.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] ${
          active === 'sensor'
            ? 'bg-[#059669] text-white border border-[#047857] shadow-xs'
            : 'bg-white border border-[#10b981]/55 text-[#0f172a] shadow-2xs hover:bg-[#ecfdf5] hover:border-[#059669]'
        }`}
        onClick={() => onChange(active === 'sensor' ? 'all' : 'sensor')}
      >
        <Thermometer className={`w-3.5 h-3.5 shrink-0 ${active === 'sensor' ? 'text-white' : 'text-[#059669]'}`} />
        <span>Cảm biến ({sensorCount})</span>
      </button>

      {active === 'on' && lightsOnCount > 0 && (
        <button
          type="button"
          className="h-9 px-3.5 rounded-full border border-[#f59e0b]/65 bg-white text-[#b45309] hover:bg-[#fffbeb] text-xs font-semibold shadow-2xs inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d97706]"
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
  const [transitLocked, setTransitLocked] = useState(false);
  const transitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (rawGateState !== prevRawGateState) {
    setPrevRawGateState(rawGateState);
    setGate(resolveGateLabel(rawGateState));
    const upper = String(rawGateState ?? '').trim().toUpperCase();
    if (upper === 'OPEN' || upper === 'CLOSED' || upper === 'STOPPED') {
      if (transitTimerRef.current) {
        clearTimeout(transitTimerRef.current);
        transitTimerRef.current = null;
      }
      setTransitLocked(false);
    }
  }

  useEffect(() => () => {
    if (transitTimerRef.current) clearTimeout(transitTimerRef.current);
  }, []);

  const gateInterlock = getApertureInterlock(rawGateState, transitLocked);

  const { isOverrideActive, formattedTime } = useOverrideCountdown(
    device.manualOverrideUntil
  );
  const isViewOnly = device.accessLevel === 'VIEW' || device.raw?.accessLevel === 'VIEW';

  const colorClass = getDeviceTypeColorClass(device.type);
  const isRgbLight = isRgbLightDevice(device.raw);
  const rawState = device.raw?.currentState;
  const resolvedRgb = isRgbLight ? resolveDeviceRgb(rawState) : undefined;
  const rgbHex = isRgbLight
    ? resolvedRgb
      ? `rgb(${resolvedRgb.r}, ${resolvedRgb.g}, ${resolvedRgb.b})`
      : (typeof rawState?.rgbHex === 'string' ? rawState.rgbHex : undefined)
    : undefined;
  const spriteKind = powerSpriteKind(device.raw?.deviceType ?? '', device.name);
  const isPowerDevice =
    !device.sensor && device.type !== 'Cảm biến' && device.type !== 'Camera';
  const showKwh = isPowerDevice && !device.offline && (kwhToday ?? 0) > 0;
  const lastSeenText = formatLastSeenVi(device.raw?.lastSeen || device.raw?.updatedAt);
  const bLevel = device.brightness ?? 80;
  const cardAmbientBg =
    device.on && !device.offline
      ? isRgbLight && rgbHex
        ? `radial-gradient(circle at 50% 46%, color-mix(in srgb, ${rgbHex} 16%, transparent) 0%, transparent 62%)`
        : device.type === 'Đèn'
          ? `radial-gradient(circle at 50% 46%, rgba(251, 191, 36, ${(0.1 + (bLevel / 100) * 0.1).toFixed(2)}) 0%, transparent 62%)`
          : undefined
      : undefined;

  return (
    <article
      className={`devices-device-card glass-g1 ${device.on ? 'on' : ''} ${
        device.offline ? 'offline' : ''
      }`}
      style={cardAmbientBg ? { backgroundImage: cardAmbientBg } : undefined}
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
        <div className="device-copy device-card-header-copy">
          <h3 title={device.name}>{device.name}</h3>
          {!device.offline && device.status !== 'Ngoại tuyến' && (
            <p>{device.status}</p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isRgbLight && rgbHex && (
            <span
              data-rgb-indicator="true"
              className="w-3 h-3 rounded-full border border-white/60 shadow-xs shrink-0"
              style={{ backgroundColor: rgbHex }}
              title={`Màu RGB: ${rgbHex}`}
            />
          )}
          {isViewOnly && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              Chỉ xem
            </span>
          )}
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
          {isViewOnly && !device.offline && !device.sensor && device.type !== 'Cổng' ? (
            <button
              type="button"
              disabled
              className={`toggle ${device.on ? 'active' : ''} opacity-40 cursor-not-allowed`}
              title="Thiết bị ở chế độ chỉ xem"
              onClick={(event) => {
                event.stopPropagation();
              }}
              aria-disabled="true"
              aria-label={`${device.name} (Chỉ xem)`}
            >
              <span />
            </button>
          ) : !device.offline && !device.sensor && device.type !== 'Cổng' ? (
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

      <div className="device-visual-center">
        <div className="icon-tile-wrap">
          <span
            className={`device-icon device-visual-tile type-${colorClass}${spriteKind ? ' has-sprite' : ''}`}
            style={
              isRgbLight && device.on && !device.offline && rgbHex
                ? {
                    background: `color-mix(in srgb, ${rgbHex} 18%, transparent)`,
                    boxShadow: `0 0 22px color-mix(in srgb, ${rgbHex} 48%, transparent)`,
                  }
                : undefined
            }
          >
            {spriteKind ? (
              <DevicePowerSprite kind={spriteKind} on={!!device.on && !device.offline} />
            ) : (
            <DeviceVisual
              uid={`page-${device.id}`}
              deviceType={device.raw?.deviceType}
              figmaType={device.type}
              name={device.name}
              icon={device.icon}
              isOn={Boolean(device.on)}
              offline={device.offline}
              brightness={bLevel}
              fanSpeed={resolveFanSpeedLevel(rawState)}
              rgbColor={isRgbLight ? rgbHex : undefined}
              acMode={typeof rawState?.mode === 'string' ? rawState.mode : undefined}
              gateState={typeof rawState?.state === 'string' ? rawState.state : undefined}
              sensorState={rawState}
              size={82}
            />
            )}
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
      </div>

      {device.type === 'Cảm biến' && device.value && (
        <strong className="devices-value text-center">{device.value}</strong>
      )}

      {device.type === 'Cổng' && (
        <div className="gate-controls">
          {(['Mở', 'Dừng', 'Đóng'] as const).map((item) => {
            const itemLocked =
              (item === 'Mở' && gateInterlock.disableOpen) ||
              (item === 'Đóng' && gateInterlock.disableClose) ||
              (item === 'Dừng' && gateInterlock.disableStop);
            const isItemDisabled = Boolean(device.offline || isViewOnly || itemLocked);
            return (
              <button
                type="button"
                key={item}
                disabled={isItemDisabled}
                className={`${gate === item ? 'active' : ''} ${isItemDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                onClick={(event) => {
                  event.stopPropagation();
                  if (isItemDisabled) return;
                  if (item === 'Dừng') {
                    if (transitTimerRef.current) {
                      clearTimeout(transitTimerRef.current);
                      transitTimerRef.current = null;
                    }
                    setTransitLocked(false);
                  } else {
                    if (transitTimerRef.current) clearTimeout(transitTimerRef.current);
                    setTransitLocked(true);
                    transitTimerRef.current = setTimeout(() => {
                      setTransitLocked(false);
                      transitTimerRef.current = null;
                    }, APERTURE_TRANSIT_LOCK_MS);
                  }
                  setGate(item);
                  onGateCommand(item);
                }}
              >
                {item}
              </button>
            );
          })}
        </div>
      )}

      {isFanDevice(device.raw) && device.on && resolveFanSpeedLevel(rawState) > 0 && (
        <div className="flex items-center justify-center w-full pt-2 mt-2 border-t border-[var(--border)]">
          <span className="px-2.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/35 text-[11px] font-semibold text-[#0f172a]">
            Mức {resolveFanSpeedLevel(rawState)}
          </span>
        </div>
      )}

      {isTvDevice(device.raw) && device.on && (
        <div className="flex items-center justify-center w-full pt-2 mt-2 border-t border-[var(--border)]">
          <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/35 text-[11px] font-semibold text-[#0f172a]">
            {rawState?.muted
              ? 'Tắt tiếng'
              : rawState?.channel !== undefined
                ? `Kênh ${rawState.channel}`
                : 'Đang bật'}
          </span>
        </div>
      )}

      {device.type === 'Điều hòa' && (
        <div className="flex items-center justify-center gap-1.5 w-full pt-2 mt-2 border-t border-[var(--border)]">
          <strong className="text-sm font-extrabold text-[#0f172a] tabular-nums">
            {rawState?.temperature !== undefined ? `${rawState.temperature}°C` : '24°C'}
          </strong>
          <span className="px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/35 text-[10px] font-semibold text-sky-700">
            {AC_MODE_CODE_TO_LABEL[String(rawState?.mode ?? 'COOL').toUpperCase()] ?? 'Lạnh'}
          </span>
        </div>
      )}

      {device.type === 'Cảm biến' && (() => {
        const sm = extractSensorMetrics(rawState);
        const badges: string[] = [];
        if (sm.temperature !== undefined) badges.push(`${sm.temperature}°C`);
        if (sm.humidity !== undefined) badges.push(`${sm.humidity}%`);
        if (sm.lux !== undefined) badges.push(`${sm.lux} lx`);
        else if (sm.lightBinary !== undefined) badges.push(sm.lightBinary ? 'Sáng' : 'Tối');
        if (sm.motion !== undefined) badges.push(sm.motion ? 'Chuyển động' : 'Tĩnh');
        if (sm.gasPpm !== undefined) badges.push(`${sm.gasPpm} ppm`);
        if (sm.flame !== undefined) badges.push(sm.flame ? 'Có lửa!' : 'An toàn');
        const extraBadges = badges.filter((b) => b !== device.value);
        if (extraBadges.length === 0) return null;
        return (
          <div className="flex flex-wrap items-center justify-center gap-1 w-full pt-2 mt-2 border-t border-[var(--border)]">
            {extraBadges.map((b) => (
              <span
                key={b}
                className="px-2 py-0.5 rounded-md bg-white border border-[#cbd5e1] text-[10px] font-semibold text-[#0f172a]"
              >
                {b}
              </span>
            ))}
          </div>
        );
      })()}

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
            lastSeenText && lastSeenText !== 'Chưa có dữ liệu' ? (
              <span className="footer-time">
                <Clock size={11} className="inline mr-1" />
                {lastSeenText}
              </span>
            ) : null
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

    // Clear optimistic local overrides for devices that just received authoritative realtime state
    setLocalPower((prev) => {
      let changed = false;
      const next = { ...prev };
      updates.forEach((patch, id) => {
        if (patch.currentState && patch.currentState.power !== undefined && id in next) {
          delete next[id];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    setLocalBrightness((prev) => {
      let changed = false;
      const next = { ...prev };
      updates.forEach((patch, id) => {
        if (patch.currentState && patch.currentState.brightness !== undefined && id in next) {
          delete next[id];
          changed = true;
        }
      });
      return changed ? next : prev;
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
    const unregState = realtimeEventDispatcher.register(
      'DEVICE_STATE_CHANGED',
      handleDeviceStateChanged
    );
    const unregSensor = realtimeEventDispatcher.register<{
      deviceId?: string;
      metricType?: string;
      value?: unknown;
      recordedAt?: string;
    }>('SENSOR_READING_UPDATED', (event) => {
      if (!event || !event.data) return;
      const targetId = event.deviceId || event.data.deviceId;
      if (!targetId || !event.data.metricType) return;
      const patch = normalizeSensorReadingPatch(event.data.metricType, event.data.value);
      if (Object.keys(patch).length === 0) return;

      const existing = pendingUpdatesRef.current.get(targetId);
      pendingUpdatesRef.current.set(targetId, {
        currentState: {
          ...(existing?.currentState ?? {}),
          ...patch,
        },
        status: 'ONLINE',
        lastSeen: event.data.recordedAt ?? event.timestamp ?? existing?.lastSeen,
      });
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(flushDeviceUpdates);
      }
    });
    return () => {
      unregState();
      unregSensor();
    };
  }, [handleDeviceStateChanged, flushDeviceUpdates]);

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
        setLocalPower({});
        setLocalBrightness({});
        void fetchEnergy();
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Lỗi tải danh sách thiết bị'));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [homeId, fetchEnergy]
  );

  // Refetch rooms and devices immediately whenever Owner changes this member's access
  useEffect(() => {
    return realtimeEventDispatcher.register('MEMBER_ACCESS_UPDATED', (event) => {
      if (event.homeId && homeId && event.homeId !== homeId) return;
      invalidateCache('devices:home:');
      void fetchRooms();
      void fetchDevices(true);
    });
  }, [homeId, fetchRooms, fetchDevices]);

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
    if (!dev || dev.status !== 'ONLINE') return;

    if (dev.accessLevel === 'VIEW') {
      notify.warning('Bạn chỉ có quyền xem thiết bị này');
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
      if (d.status !== 'ONLINE') return false;
      if (d.accessLevel === 'VIEW' || d.accessLevel === 'NONE') return false;
      const typeUpper = (d.deviceType || '').toUpperCase();
      const isLight =
        (typeUpper.includes('LIGHT') && !typeUpper.includes('SENSOR')) ||
        typeUpper.includes('LED');
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
      notify.info('Không có đèn nào đang bật hoặc bạn không có quyền điều khiển');
      return;
    }

    notify.info(`Đang tắt ${onLights.length} đèn...`);
    const prevPowerSnapshot: Record<string, boolean | undefined> = {};
    const nextPowerMap: Record<string, boolean> = { ...localPower };
    onLights.forEach((l) => {
      prevPowerSnapshot[l.id] = localPower[l.id];
      nextPowerMap[l.id] = false;
    });
    setLocalPower(nextPowerMap);

    const results = await Promise.allSettled(
      onLights.map((l) => sendManualPowerCommand(l.id, 'TURN_OFF'))
    );

    let succeeded = 0;
    let failed = 0;
    const failedIds: string[] = [];

    results.forEach((res, idx) => {
      if (res.status === 'fulfilled' && res.value?.command?.success !== false) {
        succeeded += 1;
      } else {
        failed += 1;
        failedIds.push(onLights[idx].id);
      }
    });

    if (failedIds.length > 0) {
      setLocalPower((prev) => {
        const next = { ...prev };
        failedIds.forEach((id) => {
          const prevVal = prevPowerSnapshot[id];
          if (prevVal === undefined) {
            delete next[id];
          } else {
            next[id] = prevVal;
          }
        });
        return next;
      });
    }

    if (failed === 0 && succeeded > 0) {
      notify.success('Đã tắt toàn bộ đèn');
    } else if (succeeded > 0 && failed > 0) {
      notify.warning(`Đã tắt ${succeeded}/${onLights.length} đèn, ${failed} đèn thất bại`);
    } else {
      notify.error('Không thể tắt đèn');
    }

    void fetchDevices(true);
  };

  // Gate command
  const handleGateCommand = async (
    deviceId: string,
    cmd: 'Mở' | 'Dừng' | 'Đóng'
  ) => {
    const dev = devices.find((d) => d.id === deviceId);
    if (!dev || dev.status !== 'ONLINE') return;
    if (dev.accessLevel === 'VIEW') {
      notify.warning('Bạn chỉ có quyền xem thiết bị này');
      return;
    }
    const action = cmd === 'Mở' ? 'OPEN' : cmd === 'Đóng' ? 'CLOSE' : 'STOP';
    const interlock = getApertureInterlock(dev.currentState?.state);
    if ((action === 'OPEN' && interlock.disableOpen) || (action === 'CLOSE' && interlock.disableClose) || (action === 'STOP' && interlock.disableStop)) {
      return;
    }
    try {
      const command = await sendDeviceCommand(deviceId, action);
      if (command && command.success === false) {
        notify.error(command.message || `Không thể gửi lệnh ${cmd} ${dev.name}`);
        return;
      }
      const nextState = action === 'OPEN' ? 'OPENING' : action === 'CLOSE' ? 'CLOSING' : 'STOPPED';
      setDevices((prev) =>
        prev.map((d) =>
          d.id === deviceId
            ? { ...d, currentState: { ...d.currentState, state: nextState } }
            : d
        )
      );
      notify.success(`Đã gửi lệnh ${cmd} ${dev.name}`);
    } catch (e) {
      notify.error(getErrorMessage(e, `Lỗi điều khiển ${dev.name}`));
    }
  };

  // Brightness change
  const handleBrightnessChange = async (
    deviceId: string,
    brightness: number
  ) => {
    const dev = devices.find((d) => d.id === deviceId);
    if (!dev || dev.status !== 'ONLINE') return;
    if (dev.accessLevel === 'VIEW') return;
    const prevBrightness = localBrightness[deviceId];
    setLocalBrightness((prev) => ({ ...prev, [deviceId]: brightness }));
    try {
      await sendDeviceCommand(deviceId, 'SET_BRIGHTNESS', { brightness });
    } catch (e) {
      setLocalBrightness((prev) => {
        const next = { ...prev };
        if (prevBrightness === undefined) {
          delete next[deviceId];
        } else {
          next[deviceId] = prevBrightness;
        }
        return next;
      });
      notify.error(getErrorMessage(e, 'Lỗi khi chỉnh độ sáng'));
    }
  };

  // Color change
  const handleColorChange = async (
    deviceId: string,
    r: number,
    g: number,
    b: number
  ) => {
    const dev = devices.find((d) => d.id === deviceId);
    if (!dev || dev.status !== 'ONLINE') return;
    if (dev.accessLevel === 'VIEW') return;
    if (!isRgbLightDevice(dev)) return;
    const brightness = localBrightness[deviceId] || 80;
    try {
      const command = await sendDeviceCommand(deviceId, 'SET_RGB', { r, g, b, brightness });
      if (command && command.success === false) {
        notify.error(command.message || 'Lỗi khi đổi màu đèn');
        return;
      }
      const colorPatch = { r, g, b, color: { r, g, b }, ...(command?.acknowledgedState ?? {}) };
      setDevices((prev) =>
        prev.map((d) =>
          d.id === deviceId
            ? { ...d, currentState: { ...d.currentState, ...colorPatch } }
            : d
        )
      );
      setSelectedDevice((prev) =>
        prev && prev.id === deviceId && prev.raw
          ? mapDeviceToUI(
              { ...prev.raw, currentState: { ...prev.raw.currentState, ...colorPatch } },
              localPower,
              localBrightness
            )
          : prev
      );
    } catch (e) {
      notify.error(getErrorMessage(e, 'Lỗi khi đổi màu đèn'));
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
      if (device.accessLevel === 'NONE' || device.raw?.accessLevel === 'NONE') return false;
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
      if (quickFilter === 'on' && (device.offline || !device.on)) return false;
      if (quickFilter === 'offline' && !device.offline) return false;
      if (quickFilter === 'sensor' && !device.sensor) return false;
      // Search query
      const q = normalizeSearchText(searchQuery);
      if (q) {
        const matchName = normalizeSearchText(device.name).includes(q);
        const matchRoom = normalizeSearchText(device.room).includes(q);
        const matchType = normalizeSearchText(device.type).includes(q);
        const matchRawType = normalizeSearchText(device.raw?.deviceType ?? '').includes(q);
        const matchModel = normalizeSearchText(device.raw?.model ?? '').includes(q);
        if (!matchName && !matchRoom && !matchType && !matchRawType && !matchModel) {
          return false;
        }
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
              className="sm:hidden h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-full bg-white border border-[#94a3b8]/75 text-[#0f172a] shadow-2xs hover:bg-[#f8fafc] hover:border-[#475569] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
              onClick={() => setIsRoomModalOpen(true)}
              title="Quản lý phòng"
              aria-label="Quản lý phòng"
            >
              <Settings2 className="w-4 h-4 text-[#475569]" />
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Desktop Quản lý phòng ghost button */}
            <button
              type="button"
              className="hidden sm:inline-flex h-9 px-3.5 rounded-full bg-white border border-[#94a3b8]/75 hover:bg-[#f8fafc] hover:border-[#475569] text-xs font-semibold text-[#0f172a] shadow-2xs items-center gap-1.5 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
              onClick={() => setIsRoomModalOpen(true)}
              title="Quản lý danh sách phòng"
              aria-label="Quản lý danh sách phòng"
            >
              <Settings2 className="w-4 h-4 text-[#475569] shrink-0" />
              <span>Quản lý phòng</span>
            </button>

            {/* Exactly ONE Primary Button on the screen */}
            <button
              type="button"
              className="w-full sm:w-auto h-9 px-4 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] border border-[#1d4ed8] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <QuickFilters
            active={quickFilter}
            activeCount={activeCount}
            offlineCount={offlineCount}
            sensorCount={sensorCount}
            lightsOnCount={lightsOnCount}
            onChange={setQuickFilter}
            onTurnOffAllLights={handleTurnOffAllLights}
          />

          <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
            <Search className="w-4 h-4 text-[#475569] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && searchQuery) setSearchQuery('');
              }}
              placeholder="Tìm thiết bị theo tên, phòng, loại..."
              aria-label="Tìm thiết bị"
              className="w-full h-9 pl-9 pr-8 rounded-full border border-[#94a3b8]/80 bg-white text-xs font-medium text-[#0f172a] placeholder:text-[#64748b] shadow-2xs focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Xóa tìm kiếm"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#0f172a] p-0.5 rounded-full cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {/* Desktop / Tablet: 2 Ghost Dropdowns */}
            <div className="hidden sm:flex items-center gap-2">
              <DeviceFilterDropdown
                labelPrefix="Loại"
                value={typeFilter}
                options={DEVICE_TYPE_FILTER_OPTIONS}
                onChange={setTypeFilter}
                icon={<Filter className="w-3.5 h-3.5 text-[#475569] shrink-0" />}
              />
              <DeviceFilterDropdown
                labelPrefix="Sắp xếp"
                value={sort}
                options={SORT_OPTIONS}
                onChange={setSort}
                icon={<ArrowUpDown className="w-3.5 h-3.5 text-[#475569] shrink-0" />}
              />
            </div>

            {/* Mobile: Single "Bộ lọc" icon button */}
            <button
              type="button"
              onClick={() => setMobileFilterOpen(true)}
              className="sm:hidden h-9 px-3 rounded-xl border border-[#94a3b8]/80 bg-white hover:bg-[#f8fafc] text-xs font-semibold text-[#0f172a] shadow-2xs inline-flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
              aria-label="Bộ lọc và sắp xếp"
            >
              <Filter className="w-3.5 h-3.5 text-[#475569]" />
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
          onColorChange={
            isRgbLightDevice(selectedDevice.raw)
              ? (r, g, b) => handleColorChange(selectedDevice.id, r, g, b)
              : undefined
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
