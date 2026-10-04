import React, { useState, useEffect } from 'react';
import type { DeviceResponse } from '../../../types/device';
import { Lightbulb, Plug2, SunMedium, SlidersHorizontal, Power } from 'lucide-react';
import { sendDeviceCommand } from '../../../services/deviceApi';
import { notify } from '../../ui/notify';
import { getErrorMessage } from '../../../utils/errors';

interface LightCardProps {
  device: DeviceResponse;
  powerPending?: boolean;
  onTogglePower?: (deviceId: string, currentPower: string) => void;
  onClick?: (deviceId: string) => void;
}

const COLOR_PRESETS = [
  { label: 'Trắng ấm', r: 255, g: 244, b: 229, hex: '#fff4e5' },
  { label: 'Vàng nắng', r: 255, g: 193, b: 7, hex: '#ffc107' },
  { label: 'Cam hoàng hôn', r: 255, g: 112, b: 67, hex: '#ff7043' },
  { label: 'Đỏ', r: 244, g: 67, b: 54, hex: '#f44336' },
  { label: 'Xanh lá', r: 76, g: 175, b: 80, hex: '#4caf50' },
  { label: 'Xanh băng', r: 0, g: 188, b: 212, hex: '#00bcd4' },
  { label: 'Xanh dương', r: 33, g: 150, b: 243, hex: '#2196f3' },
  { label: 'Tím', r: 156, g: 39, b: 176, hex: '#9c27b0' },
];

