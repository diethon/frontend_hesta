import React from 'react';
import {
  Power,
  Zap,
  Clock,
  Lock,
  RotateCw,
  AlertTriangle,
  WifiOff,
  Pencil,
} from 'lucide-react';
import { Icon, type IconName } from '../../home/HomeIcons';
import type { FigmaDeviceType, DetailDeviceInput } from './detailTypes';
import { formatRelativeTime } from './detailTypes';
import { notify } from '../../ui/notify';

export interface DetailHeroProps {
  device: DetailDeviceInput;
  resolvedType: FigmaDeviceType;
  disabled: boolean;
  isOn: boolean;
  onTogglePower?: () => void;
  lightLevel?: number;
  acTemp?: number;
  acMode?: string;
  gateState?: string;
  wattage?: number;
  energyKwh?: number;
  energyCostVnd?: number;
  onEditWattage?: () => void;
  // Banner props
  isOverrideActive: boolean;
  formattedTime: string;
  onResumeAutomation: () => void;
  onExtendAutomation: (hours?: number) => void;
  isResumingAutomation: boolean;
  isExtendingAutomation: boolean;
  isOutOfSync: boolean;
  deltaKeysCount: number;
  onReconcileShadow: () => void;
  isReconcilingShadow: boolean;
}

export const DetailHero: React.FC<DetailHeroProps> = ({
  device,
  resolvedType,
  disabled,
  isOn,
  onTogglePower,
  lightLevel,
  acTemp,
  acMode,
  gateState,
  wattage,
  energyKwh,
  energyCostVnd,
  onEditWattage,
  isOverrideActive,
  formattedTime,
  onResumeAutomation,
  onExtendAutomation,
  isResumingAutomation,
  isExtendingAutomation,
  isOutOfSync,
  deltaKeysCount,
  onReconcileShadow,
  isReconcilingShadow,
}) => {
  // 1. Icon configuration
  const devName = (device?.name || '').toLowerCase();
  let iconName: IconName;
  let typeClass: string;
  let powerColorClass = 'indigo-power';

  switch (resolvedType) {
    case 'Đèn':
      iconName = 'lamp';
      typeClass = 'type-den';
      powerColorClass = 'amber-power';
      break;
    case 'Điều hòa':
      iconName = 'snowflake';
      typeClass = 'type-dieu-hoa';
      powerColorClass = 'sky-power';
      break;
    case 'Cảm biến':
      iconName = 'thermometer';
      typeClass = 'type-cam-bien';
      break;
    case 'Cổng':
      iconName = 'door';
      typeClass = 'type-cong';
      break;
    case 'Camera':
      iconName = 'camera';
      typeClass = 'type-camera';
      break;
    case 'Công tắc':
    default:
      iconName =
        device?.icon && device.icon !== 'lamp'
          ? device.icon
          : devName.includes('bơm') || devName.includes('pump')
          ? 'droplet'
          : devName.includes('khóa')
          ? 'lock'
          : 'automation';
      typeClass = 'type-cong-tac';
      powerColorClass = 'indigo-power';
      break;
  }

  // 2. Primary Readout
  let primaryReadout: string;
  let subtitle: string;

  if (resolvedType === 'Đèn') {
    primaryReadout = isOn ? `Bật · ${lightLevel ?? 80}%` : 'Tắt';
    subtitle = isOn ? 'Đang hoạt động' : 'Chạm nút nguồn để bật';
  } else if (resolvedType === 'Điều hòa') {
    primaryReadout = isOn ? `${acTemp ?? 24}°C · ${acMode || 'Lạnh'}` : 'Đang tắt';
    subtitle = isOn ? 'Điều hòa đang làm mát' : 'Chạm nút nguồn để khởi động';
  } else if (resolvedType === 'Cảm biến') {
    const rawVal =
      (typeof device?.sensor === 'string' ? device.sensor : null) ||
      device?.value ||
      (device?.raw?.currentState?.temperature
        ? `${device.raw.currentState.temperature}°C`
        : device?.currentState?.temperature
        ? `${device.currentState.temperature}°C`
        : null);
    primaryReadout = rawVal || (disabled ? 'Ngoại tuyến' : 'Bình thường');
    subtitle = device?.status || (disabled ? 'Mất tín hiệu' : 'Hoạt động ổn định');
  } else if (resolvedType === 'Cổng') {
    primaryReadout =
      gateState === 'Mở'
        ? 'Đang mở'
        : gateState === 'Đóng'
        ? 'Đã đóng'
        : 'Dừng';
    subtitle = 'Cổng tự động HESTA';
  } else if (resolvedType === 'Camera') {
    primaryReadout = disabled ? 'Ngoại tuyến' : 'Sẵn sàng';
    subtitle = disabled ? 'Không nhận tín hiệu hình ảnh' : 'Đang kết nối luồng HD';
  } else {
    // Công tắc
    primaryReadout = isOn ? 'Bật' : 'Tắt';
    subtitle = isOn ? 'Đang cấp điện' : 'Đang ngắt điện';
  }

  const isToggleable = ['Đèn', 'Điều hòa', 'Công tắc'].includes(resolvedType);

  // Chips
  const isPowerDevice = ['Đèn', 'Điều hòa', 'Công tắc'].includes(resolvedType);
  const lastSeenStr = device?.raw?.lastSeen || device?.raw?.updatedAt || device?.lastSeen;
  const relativeTime = formatRelativeTime(lastSeenStr);

  return (
    <section className="detail-hero-section">
      <div className="detail-hero-main">
        <div className="detail-hero-left">
          {/* Tinted icon tile with glow */}
          <div
            className={`detail-hero-icon-tile ${typeClass} ${isOn && !disabled ? 'glowing' : ''}`}
            aria-hidden="true"
          >
            <Icon name={iconName} size={28} />
          </div>

          {/* Primary Readout */}
          <div className="detail-hero-info">
            <h2 className="detail-hero-readout">{primaryReadout}</h2>
            <span className="detail-hero-subtitle">{subtitle}</span>
          </div>
        </div>

        {/* Big Round Power Button for toggleable types */}
        {isToggleable && (
          <button
            type="button"
            disabled={disabled}
            onClick={onTogglePower}
            className={`detail-hero-power-btn ${isOn ? `on ${powerColorClass}` : ''}`}
            aria-label={isOn ? 'Tắt thiết bị' : 'Bật thiết bị'}
            title={disabled ? 'Thiết bị ngoại tuyến' : isOn ? 'Tắt thiết bị' : 'Bật thiết bị'}
          >
            <Power className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Chips */}
      <div className="detail-hero-chips">
        {wattage !== undefined && wattage > 0 && (
          <button
            type="button"
            onClick={onEditWattage}
            className="detail-hero-chip accent-chip cursor-pointer hover:opacity-85 transition-opacity"
            title="Nhấp để chỉnh sửa công suất tiêu thụ định mức"
          >
            <Zap className="w-3 h-3" />
            <span>{isPowerDevice ? `~${wattage} W khi bật` : `Định mức ${wattage} W`}</span>
            <Pencil className="w-2.5 h-2.5 opacity-70 ml-0.5" />
          </button>
        )}

        {isPowerDevice && energyKwh !== undefined && (
          <span className="detail-hero-chip" title="Năng lượng tiêu thụ và ước tính tiền điện">
            <span>
              {energyKwh.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} kWh
              {energyCostVnd !== undefined
                ? ` · ${energyCostVnd.toLocaleString('vi-VN')} đ`
                : ''}
            </span>
          </span>
        )}

        <span className="detail-hero-chip" title="Thời gian nhận tín hiệu gần nhất">
          {disabled || device?.offline ? (
            <>
              <WifiOff className="w-3 h-3 text-offline" />
              <span className="text-offline">Ngoại tuyến{relativeTime !== 'Chưa có dữ liệu' ? ` · ${relativeTime}` : ''}</span>
            </>
          ) : (
            <>
              <Clock className="w-3 h-3" />
              <span>{relativeTime}</span>
            </>
          )}
        </span>
      </div>

      {/* Action Banners below Hero */}
      <div className="detail-banners-wrap">
        {/* 1. Manual Override Active Banner */}
        {isOverrideActive && (
          <div className="detail-banner-card override-banner animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Lock className="w-3.5 h-3.5" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <strong className="font-bold text-xs">Ghi đè thủ công</strong>
                  <span className="px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-900 dark:text-amber-200 font-mono font-bold text-[10px]">
                    {formattedTime}
                  </span>
                </div>
                <span className="text-[10px] opacity-90 block truncate">
                  Ưu tiên thủ công · Tạm ngưng kịch bản tự động
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                disabled={isExtendingAutomation}
                onClick={() => onExtendAutomation(0.5)}
                className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 font-bold transition text-[11px] cursor-pointer disabled:opacity-50"
                title="Gia hạn thêm 30 phút"
              >
                +30p
              </button>
              <button
                type="button"
                disabled={isExtendingAutomation}
                onClick={() => onExtendAutomation(1)}
                className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 font-bold transition text-[11px] cursor-pointer disabled:opacity-50"
                title="Gia hạn thêm 1 giờ"
              >
                +1h
              </button>
              <button
                type="button"
                disabled={isResumingAutomation}
                onClick={onResumeAutomation}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold transition shadow-2xs disabled:opacity-50 cursor-pointer text-xs"
                title="Khôi phục tự động hóa ngay"
              >
                <RotateCw className={`w-3 h-3 ${isResumingAutomation ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Khôi phục</span>
              </button>
            </div>
          </div>
        )}

        {/* 2. Device Offline Banner */}
        {disabled && (
          <div className="detail-banner-card offline-banner animate-in fade-in">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-7 h-7 rounded-xl bg-slate-500/20 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
                <WifiOff className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-semibold text-secondary truncate">
                Thiết bị hiện không phản hồi
              </span>
            </div>
            <button
              type="button"
              onClick={() => notify.info('Đang kiểm tra kết nối thiết bị...')}
              className="px-2.5 py-1 text-xs font-bold rounded-xl border border-[var(--border)] bg-[var(--solid)] text-[var(--text)] hover:bg-[var(--muted)] transition cursor-pointer shrink-0 shadow-2xs"
            >
              Thử kết nối lại
            </button>
          </div>
        )}

        {/* 3. Shadow Out of Sync Banner */}
        {isOutOfSync && (
          <div className="detail-banner-card sync-banner animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-3.5 h-3.5" />
              </span>
              <div className="min-w-0">
                <strong className="block text-xs font-bold truncate">Chưa đồng bộ lệnh</strong>
                <span className="text-[10px] opacity-90 block truncate">
                  Lệch {deltaKeysCount} trạng thái với thiết bị thực tế
                </span>
              </div>
            </div>
            <button
              type="button"
              disabled={isReconcilingShadow}
              onClick={onReconcileShadow}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold transition shadow-2xs disabled:opacity-50 cursor-pointer text-xs shrink-0"
              title="Gửi lại lệnh để đồng bộ ngay"
            >
              <RotateCw className={`w-3 h-3 ${isReconcilingShadow ? 'animate-spin' : ''}`} />
              <span>Đồng bộ ngay</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
