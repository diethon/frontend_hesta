import React from 'react';
import { Thermometer, Droplets, PersonStanding, Flame, Clock } from 'lucide-react';
import type { DeviceResponse } from '../../../types/device';

export interface SensorDisplayProps {
  device: DeviceResponse;
}

export const SensorDisplay: React.FC<SensorDisplayProps> = ({ device }) => {
  const { deviceType, currentState, lastSeen } = device;
  const isOnline = device.status === 'ONLINE';
  
  const formattedLastSeen = lastSeen 
    ? new Date(lastSeen).toLocaleString('vi-VN', { 
        hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' 
      })
    : 'Không rõ';

  const renderTempHumid = () => {
    const temp = currentState?.temperature !== undefined ? Number(currentState.temperature).toFixed(1) : '--';
    const humid = currentState?.humidity !== undefined ? Number(currentState.humidity).toFixed(1) : '--';
    
    return (
      <div className="flex space-x-4">
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-info-soft rounded-2xl border border-primary/20">
          <Thermometer className="w-8 h-8 text-primary mb-3" />
          <span className="text-3xl font-bold text-primary">{temp}°C</span>
          <span className="text-sm font-medium text-primary/70 mt-1">Nhiệt độ</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-mint/10 rounded-2xl border border-mint/30">
          <Droplets className="w-8 h-8 text-mint mb-3" />
          <span className="text-3xl font-bold text-mint">{humid}%</span>
          <span className="text-sm font-medium text-mint/70 mt-1">Độ ẩm</span>
        </div>
      </div>
    );
  };

  const renderMotion = () => {
    const isMotionDetected = currentState?.motion === true || currentState?.motion === 'DETECTED';
    
    return (
      <div className={`flex flex-col items-center justify-center p-8 rounded-2xl border ${
        isMotionDetected 
          ? 'bg-warning-soft border-warning/30 text-warning' 
          : 'bg-surface border-line text-muted'
      }`}>
        <PersonStanding className={`w-16 h-16 mb-4 ${isMotionDetected ? 'animate-pulse' : ''}`} />
        <span className="text-2xl font-bold text-center">
          {isMotionDetected ? 'Phát hiện chuyển động' : 'Không phát hiện'}
        </span>
      </div>
    );
  };

  const renderSmoke = () => {
    const isSmokeDetected = currentState?.smoke === true || currentState?.smoke === 'DETECTED';
    
    return (
      <div className={`flex flex-col items-center justify-center p-8 rounded-2xl border ${
        isSmokeDetected 
          ? 'bg-error-soft border-error/50 text-error' 
          : 'bg-success-soft border-success/30 text-success'
      }`}>
        <Flame className={`w-16 h-16 mb-4 ${isSmokeDetected ? 'animate-bounce' : ''}`} />
        <span className="text-2xl font-bold text-center">
          {isSmokeDetected ? 'PHÁT HIỆN KHÓI / CHÁY' : 'An toàn'}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col space-y-6">
      <div className={`transition-opacity duration-300 ${!isOnline ? 'opacity-50 grayscale' : ''}`}>
        {deviceType === 'TEMP_HUMID_SENSOR' && renderTempHumid()}
        {deviceType === 'MOTION_SENSOR' && renderMotion()}
        {deviceType === 'SMOKE_SENSOR' && renderSmoke()}
      </div>
      
      <div className="flex items-center justify-center space-x-2 text-xs text-muted">
        <Clock className="w-3.5 h-3.5" />
        <span>Cập nhật lần cuối: {formattedLastSeen}</span>
      </div>
    </div>
  );
};
