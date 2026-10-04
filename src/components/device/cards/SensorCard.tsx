import React from 'react';
import type { DeviceResponse } from '../../../types/device';
import {
  Thermometer,
  Droplets,
  PersonStanding,
  Flame,
  ShieldCheck,
  AlertTriangle,
  SlidersHorizontal,
} from 'lucide-react';

interface SensorCardProps {
  device: DeviceResponse;
  onClick?: (deviceId: string) => void;
}

export const SensorCard: React.FC<SensorCardProps> = ({ device, onClick }) => {
  const isOffline = device.status === 'OFFLINE';
  const type = device.deviceType;
  const state = device.currentState;

  const isClimate = type === 'TEMP_HUMID_SENSOR';
  const isMotion = type === 'MOTION_SENSOR';
  const isSmoke = type === 'SMOKE_SENSOR';

  // Climate data
  const temperature =
    typeof state?.temperature === 'number'
      ? (state.temperature as number).toFixed(1)
      : typeof state?.temperature === 'string'
      ? state.temperature
      : null;

  const humidity =
    typeof state?.humidity === 'number'
      ? state.humidity
      : typeof state?.humidity === 'string'
      ? state.humidity
      : null;

  // Security data
  const motionDetected = state?.motion === true || state?.motion === 'DETECTED';
  const smokeDetected = state?.smoke === true || state?.smoke === 'DETECTED' || state?.smoke === 'ALERT';
  const isAlert = motionDetected || smokeDetected;

  // Comfort indicator
  const getComfortStatus = (tempNum: number | null) => {
    if (tempNum === null) return 'Đang cập nhật';
    if (tempNum < 20) return 'Hơi se lạnh';
    if (tempNum <= 26) return 'Rất dễ chịu';
    if (tempNum <= 29) return 'Ấm áp';
    return 'Nóng';
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
          : isAlert
          ? 'bg-rose-50 border-2 border-rose-400 shadow-md shadow-rose-200/40 animate-pulse'
          : isClimate
          ? 'bg-gradient-to-br from-white via-sky-50/30 to-teal-50/20 border-sky-100/90 shadow-xs hover:shadow-md'
          : 'bg-gradient-to-br from-white via-emerald-50/30 to-emerald-100/20 border-emerald-100/90 shadow-xs hover:shadow-md'
      }`}
      aria-label={`${device.name}`}
    >
      {/* ── TOP ROW: Icon + Device Name + Telemetry Pulse / Settings ── */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all shrink-0 ${
              isOffline
                ? 'bg-off text-icon'
                : isAlert
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30'
                : isClimate
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25'
                : 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
            }`}
          >
            {isClimate && <Thermometer className="w-5 h-5" />}
            {isMotion && (isAlert ? <AlertTriangle className="w-5 h-5" /> : <PersonStanding className="w-5 h-5" />)}
            {isSmoke && (isAlert ? <Flame className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />)}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-[15px] leading-tight text-text truncate">
              {device.name}
            </h3>
            <p className="text-xs text-muted truncate mt-0.5">
              {isOffline
                ? 'Không phản hồi'
                : isAlert
                ? isSmoke
                  ? 'CẢNH BÁO KHÓI'
                  : 'PHÁT HIỆN CHUYỂN ĐỘNG'
                : isClimate
                ? 'Cảm biến môi trường'
                : 'Trạng thái bình thường'}
            </p>
          </div>
        </div>

        {/* Live heartbeat indicator */}
        <div className="flex items-center gap-2 shrink-0">
          {!isOffline && (
            <span className="relative flex h-2.5 w-2.5" title="Kết nối trực tiếp">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isAlert ? 'bg-rose-400' : 'bg-emerald-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  isAlert ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
              />
            </span>
          )}
          <button
            type="button"
            title="Chi tiết & Lịch sử"
            onClick={(e) => {
              e.stopPropagation();
              onClick?.(device.id);
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-icon hover:text-text hover:bg-white/80 transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── MIDDLE ROW: Hero Metrics (Climate) or Status Banner (Security) ── */}
      {isClimate ? (
        <div className="my-auto py-2">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl sm:text-4xl font-extrabold text-text tracking-tight">
              {temperature !== null ? temperature : '--'}
            </span>
            <span className="text-xl font-bold text-muted">°C</span>
          </div>

          <div className="flex items-center gap-2 mt-2">
            {humidity !== null && (
              <div className="inline-flex items-center gap-1 bg-sky-50 border border-sky-100 text-sky-700 text-xs font-semibold px-2.5 py-1 rounded-lg">
                <Droplets className="w-3.5 h-3.5 text-sky-500" />
                <span>Độ ẩm: {humidity}%</span>
              </div>
            )}
            <span className="text-xs text-muted font-medium">
              ● {getComfortStatus(temperature ? Number(temperature) : null)}
            </span>
          </div>
        </div>
      ) : (
        <div className="my-auto py-3">
          <div
            className={`p-3 rounded-xl border flex items-center gap-2.5 ${
              isAlert
                ? 'bg-rose-100/70 border-rose-200 text-rose-800'
                : 'bg-emerald-50/70 border-emerald-100 text-emerald-800'
            }`}
          >
            {isAlert ? (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            )}
            <span className="text-xs font-bold leading-snug">
              {isAlert
                ? isSmoke
                  ? 'Báo động: Có khói nguy hiểm!'
                  : 'Có chuyển động trong khu vực!'
                : 'Không gian an toàn · Không có báo động'}
            </span>
          </div>
        </div>
      )}

      {/* ── BOTTOM ROW: Metadata Footer ── */}
      <div className="pt-2 border-t border-line/50 flex items-center justify-between text-[11px] text-muted">
        <span>Khu vực: {device.roomName || 'Chung'}</span>
        <span>{isOffline ? 'Offline' : 'Vừa xong'}</span>
      </div>
    </article>
  );
};
