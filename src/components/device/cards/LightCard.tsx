import React, { useState, useEffect, useRef } from 'react';
import type { DeviceResponse } from '../../../types/device';
import { Lightbulb, Plug2, SunMedium, SlidersHorizontal, Power, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { sendDeviceCommand } from '../../../services/deviceApi';
import { notify } from '../../ui/notify';
import { getErrorMessage, isDuplicateCommandError } from '../../../utils/errors';
import { useOverrideCountdown } from '../useOverrideCountdown';
import { OverrideActionModal } from '../OverrideActionModal';
import { type CustomColorOption, DEFAULT_SEED } from '../controls/RgbLightControl';
import { resolveDeviceRgb } from '../deviceHelpers';

interface LightCardProps {
  device: DeviceResponse;
  powerPending?: boolean;
  onTogglePower?: (deviceId: string, currentPower: string) => void;
  onClick?: (deviceId: string) => void;
  onStateChange?: (updatedDevice: DeviceResponse) => void;
}

export const LightCard: React.FC<LightCardProps> = ({
  device,
  powerPending = false,
  onTogglePower,
  onClick,
  onStateChange,
}) => {
  const isOffline = device.status === 'OFFLINE';
  const isRgb = device.deviceType === 'LED_RGB';
  const isPlug = device.deviceType === 'SMART_PLUG';

  const rawPower = device.currentState?.power;
  const isOn = rawPower === 'ON' || rawPower === true || rawPower === 'true';

  const [overrideUntil, setOverrideUntil] = useState<string | null | undefined>(device.manualOverrideUntil);

  useEffect(() => {
    setOverrideUntil(device.manualOverrideUntil);
  }, [device.manualOverrideUntil]);

  const { isOverrideActive, formattedTime } = useOverrideCountdown(overrideUntil);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);

  const [brightness, setBrightness] = useState<number>(
    typeof device.currentState?.brightness === 'number'
      ? Number(device.currentState.brightness)
      : 80
  );

  const rgbColor = resolveDeviceRgb(device.currentState);

  const [customColors, setCustomColors] = useState<CustomColorOption[]>(() => {
    if (Array.isArray(device.settings?.customColors) && device.settings.customColors.length > 0) {
      return device.settings.customColors;
    }
    try {
      const raw = localStorage.getItem(`hesta_custom_colors_${device.id}`);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (err) {
      console.error('Lỗi đọc custom colors từ localStorage:', err);
    }
    return DEFAULT_SEED;
  });

  useEffect(() => {
    const loadColors = () => {
      if (Array.isArray(device.settings?.customColors) && device.settings.customColors.length > 0) {
        setCustomColors(device.settings.customColors);
        return;
      }
      try {
        const raw = localStorage.getItem(`hesta_custom_colors_${device.id}`);
        if (raw !== null) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setCustomColors(parsed);
            return;
          }
        }
      } catch (err) {
        console.error('Lỗi đọc custom colors từ localStorage:', err);
      }
      setCustomColors(DEFAULT_SEED);
    };

    loadColors();

    const handleUpdate = (e: Event) => {
      const customEvt = e as CustomEvent<{ deviceId?: string }>;
      if (!customEvt.detail?.deviceId || customEvt.detail.deviceId === device.id) {
        loadColors();
      }
    };

    window.addEventListener('hesta_custom_colors_updated', handleUpdate);
    return () => {
      window.removeEventListener('hesta_custom_colors_updated', handleUpdate);
    };
  }, [device.id, device.settings?.customColors]);

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

  const brightnessThrottleRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (brightnessThrottleRef.current) {
        window.clearTimeout(brightnessThrottleRef.current);
      }
    };
  }, []);

  const handleBrightnessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setBrightness(val);

    // 1. Optimistic update immediately so the local card and parent reflect brightness at 60fps
    onStateChange?.({
      ...device,
      currentState: {
        ...device.currentState,
        brightness: val,
        power: val > 0 ? 'ON' : device.currentState?.power,
      },
    });

    // 2. Throttle backend calls to 100ms so the light smoothly tracks finger/mouse without spamming
    if (brightnessThrottleRef.current) {
      window.clearTimeout(brightnessThrottleRef.current);
    }
    brightnessThrottleRef.current = window.setTimeout(() => {
      void sendDeviceCommand(device.id, 'SET_BRIGHTNESS', { brightness: val }).catch(() => {});
    }, 100);
  };

  const syncBrightnessToBackend = async () => {
    if (isOffline) return;
    if (brightnessThrottleRef.current) {
      window.clearTimeout(brightnessThrottleRef.current);
    }
    try {
      await sendDeviceCommand(device.id, 'SET_BRIGHTNESS', { brightness });
      onStateChange?.({
        ...device,
        currentState: {
          ...device.currentState,
          brightness,
          power: brightness > 0 ? 'ON' : device.currentState?.power,
        },
      });
    } catch (err) {
      if (isDuplicateCommandError(err)) {
        return;
      }
      notify.error(getErrorMessage(err, 'Lỗi chỉnh độ sáng'));
    }
  };

  const handleApplyColor = async (p: CustomColorOption, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOffline) return;
    const previousState = device.currentState;

    // 1. Instant zero-latency UI response: glow and card theme change immediately
    onStateChange?.({
      ...device,
      currentState: {
        ...device.currentState,
        power: 'ON',
        color: { r: p.rgb[0], g: p.rgb[1], b: p.rgb[2] },
        r: p.rgb[0],
        g: p.rgb[1],
        b: p.rgb[2],
      },
    });

    // Instant tactile notification so user gets feedback within 0ms
    notify.success('Đã đổi màu đèn', `Màu: ${p.name}`);

    try {
      await sendDeviceCommand(device.id, 'SET_RGB', {
        r: p.rgb[0],
        g: p.rgb[1],
        b: p.rgb[2],
        brightness: brightness || 100,
      });
    } catch (err) {
      if (isDuplicateCommandError(err)) {
        return; // Suppress duplicate toast on rapid color switches
      }
      // Rollback on genuine error
      onStateChange?.({
        ...device,
        currentState: previousState,
      });
      notify.error(getErrorMessage(err, 'Lỗi đổi màu đèn'));
    }
  };

  // Color preview style
  const currentRgbCss = rgbColor
    ? `rgb(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b})`
    : '#fbbf24';

  const glowShadow = isOn
    ? isRgb
      ? `0 10px 28px -4px ${currentRgbCss}35, inset 0 1px 1px 0 rgba(255, 255, 255, 0.9)`
      : `0 10px 28px -4px rgba(251, 191, 36, ${(brightness / 100) * 0.45}), inset 0 1px 1px 0 rgba(255, 255, 255, 0.9)`
    : '0 2px 8px -2px rgba(0, 0, 0, 0.04)';

  return (
    <motion.article
      role="button"
      tabIndex={0}
      whileHover={{ translateY: -3 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 450, damping: 25 }}
      onClick={() => onClick?.(device.id)}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.(device.id)}
      style={{ boxShadow: glowShadow }}
      className={`relative flex flex-col justify-between p-4 sm:p-5 rounded-2xl border transition-all duration-300 select-none cursor-pointer overflow-hidden transform-gpu ${
        isOffline
          ? 'bg-off-soft/60 border-line/50 opacity-70 grayscale'
          : isOn
          ? isPlug
            ? 'bg-gradient-to-br from-white via-emerald-50/50 to-emerald-100/35 border-emerald-300/80 shadow-sm'
            : isRgb
            ? 'bg-gradient-to-br from-white via-violet-50/45 to-violet-100/35 border-violet-300/80 shadow-sm'
            : 'bg-gradient-to-br from-white via-amber-50/50 to-amber-100/35 border-amber-300/80 shadow-sm'
          : 'bg-white border-line hover:bg-off-soft/40 shadow-xs'
      }`}
      aria-label={`${device.name} — ${isOn ? 'Đang bật' : 'Đang tắt'}`}
    >
      {/* Dynamic Ambient Glow Spotlight */}
      {isOn && (
        <div
          className="absolute -top-12 -right-12 w-44 h-44 rounded-full pointer-events-none opacity-30 transition-all duration-500"
          style={{
            background: `radial-gradient(circle, ${isRgb ? currentRgbCss : '#f59e0b'} 0%, transparent 70%)`,
            filter: 'blur(20px)',
          }}
        />
      )}
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
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              <p className="text-xs text-muted truncate">
                {isOffline
                  ? 'Không phản hồi'
                  : isOn
                  ? isPlug
                    ? 'Đang cấp điện'
                    : `${brightness}% · Đang bật`
                  : 'Đang tắt'}
              </p>
              {isOverrideActive && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOverrideModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 animate-pulse transition cursor-pointer"
                  title="Đang khóa tự động hóa. Bấm để quản lý hoặc gia hạn"
                >
                  🔒 {formattedTime}
                </button>
              )}
            </div>
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
            } ${powerPending ? 'opacity-70 cursor-wait' : 'active:scale-95'}`}
          >
            {powerPending ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <Power className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* ── MIDDLE / BOTTOM: Inline Brightness Slider (Mushroom style) ── */}
      {!isPlug && (
        <div className="mt-2 space-y-2.5" onClick={(e) => e.stopPropagation()}>
          <div className="relative h-10 w-full bg-slate-100 rounded-xl overflow-hidden flex items-center select-none cursor-pointer border border-line/60">
            {/* Active Slider Track Fill */}
            <div
              className={`absolute left-0 top-0 bottom-0 transition-colors duration-200 ${
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
          {isRgb && customColors.length > 0 && (
            <div className="flex items-center justify-start gap-1.5 pt-1 overflow-x-auto no-scrollbar">
              {customColors.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={p.name}
                  disabled={isOffline}
                  onClick={(e) => handleApplyColor(p, e)}
                  className={`w-6 h-6 rounded-full border-2 border-white shadow-xs shrink-0 transition-transform ${
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

      {/* Override Action Modal [PHO-043] */}
      <OverrideActionModal
        isOpen={isOverrideModalOpen}
        onClose={() => setIsOverrideModalOpen(false)}
        deviceId={device.id}
        deviceName={device.name}
        formattedTime={formattedTime}
        onOverrideChanged={(newUntil) => {
          setOverrideUntil(newUntil);
          onStateChange?.({
            ...device,
            manualOverrideUntil: newUntil,
            manualOverrideActive: Boolean(newUntil),
          });
        }}
      />
    </motion.article>
  );
};
