import React from 'react';
import { Thermometer, Droplets, PersonStanding, Flame, Clock, Sun, Moon, Zap } from 'lucide-react';
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

  const renderLux = () => {
    const rawLightSensor = currentState?.LIGHT_SENSOR ?? currentState?.light ?? currentState?.light_detected;
    const luxVal =
      typeof currentState?.lux === 'number'
        ? currentState.lux
        : typeof currentState?.illuminance === 'number'
        ? currentState.illuminance
        : null;

    const isBright =
      luxVal !== null
        ? luxVal > 300
        : rawLightSensor === 1 || rawLightSensor === '1' || rawLightSensor === true || rawLightSensor === 'BRIGHT';

    const lightStatusText =
      luxVal !== null
        ? luxVal > 1000
          ? 'Nắng gắt ngoài trời'
          : luxVal > 300
          ? 'Đủ ánh sáng sinh hoạt'
          : luxVal > 50
          ? 'Ánh sáng mờ / Yếu'
          : 'Môi trường tối'
        : isBright
        ? 'Môi trường sáng (Đủ sáng)'
        : 'Môi trường tối (Thiếu sáng)';

    return (
      <div className="space-y-4">
        <div
          className={`flex flex-col items-center justify-center p-8 rounded-2xl border transition-all ${
            isBright
              ? 'bg-gradient-to-b from-amber-50/70 to-yellow-50/40 border-amber-200 text-amber-900'
              : 'bg-gradient-to-b from-slate-900 to-slate-800 border-slate-700 text-slate-100'
          }`}
        >
          <div
            className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 ${
              isBright
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                : 'bg-slate-700 text-amber-300 shadow-lg shadow-slate-950/40'
            }`}
          >
            {isBright ? (
              <Sun className="w-10 h-10 animate-[spin_16s_linear_infinite]" />
            ) : (
              <Moon className="w-10 h-10" />
            )}
          </div>

          {luxVal !== null ? (
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-4xl font-extrabold tracking-tight">{luxVal.toFixed(0)}</span>
              <span className={`text-xl font-bold ${isBright ? 'text-amber-700' : 'text-slate-400'}`}>Lux</span>
            </div>
          ) : (
            <span className="text-3xl font-extrabold mb-2">
              {isBright ? 'Trời sáng' : 'Trời tối'}
            </span>
          )}

          <span
            className={`text-sm font-semibold px-3 py-1 rounded-full ${
              isBright
                ? 'bg-amber-100/90 text-amber-800 border border-amber-300/50'
                : 'bg-slate-800 text-slate-300 border border-slate-600'
            }`}
          >
            {lightStatusText}
          </span>
        </div>

        {/* Automation recommendation banner */}
        <div className="p-3.5 rounded-xl border border-line bg-surface/60 text-xs text-muted flex items-start gap-2.5">
          <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-text font-semibold">Tự động hóa thông minh:</strong> Cảm biến quang trở giúp hệ thống tự động nhận biết ngày/đêm để điều chỉnh rèm cửa hoặc bật tắt đèn tự động.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col space-y-6">
      <div className={`transition-opacity duration-300 ${!isOnline ? 'opacity-50 grayscale' : ''}`}>
        {deviceType === 'TEMP_HUMID_SENSOR' && renderTempHumid()}
        {deviceType === 'MOTION_SENSOR' && renderMotion()}
        {deviceType === 'SMOKE_SENSOR' && renderSmoke()}
        {(deviceType === 'LUX_SENSOR' || deviceType === 'LIGHT_SENSOR') && renderLux()}
      </div>
      
      <div className="flex items-center justify-center space-x-2 text-xs text-muted">
        <Clock className="w-3.5 h-3.5" />
        <span>Cập nhật lần cuối: {formattedLastSeen}</span>
      </div>
    </div>
  );
};
