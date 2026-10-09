import React, { useMemo } from 'react';
import { Lightbulb, Thermometer, Shield, WifiOff } from 'lucide-react';
import type { DeviceResponse } from '../../types/device';

import { isAcDevice } from './deviceHelpers';

interface StatusChipsProps {
  devices: DeviceResponse[];
  activeCategory: string; // 'ALL' | 'LIGHTS' | 'CLIMATE' | 'SECURITY' | 'OFFLINE'
  onCategoryChange: (category: string) => void;
}

export const StatusChips: React.FC<StatusChipsProps> = ({
  devices,
  activeCategory,
  onCategoryChange,
}) => {
  const stats = useMemo(() => {
    let lightCount = 0;
    let tempSum = 0;
    let tempCount = 0;
    let securitySafe = true;
    let offlineCount = 0;

    devices.forEach(device => {
      // Offline count
      if (device.status === 'OFFLINE') {
        offlineCount++;
      }

      // Lights count (power ON)
      if (['LIGHT', 'LED_RGB', 'SMART_PLUG'].includes(device.deviceType)) {
        if (device.currentState?.power === 'ON' || device.currentState?.power === true) {
          lightCount++;
        }
      }

      // Climate (avg temp from sensors & ACs)
      if (device.deviceType === 'TEMP_HUMID_SENSOR' || isAcDevice(device)) {
        const temp = Number(device.currentState?.temperature);
        if (typeof temp === 'number' && !isNaN(temp) && temp > 0) {
          tempSum += temp;
          tempCount++;
        }
      }

      // Security (MOTION_SENSOR, SMOKE_SENSOR)
      if (['MOTION_SENSOR', 'SMOKE_SENSOR'].includes(device.deviceType)) {
        if (device.currentState?.motion === true || device.currentState?.smoke === true || device.currentState?.status === 'ALARM') {
          securitySafe = false;
        }
      }
    });

    return {
      total: devices.length,
      lightsOn: lightCount,
      avgTemp: tempCount > 0 ? (tempSum / tempCount).toFixed(1) : null,
      securityStatus: securitySafe ? 'An toàn' : 'Cảnh báo',
      offline: offlineCount,
    };
  }, [devices]);

  return (
    <div className="flex items-center gap-3 overflow-x-auto custom-scrollbar pb-2">
      <button
        onClick={() => onCategoryChange('ALL')}
        className={`flex items-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors border border-line ${
          activeCategory === 'ALL'
            ? 'bg-primary text-white border-primary shadow-sm'
            : 'bg-white text-text hover:bg-sidebar-hover'
        }`}
      >
        Tất cả [{stats.total}]
      </button>

      <button
        onClick={() => onCategoryChange('LIGHTS')}
        className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors border border-line ${
          activeCategory === 'LIGHTS'
            ? 'bg-primary text-white border-primary shadow-sm'
            : 'bg-white text-text hover:bg-sidebar-hover'
        }`}
      >
        <Lightbulb size={16} />
        Đèn bật [{stats.lightsOn}]
      </button>

      <button
        onClick={() => onCategoryChange('CLIMATE')}
        className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors border border-line ${
          activeCategory === 'CLIMATE'
            ? 'bg-primary text-white border-primary shadow-sm'
            : 'bg-white text-text hover:bg-sidebar-hover'
        }`}
      >
        <Thermometer size={16} />
        Nhiệt độ [{stats.avgTemp !== null ? `${stats.avgTemp}°C` : '--'}]
      </button>

      <button
        onClick={() => onCategoryChange('SECURITY')}
        className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors border border-line ${
          activeCategory === 'SECURITY'
            ? 'bg-primary text-white border-primary shadow-sm'
            : 'bg-white text-text hover:bg-sidebar-hover'
        }`}
      >
        <Shield size={16} className={stats.securityStatus === 'Cảnh báo' ? 'text-warning' : ''} />
        An ninh [{stats.securityStatus}]
      </button>

      {stats.offline > 0 && (
        <button
          onClick={() => onCategoryChange('OFFLINE')}
          className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors border border-line ${
            activeCategory === 'OFFLINE'
              ? 'bg-primary text-white border-primary shadow-sm'
              : 'bg-white text-text hover:bg-sidebar-hover'
          }`}
        >
          <WifiOff size={16} />
          Offline [{stats.offline}]
        </button>
      )}
    </div>
  );
};
