import React from 'react';
import type { DeviceResponse } from '../../types/device';

interface DeviceCardProps {
  device: DeviceResponse;
  onTogglePower?: (deviceId: string, currentPower: string) => void;
  powerPending?: boolean;
  onClick?: (deviceId: string) => void;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({ device, onTogglePower, powerPending = false, onClick }) => {
  const hasPowerToggle = ['LIGHT', 'FAN', 'AC', 'SOCKET'].includes(device.deviceType);
  const isSensor = device.deviceType === 'SENSOR';
  const isLock = device.deviceType === 'LOCK';
  
  const rawPowerState = device.currentState?.power;
  const powerState = typeof rawPowerState === 'string' ? rawPowerState : 'OFF';
  // If it doesn't have a power toggle, we don't highlight the card as "powered on", except maybe locks if unlocked
  const isPoweredOn = hasPowerToggle && powerState === 'ON';
  const isUnlocked = isLock && device.currentState?.state === 'UNLOCKED';
  
  const isHighlighted = isPoweredOn || isUnlocked;

  const renderIcon = () => {
    if (device.icon) return <span className="text-xl">{device.icon}</span>;
    switch (device.deviceType) {
      case 'LIGHT': return '💡';
      case 'FAN': return '🌬️';
      case 'AC': return '❄️';
      case 'SENSOR': return '🌡️';
      case 'LOCK': return isUnlocked ? '🔓' : '🔒';
      case 'SOCKET': return '🔌';
      default: return '📦';
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasPowerToggle && onTogglePower) {
      onTogglePower(device.id, powerState);
    }
  };

  const renderQuickInfo = () => {
    if (isSensor) {
      const temp = device.currentState?.temperature;
      const hum = device.currentState?.humidity;
      if ((typeof temp === 'number' || typeof temp === 'string')
        && (typeof hum === 'number' || typeof hum === 'string')) {
        return <span className="text-sm font-semibold text-cyan-400">{temp}°C / {hum}%</span>;
      }
    }
    if (isLock) {
      const bat = device.currentState?.battery;
      if (typeof bat === 'number' || typeof bat === 'string') {
        return <span className="text-xs font-medium text-slate-300">Pin: {bat}%</span>;
      }
    }
    return null;
  };

  const getStatusColor = () => {
    switch (device.status) {
      case 'ONLINE': return 'bg-success';
      case 'OFFLINE': return 'bg-off';
      case 'ERROR': return 'bg-error';
      default: return 'bg-warning';
    }
  };

  const getStatusText = () => {
    switch (device.status) {
      case 'ONLINE': return 'Đang hoạt động';
      case 'OFFLINE': return 'Ngoại tuyến';
      case 'ERROR': return 'Lỗi thiết bị';
      default: return 'Không xác định';
    }
  };

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`Xem chi tiết thiết bị ${device.name}`}
      onClick={() => onClick && onClick(device.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick?.(device.id);
        }
      }}
      className={`surface-card relative flex min-h-40 cursor-pointer flex-col justify-between overflow-hidden p-5 transition hover:-translate-y-0.5 ${
        isHighlighted ? 'border-primary bg-info-soft' : 'hover:border-primary'
      }`}
    >
      <div className="flex justify-between items-start">
        <div className={`text-2xl ${isHighlighted || isSensor ? 'text-cyan-400' : 'text-slate-500'}`}>
          {renderIcon()}
        </div>

        {hasPowerToggle ? (
          <button
            type="button"
            aria-label={`${isPoweredOn ? 'Tắt' : 'Bật'} ${device.name}`}
            aria-pressed={isPoweredOn}
            disabled={powerPending}
            onClick={handleToggle}
            className={`flex h-7 w-12 items-center rounded-full p-1 transition-colors duration-300 ${
              isPoweredOn ? 'bg-success' : 'bg-off'
            }`}
          >
            <div
              className={`h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${
                isPoweredOn ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        ) : (
          renderQuickInfo()
        )}
      </div>

      <div className="mt-auto">
        <h3 className="truncate pr-2 text-base font-semibold text-text" title={device.name}>
          {device.name}
        </h3>
        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
          <span className={`inline-block w-2 h-2 rounded-full ${getStatusColor()}`} />
          {getStatusText()}
        </p>
      </div>
    </article>
  );
};
