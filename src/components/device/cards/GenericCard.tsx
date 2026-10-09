import React from 'react';
import type { DeviceResponse } from '../../../types/device';
import { Cpu, Power, SlidersHorizontal } from 'lucide-react';

interface GenericCardProps {
  device: DeviceResponse;
  powerPending?: boolean;
  onTogglePower?: (deviceId: string, currentPower: string) => void;
  onClick?: (deviceId: string) => void;
}

export const GenericCard: React.FC<GenericCardProps> = ({
  device,
  powerPending = false,
  onTogglePower,
  onClick,
}) => {
  const isOffline = device.status === 'OFFLINE';
  const rawPower = device.currentState?.power;
  const isOn = rawPower === 'ON' || rawPower === true || rawPower === 'true';

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOffline || powerPending) return;
    onTogglePower?.(device.id, isOn ? 'ON' : 'OFF');
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(device.id)}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.(device.id)}
      className={`relative flex flex-col justify-between p-4 sm:p-5 rounded-2xl border transition-all duration-200 select-none cursor-pointer ${
        isOffline
          ? 'bg-off-soft/60 border-line/50 opacity-70 grayscale'
          : isOn
          ? 'bg-gradient-to-br from-white via-primary/5 to-primary/10 border-primary/30 shadow-sm hover:shadow-md'
          : 'bg-white border-line hover:bg-off-soft/40 shadow-xs'
      }`}
      aria-label={`${device.name}`}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all shrink-0 ${
              isOffline
                ? 'bg-off text-icon'
                : isOn
                ? 'bg-primary text-white shadow-md shadow-primary/30'
                : 'bg-sidebar border border-line text-icon'
            }`}
          >
            <Cpu className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-[15px] leading-tight text-text truncate">
              {device.name}
            </h3>
            <p className="text-xs text-muted truncate mt-0.5">
              {isOffline ? 'Không phản hồi' : device.deviceType}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            title="Chi tiết & Lịch sử"
            onClick={() => onClick?.(device.id)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-icon hover:text-text hover:bg-white/80 transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
          {onTogglePower && (
            <button
              type="button"
              disabled={isOffline || powerPending}
              onClick={handleToggle}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                isOn
                  ? 'bg-primary/20 text-primary-hover hover:bg-primary/30'
                  : 'bg-sidebar border border-line text-icon hover:bg-sidebar-hover hover:text-text'
              } ${powerPending ? 'animate-pulse' : 'active:scale-95'}`}
            >
              <Power className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-auto pt-3 border-t border-line/50 flex items-center justify-between text-xs text-muted">
        <span>Vị trí: {device.roomName || 'Chung'}</span>
        <span className="font-semibold text-text">
          {isOffline ? 'Ngoại tuyến' : isOn ? 'Hoạt động' : 'Tắt'}
        </span>
      </div>
    </article>
  );
};
