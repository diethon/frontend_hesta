import React from 'react';
import { Power, Wifi, WifiOff } from 'lucide-react';
import type { DeviceResponse } from '../../../types/device';

export interface LightControlProps {
  device: DeviceResponse;
  onTogglePower: (deviceId: string, currentPower: string) => void;
  isPending?: boolean;
}

export const LightControl: React.FC<LightControlProps> = ({ device, onTogglePower, isPending = false }) => {
  const isOnline = device.status === 'ONLINE';
  const powerState = String(device.currentState?.power || 'OFF').toUpperCase();
  const isOn = powerState === 'ON';

  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-6">
      <div className="flex items-center space-x-2 text-sm font-medium">
        {isOnline ? (
          <>
            <Wifi className="w-4 h-4 text-primary" />
            <span className="text-primary">Trực tuyến</span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4 text-muted" />
            <span className="text-muted">Ngoại tuyến</span>
          </>
        )}
      </div>

      <button
        disabled={!isOnline || isPending}
        onClick={() => onTogglePower(device.id, powerState)}
        className={`relative flex items-center justify-center w-40 h-40 rounded-full transition-all duration-300 ease-in-out ${
          isOn 
            ? 'bg-amber-100 text-amber-500 shadow-lg shadow-amber-200/50' 
            : 'bg-surface text-icon border border-line shadow-sm'
        } ${(!isOnline || isPending) ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
      >
        <Power className={`w-16 h-16 ${isPending ? 'animate-pulse' : ''}`} />
      </button>

      <div className="text-center">
        <p className="text-lg font-semibold text-text">
          {isOn ? 'ĐANG BẬT' : 'ĐANG TẮT'}
        </p>
      </div>
    </div>
  );
};
