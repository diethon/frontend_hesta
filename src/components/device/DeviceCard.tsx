import React from 'react';
import type { DeviceResponse } from '../../types/device';

interface DeviceCardProps {
  device: DeviceResponse;
  onTogglePower?: (deviceId: string, currentPower: string) => void;
  onClick?: (deviceId: string) => void;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({ device, onTogglePower, onClick }) => {
  const hasPowerToggle = ['LIGHT', 'FAN', 'AC', 'SOCKET'].includes(device.deviceType);
  const isSensor = device.deviceType === 'SENSOR';
  const isLock = device.deviceType === 'LOCK';
  
  const powerState = device.currentState?.power || 'OFF';
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
      if (temp !== undefined && hum !== undefined) {
        return <span className="text-sm font-semibold text-cyan-400">{temp}°C / {hum}%</span>;
      }
    }
    if (isLock) {
      const bat = device.currentState?.battery;
      if (bat !== undefined) {
        return <span className="text-xs font-medium text-slate-300">Pin: {bat}%</span>;
      }
    }
    return null;
  };

  const getStatusColor = () => {
    switch (device.status) {
      case 'ONLINE': return 'bg-emerald-500';
      case 'OFFLINE': return 'bg-slate-500';
      case 'ERROR': return 'bg-rose-500';
      default: return 'bg-amber-500';
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
    <div
      onClick={() => onClick && onClick(device.id)}
      className={`bg-slate-900/80 border rounded-2xl p-4 flex flex-col justify-between h-32 relative overflow-hidden transition-transform duration-200 cursor-pointer hover:scale-[1.02] ${
        isHighlighted ? 'border-cyan-500/50 bg-cyan-950/20 shadow-[0_0_15px_rgba(6,182,212,0.15)]' : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      <div className="flex justify-between items-start">
        <div className={`text-2xl ${isHighlighted || isSensor ? 'text-cyan-400' : 'text-slate-500'}`}>
          {renderIcon()}
        </div>

        {hasPowerToggle ? (
          <button
            onClick={handleToggle}
            className={`w-10 h-6 rounded-full flex items-center p-1 transition-colors duration-300 ${
              isPoweredOn ? 'bg-cyan-500' : 'bg-slate-700'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-300 ${
                isPoweredOn ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        ) : (
          renderQuickInfo()
        )}
      </div>

      <div className="mt-auto">
        <h3 className="text-base font-semibold text-white truncate pr-2" title={device.name}>
          {device.name}
        </h3>
        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
          <span className={`inline-block w-2 h-2 rounded-full ${getStatusColor()}`} />
          {getStatusText()}
        </p>
      </div>
    </div>
  );
};