export const LightCard: React.FC<LightCardProps> = ({
  device,
  powerPending = false,
  onTogglePower,
  onClick,
}) => {
  const isOffline = device.status === 'OFFLINE';
  const isRgb = device.deviceType === 'LED_RGB';
  const isPlug = device.deviceType === 'SMART_PLUG';

  const rawPower = device.currentState?.power;
  const isOn = rawPower === 'ON' || rawPower === true || rawPower === 'true';

  const [brightness, setBrightness] = useState<number>(
    typeof device.currentState?.brightness === 'number'
      ? Number(device.currentState.brightness)
      : 80
  );

  const rgbColor = device.currentState?.color as
    | { r: number; g: number; b: number }
    | undefined;

  useEffect(() => {
    if (typeof device.currentState?.brightness === 'number') {
      setBrightness(Number(device.currentState.brightness));
    }
  }, [device.currentState?.brightness]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOffline || powerPending) return;
    onTogglePower?.(device.id, isOn ? 'ON' : 'OFF');
  };

  const handleBrightnessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setBrightness(val);
    if (!isOn && val > 0 && onTogglePower) {
      onTogglePower(device.id, 'OFF');
    }
  };

  const syncBrightnessToBackend = async () => {
    if (isOffline) return;
    try {
      await sendDeviceCommand(device.id, 'SET_BRIGHTNESS', { brightness });
    } catch (err) {
      notify.error(getErrorMessage(err, 'Lỗi chỉnh độ sáng'));
    }
  };

  const handleApplyColor = async (preset: (typeof COLOR_PRESETS)[0], e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOffline) return;
    try {
      await sendDeviceCommand(device.id, 'SET_COLOR', {
        r: preset.r,
        g: preset.g,
        b: preset.b,
        brightness: brightness || 100,
      });
      notify.success(`Màu: ${preset.label}`);
      if (!isOn && onTogglePower) {
        onTogglePower(device.id, 'OFF');
      }
    } catch (err) {
      notify.error(getErrorMessage(err, 'Lỗi đổi màu đèn'));
    }
  };

  // Color preview style
  const currentRgbCss = rgbColor
    ? `rgb(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b})`
    : '#fbbf24';

  const glowShadow = isOn
    ? isRgb
      ? `0 4px 20px -2px ${currentRgbCss}40`
      : `0 4px 20px -2px rgba(251, 191, 36, ${(brightness / 100) * 0.4})`
    : undefined;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(device.id)}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.(device.id)}
      style={{ boxShadow: glowShadow }}
      className={`relative flex flex-col justify-between p-4 sm:p-5 rounded-2xl border transition-all duration-200 select-none cursor-pointer ${
        isOffline
          ? 'bg-off-soft/60 border-line/50 opacity-70 grayscale'
          : isOn
          ? isPlug
            ? 'bg-gradient-to-br from-white via-emerald-50/40 to-emerald-100/30 border-emerald-200 shadow-sm hover:shadow-md'
            : isRgb
            ? 'bg-gradient-to-br from-white via-violet-50/40 to-violet-100/30 border-violet-200 shadow-sm hover:shadow-md'
            : 'bg-gradient-to-br from-white via-amber-50/40 to-amber-100/30 border-amber-200 shadow-sm hover:shadow-md'
          : 'bg-white border-line hover:bg-off-soft/40 shadow-xs'
      }`}
      aria-label={`${device.name} — ${isOn ? 'Đang bật' : 'Đang tắt'}`}
    >
      {/* ── TOP ROW: Icon + Title + Switch ── */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all shrink-0 ${
              isOffline
                ? 'bg-off text-icon'
                : isOn
                ? isPlug
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                  : isRgb
                  ? 'bg-violet-500 text-white shadow-md shadow-violet-500/30'
                  : 'bg-amber-400 text-white shadow-md shadow-amber-400/35'
                : 'bg-sidebar border border-line text-icon'
            }`}
            style={
              isOn && isRgb && rgbColor
                ? { backgroundColor: currentRgbCss, boxShadow: `0 6px 16px ${currentRgbCss}40` }
                : undefined
            }
          >
            {isPlug ? <Plug2 className="w-5 h-5" /> : <Lightbulb className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-[15px] leading-tight text-text truncate">
              {device.name}
            </h3>
            <p className="text-xs text-muted truncate mt-0.5">
              {isOffline
                ? 'Không phản hồi'
                : isOn
                ? isPlug
                  ? 'Đang cấp điện'
                  : `${brightness}% · Đang bật`
                : 'Đang tắt'}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            title="Chi tiết & Lịch sử"
            onClick={() => onClick?.(device.id)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-icon hover:text-text hover:bg-white/80 transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
          <button
            type="button"
            title={isOn ? 'Tắt' : 'Bật'}
            disabled={isOffline || powerPending}
            onClick={handleToggle}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              isOn
                ? isPlug
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                  : isRgb
                  ? 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                : 'bg-sidebar border border-line text-icon hover:bg-sidebar-hover hover:text-text'
            } ${powerPending ? 'animate-pulse' : 'active:scale-95'}`}
          >
            <Power className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── MIDDLE / BOTTOM: Inline Brightness Slider (Mushroom style) ── */}
      {!isPlug && (
        <div className="mt-2 space-y-2.5" onClick={(e) => e.stopPropagation()}>
          <div className="relative h-10 w-full bg-slate-100 rounded-xl overflow-hidden flex items-center select-none cursor-pointer border border-line/60">
            {/* Active Slider Track Fill */}
            <div
              className={`absolute left-0 top-0 bottom-0 transition-all ${
                isOn
                  ? isRgb
                    ? 'bg-gradient-to-r from-violet-300 to-violet-500 opacity-90'
                    : 'bg-gradient-to-r from-amber-300 to-amber-400 opacity-90'
                  : 'bg-slate-200 opacity-40'
              }`}
              style={{
                width: `${isOn ? brightness : 0}%`,
                backgroundColor: isOn && isRgb && rgbColor ? currentRgbCss : undefined,
              }}
            />

            {/* Native invisible range input overlaid on top */}
            <input
              type="range"
              min={1}
              max={100}
              value={brightness}
              disabled={isOffline}
              onChange={handleBrightnessChange}
              onPointerUp={syncBrightnessToBackend}
              onTouchEnd={syncBrightnessToBackend}
              className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize disabled:cursor-not-allowed z-20"
              aria-label={`Độ sáng ${device.name}`}
            />

            {/* In-track Icon & Label */}
            <div className="relative z-10 w-full px-3.5 flex items-center justify-between pointer-events-none text-xs font-semibold">
              <div className="flex items-center gap-1.5 text-text">
                <SunMedium className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Độ sáng</span>
              </div>
              <span className="text-text font-bold">{isOn ? `${brightness}%` : 'Tắt'}</span>
            </div>
          </div>

          {/* Quick Color Swatches for LED_RGB */}
          {isRgb && (
            <div className="flex items-center justify-between gap-1 pt-1">
              {COLOR_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  title={p.label}
                  disabled={isOffline}
                  onClick={(e) => handleApplyColor(p, e)}
                  className={`w-6 h-6 rounded-full border-2 border-white shadow-xs transition-transform ${
                    isOffline ? 'opacity-30' : 'hover:scale-125 active:scale-95'
                  }`}
                  style={{ backgroundColor: p.hex }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* For Plug: bottom detail indicator */}
      {isPlug && (
        <div className="mt-auto pt-2 flex items-center justify-between text-xs text-muted border-t border-line/50">
          <span>Trạng thái ổ cắm</span>
          <span className={`font-semibold ${isOn ? 'text-emerald-600' : 'text-muted'}`}>
            {isOn ? 'Đang hoạt động' : 'Tạm ngắt điện'}
          </span>
        </div>
      )}
    </article>
  );
};
