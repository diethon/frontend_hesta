import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { DeviceResponse } from '../../../types/device';
import {
  Snowflake,
  Power,
  Minus,
  Plus,
  Droplets,
  Sun,
  RefreshCcw,
  SlidersHorizontal,
  RotateCw,
} from 'lucide-react';
import {
  setAcPower,
  setAcTemperature,
  adjustAcTempUp,
  adjustAcTempDown,
  setAcMode,
  setAcFan,
  setAcSwing,
} from '../../../services/deviceApi';
import { notify } from '../../ui/notify';
import { getErrorMessage } from '../../../utils/errors';

interface AcCardProps {
  device: DeviceResponse;
  powerPending?: boolean;
  onTogglePower?: (deviceId: string, currentPower: string) => void;
  onClick?: (deviceId: string) => void;
  onStateChange?: (updatedDevice: DeviceResponse) => void;
}

const MODES = [
  { id: 'COOL', label: 'Lạnh', badge: 'LÀM LẠNH', icon: Snowflake },
  { id: 'DRY', label: 'Hút ẩm', badge: 'HÚT ẨM', icon: Droplets },
  { id: 'HEAT', label: 'Sưởi', badge: 'SƯỞI ẤM', icon: Sun },
  { id: 'AUTO', label: 'Tự động', badge: 'TỰ ĐỘNG', icon: RefreshCcw },
];

const FAN_SPEEDS = [
  { id: 'AUTO', label: 'Tự động' },
  { id: 'LOW', label: 'Thấp' },
  { id: 'MID', label: 'Vừa' },
  { id: 'HIGH', label: 'Cao' },
];

// Helper: Convert polar degrees to SVG cartesian coordinates
const polarToCartesian = (
  cx: number,
  cy: number,
  r: number,
  angleDeg: number
) => {
  const rad = ((angleDeg - 90) * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
};

// Helper: Generate SVG arc path from startAngle to endAngle (clockwise)
const describeArc = (
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
) => {
  if (endAngle <= startAngle) return '';
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const arcSweep = endAngle - startAngle;
  const largeArcFlag = arcSweep > 180 ? '1' : '0';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
};

export const AcCard: React.FC<AcCardProps> = ({
  device,
  powerPending = false,
  onTogglePower,
  onClick,
  onStateChange,
}) => {
  const isOffline = device.status === 'OFFLINE';

  const rawPower = device.currentState?.power;
  const isPowerOn = rawPower === 'ON' || rawPower === true || rawPower === 'true';

  const [power, setPower] = useState<boolean>(isPowerOn);
  const [temperature, setTemperature] = useState<number>(
    Number(device.currentState?.temperature) || 24
  );
  const [mode, setMode] = useState<string>(
    String(device.currentState?.mode || 'COOL').toUpperCase()
  );
  const [fan, setFan] = useState<string>(
    String(device.currentState?.fan || 'AUTO').toUpperCase()
  );
  const [swing, setSwing] = useState<boolean>(
    device.currentState?.swing === true || device.currentState?.swing === 'ON'
  );
  const [isPowerBusy, setIsPowerBusy] = useState(false);

  // SVG Slider references & state
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const debounceTimerRef = useRef<number | null>(null);

  // Sync state when device prop updates from MQTT or parent
  useEffect(() => {
    setPower(isPowerOn);
    if (device.currentState?.temperature !== undefined) {
      setTemperature(Number(device.currentState.temperature) || 24);
    }
    if (device.currentState?.mode) {
      setMode(String(device.currentState.mode).toUpperCase());
    }
    if (device.currentState?.fan) {
      setFan(String(device.currentState.fan).toUpperCase());
    }
    setSwing(
      device.currentState?.swing === true || device.currentState?.swing === 'ON'
    );
  }, [device.currentState, isPowerOn]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // ── Debounced API sync for temperature ──
  const scheduleTempSync = useCallback(
    (newTemp: number) => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = window.setTimeout(async () => {
        try {
          await setAcTemperature(device.id, newTemp);
          onStateChange?.({
            ...device,
            currentState: { ...device.currentState, temperature: newTemp },
          });
        } catch (err) {
          notify.error(getErrorMessage(err, 'Lỗi cài đặt nhiệt độ'));
        }
      }, 350);
    },
    [device, onStateChange]
  );

  // ── Toggle Power ──
  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOffline || isPowerBusy || powerPending) return;

    if (onTogglePower) {
      onTogglePower(device.id, power ? 'ON' : 'OFF');
      return;
    }

    const nextPower = !power;
    setPower(nextPower);
    setIsPowerBusy(true);
    try {
      await setAcPower(device.id, nextPower);
      notify.success(nextPower ? 'Đã bật điều hòa' : 'Đã tắt điều hòa');
      onStateChange?.({
        ...device,
        currentState: { ...device.currentState, power: nextPower ? 'ON' : 'OFF' },
      });
    } catch (err) {
      setPower(!nextPower);
      notify.error(getErrorMessage(err, 'Lỗi cập nhật nguồn điều hòa'));
    } finally {
      setIsPowerBusy(false);
    }
  };

  // ── Incremental Steppers [-] [+] ──
  const handleTempDown = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOffline || !power || temperature <= 16) return;

    const nextTemp = Math.max(16, temperature - 1);
    setTemperature(nextTemp);
    try {
      await adjustAcTempDown(device.id);
      onStateChange?.({
        ...device,
        currentState: { ...device.currentState, temperature: nextTemp },
      });
    } catch (err) {
      notify.error(getErrorMessage(err, 'Lỗi giảm nhiệt độ'));
    }
  };

  const handleTempUp = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOffline || !power || temperature >= 30) return;

    const nextTemp = Math.min(30, temperature + 1);
    setTemperature(nextTemp);
    try {
      await adjustAcTempUp(device.id);
      onStateChange?.({
        ...device,
        currentState: { ...device.currentState, temperature: nextTemp },
      });
    } catch (err) {
      notify.error(getErrorMessage(err, 'Lỗi tăng nhiệt độ'));
    }
  };

  // ── Mode Change ──
  const handleModeChange = async (newMode: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOffline || !power || mode === newMode) return;

    const oldMode = mode;
    setMode(newMode);
    try {
      await setAcMode(device.id, newMode);
      notify.success(`Chế độ: ${newMode}`);
      onStateChange?.({
        ...device,
        currentState: { ...device.currentState, mode: newMode },
      });
    } catch (err) {
      setMode(oldMode);
      notify.error(getErrorMessage(err, 'Lỗi đổi chế độ'));
    }
  };

  // ── Fan Speed Change ──
  const handleFanChange = async (newFan: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOffline || !power || fan === newFan) return;

    const oldFan = fan;
    setFan(newFan);
    try {
      await setAcFan(device.id, newFan);
      notify.success(`Quạt: ${newFan}`);
      onStateChange?.({
        ...device,
        currentState: { ...device.currentState, fan: newFan },
      });
    } catch (err) {
      setFan(oldFan);
      notify.error(getErrorMessage(err, 'Lỗi đổi tốc độ quạt'));
    }
  };

  // ── Swing Toggle ──
  const handleSwingToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOffline || !power) return;

    const nextSwing = !swing;
    setSwing(nextSwing);
    try {
      await setAcSwing(device.id, nextSwing);
      notify.success(nextSwing ? 'Đã bật đảo gió' : 'Đã tắt đảo gió');
      onStateChange?.({
        ...device,
        currentState: { ...device.currentState, swing: nextSwing },
      });
    } catch (err) {
      setSwing(!nextSwing);
      notify.error(getErrorMessage(err, 'Lỗi cài đặt đảo gió'));
    }
  };

  // ── Circular Slider Geometry & Touch/Mouse Handling ──
  // Arc: starts at 225° (bottom left) and sweeps clockwise 270° to 495° (135°, bottom right)
  const START_ANGLE = 225;
  const SWEEP_ANGLE = 270;
  const END_ANGLE = START_ANGLE + SWEEP_ANGLE; // 495°
  const CX = 120;
  const CY = 120;
  const R = 90;

  const tempFraction = Math.max(0, Math.min(1, (temperature - 16) / 14));
  const currentAngle = START_ANGLE + tempFraction * SWEEP_ANGLE;
  const thumbPos = polarToCartesian(CX, CY, R, currentAngle);

  // Dynamic color calculation: cool cyan/blue (16-20°C) -> fresh teal (21-24°C) -> amber/orange (25-30°C)
  const getTempGradient = (t: number) => {
    if (t <= 20) return { start: '#38bdf8', end: '#0284c7', glow: 'rgba(2, 132, 199, 0.35)' };
    if (t <= 24) return { start: '#2dd4bf', end: '#0ea5e9', glow: 'rgba(14, 165, 233, 0.35)' };
    if (t <= 27) return { start: '#fbbf24', end: '#f59e0b', glow: 'rgba(245, 158, 11, 0.35)' };
    return { start: '#fb923c', end: '#ea580c', glow: 'rgba(234, 88, 12, 0.35)' };
  };

  const activeColors = getTempGradient(temperature);

  // Convert mouse/touch event into target temperature
  const calculateTempFromEvent = useCallback(
    (clientX: number, clientY: number): number => {
      if (!svgRef.current) return temperature;
      const rect = svgRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;

      let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      if (deg < 0) deg += 360;

      // Handle bottom 90° gap [135° to 225°]
      let normalized = deg;
      if (normalized < 225 && normalized > 135) {
        normalized = normalized < 180 ? 495 : 225;
      } else if (normalized <= 135) {
        normalized += 360;
      }

      const fraction = Math.max(0, Math.min(1, (normalized - 225) / SWEEP_ANGLE));
      const newT = Math.round(16 + fraction * 14);
      return Math.max(16, Math.min(30, newT));
    },
    [temperature, SWEEP_ANGLE]
  );

  // Pointer & Touch handlers for smooth circular interaction
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isOffline || !power) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setIsDragging(true);
    const newT = calculateTempFromEvent(e.clientX, e.clientY);
    setTemperature(newT);
    scheduleTempSync(newT);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDragging || isOffline || !power) return;
    e.stopPropagation();
    const newT = calculateTempFromEvent(e.clientX, e.clientY);
    if (newT !== temperature) {
      setTemperature(newT);
      scheduleTempSync(newT);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isDragging) {
      e.stopPropagation();
      setIsDragging(false);
      try {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        // Safe fallback
      }
    }
  };

  // Active mode and fan labels for the summary text
  const currentModeObj = MODES.find((m) => m.id === mode) || MODES[0];
  const currentFanObj = FAN_SPEEDS.find((f) => f.id === fan) || FAN_SPEEDS[0];

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(device.id)}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.(device.id)}
      className={`relative flex flex-col justify-between p-5 sm:p-6 rounded-3xl border transition-all duration-300 select-none cursor-pointer ${
        isOffline
          ? 'bg-slate-100/70 border-line/60 opacity-60 grayscale'
          : power
          ? 'bg-gradient-to-b from-white via-slate-50/50 to-sky-50/20 border-slate-200/90 shadow-[0_12px_32px_rgba(58,74,90,0.06),0_2px_6px_rgba(58,74,90,0.03)] hover:shadow-lg'
          : 'bg-gradient-to-b from-white to-slate-50/70 border-slate-200/70 shadow-xs'
      }`}
      aria-label={`${device.name} — ${power ? `${temperature}°C • ${currentModeObj.label}` : 'Đã tắt'}`}
    >
      {/* ── 1. KHUNG TIÊU ĐỀ TRÊN CÙNG (HEADER) ── */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shrink-0 ${
              isOffline
                ? 'bg-slate-200 text-slate-400'
                : power
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                : 'bg-slate-100 border border-slate-200 text-slate-400'
            }`}
          >
            <Snowflake
              className={`w-6 h-6 ${
                power && !isOffline && mode === 'COOL'
                  ? 'animate-[spin_10s_linear_infinite]'
                  : ''
              }`}
            />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-base sm:text-lg text-slate-800 leading-tight truncate">
              {device.name || 'Điều khiển Máy lạnh'}
            </h3>
            {/* Sub-text tóm tắt đồng bộ thời gian thực: 24°C • Hút ẩm • Quạt AUTO */}
            <p className="text-xs sm:text-[13px] text-slate-500 font-medium truncate mt-0.5">
              {isOffline
                ? 'Ngoại tuyến • Không phản hồi'
                : power
                ? `${temperature}°C • ${currentModeObj.label} • Quạt ${currentFanObj.label}`
                : 'Đã tắt nguồn'}
            </p>
          </div>
        </div>

        {/* Nút Cấu hình nhỏ & Nút Nguồn (Power) */}
        <div
          className="flex items-center gap-2 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            title="Chi tiết & Lịch sử"
            onClick={() => onClick?.(device.id)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-slate-200/80 transition-colors shadow-xs"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
          <button
            type="button"
            title={power ? 'Tắt điều hòa' : 'Bật điều hòa'}
            disabled={isOffline || isPowerBusy || powerPending}
            onClick={handleToggle}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
              power
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30 hover:bg-sky-600'
                : 'bg-slate-100 border border-slate-200 text-slate-400 hover:bg-slate-200 hover:text-slate-700'
            } ${powerPending ? 'animate-pulse' : 'active:scale-95'}`}
          >
            <Power className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── 2. BỘ ĐIỀU KHIỂN BÊN DƯỚI (Làm mờ khi TẮT NGUỒN) ── */}
      <div
        className={`flex flex-col items-center w-full transition-all duration-300 ${
          !power || isOffline
            ? 'opacity-40 pointer-events-none filter grayscale-[0.2]'
            : 'opacity-100'
        }`}
      >
        {/* ── 3. BỘ ĐIỀU KHIỂN TRUNG TÂM: VÒNG TRÒN (CIRCULAR THERMOSTAT) ── */}
        <div
          className="relative flex items-center justify-center w-64 h-64 my-1"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Circular Slider SVG */}
          <svg
            ref={svgRef}
            viewBox="0 0 240 240"
            className="w-full h-full touch-none select-none cursor-grab active:cursor-grabbing"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <defs>
              {/* Dynamic Gradient for the Active Slider Track */}
              <linearGradient
                id={`ac-grad-${device.id}`}
                x1="0%"
                y1="100%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor={activeColors.start} />
                <stop offset="100%" stopColor={activeColors.end} />
              </linearGradient>

              {/* Neumorphic dial drop shadow */}
              <filter id="dial-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow
                  dx="0"
                  dy="8"
                  stdDeviation="8"
                  floodColor="rgba(58, 74, 90, 0.08)"
                />
              </filter>
            </defs>

            {/* Inactive Background Arc */}
            <path
              d={describeArc(CX, CY, R, START_ANGLE, END_ANGLE)}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="12"
              strokeLinecap="round"
            />

            {/* Active Colored Progress Arc */}
            <path
              d={describeArc(CX, CY, R, START_ANGLE, currentAngle)}
              fill="none"
              stroke={`url(#ac-grad-${device.id})`}
              strokeWidth="12"
              strokeLinecap="round"
              style={{
                filter: `drop-shadow(0 0 6px ${activeColors.glow})`,
                transition: isDragging ? 'none' : 'stroke 0.3s ease',
              }}
            />

            {/* Draggable Thumb Handle */}
            <circle
              cx={thumbPos.x}
              cy={thumbPos.y}
              r="13"
              fill="#ffffff"
              stroke={activeColors.end}
              strokeWidth="4"
              className="transition-transform duration-75"
              style={{
                filter: 'drop-shadow(0 3px 6px rgba(0, 0, 0, 0.16))',
                cursor: 'pointer',
              }}
            />
          </svg>

          {/* Central Neumorphic Dial with Temperature Display & Mode Badge */}
          <div
            className="absolute flex flex-col items-center justify-center w-36 h-36 rounded-full bg-white shadow-[0_12px_28px_rgba(58,74,90,0.08),0_2px_6px_rgba(58,74,90,0.04),inset_0_2px_4px_rgba(255,255,255,1),inset_0_-2px_4px_rgba(0,0,0,0.03)] border border-slate-100 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Quick Stepper Minus Button [-] */}
            <button
              type="button"
              disabled={!power || isOffline || temperature <= 16}
              onClick={handleTempDown}
              className="absolute left-1.5 p-1 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 active:scale-90 transition-all disabled:opacity-20"
              aria-label="Giảm 1 độ"
            >
              <Minus className="w-4 h-4" />
            </button>

            {/* Center Temperature Text: "24°C" */}
            <div className="flex items-baseline justify-center select-none">
              <span className="text-4xl sm:text-5xl font-black text-slate-800 tracking-tighter">
                {temperature}
              </span>
              <span className="text-xl font-bold text-slate-400 ml-0.5">°C</span>
            </div>

            {/* Mode Badge chip underneath: e.g. "LÀM LẠNH" / "HÚT ẨM" */}
            <span
              className={`mt-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider border shadow-xs transition-colors ${
                mode === 'COOL'
                  ? 'bg-sky-50 text-sky-700 border-sky-200'
                  : mode === 'DRY'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : mode === 'HEAT'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {currentModeObj.badge}
            </span>

            {/* Quick Stepper Plus Button [+] */}
            <button
              type="button"
              disabled={!power || isOffline || temperature >= 30}
              onClick={handleTempUp}
              className="absolute right-1.5 p-1 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 active:scale-90 transition-all disabled:opacity-20"
              aria-label="Tăng 1 độ"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── 4. KHU VỰC CHỌN CHẾ ĐỘ (MODES) ── */}
        <div
          className="w-full flex items-center justify-between gap-2 mt-2"
          onClick={(e) => e.stopPropagation()}
        >
          {MODES.map((m) => {
            const Icon = m.icon;
            const isSelected = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={(e) => handleModeChange(m.id, e)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-2xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                  isSelected
                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25 border-transparent scale-102'
                    : 'bg-white border border-slate-200/80 text-slate-600 hover:text-slate-800 hover:bg-slate-50 shadow-xs'
                } active:scale-95`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── 5. KHU VỰC CHỌN QUẠT & ĐẢO GIÓ (FAN SETTINGS) ── */}
        <div
          className="w-full flex items-center justify-between gap-1.5 pt-3.5 mt-3 border-t border-slate-200/70"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Nhãn "Quạt:" */}
          <span className="text-xs sm:text-sm font-bold text-slate-600 shrink-0 pr-1">
            Quạt:
          </span>

          {/* Các nút tốc độ quạt */}
          <div className="flex items-center gap-1.5 flex-1 overflow-x-auto custom-scrollbar">
            {FAN_SPEEDS.map((f) => {
              const isSelected = fan === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={(e) => handleFanChange(f.id, e)}
                  className={`flex-1 min-w-[50px] py-1.5 px-2 rounded-xl text-xs font-semibold transition-all text-center ${
                    isSelected
                      ? 'bg-slate-700 text-white shadow-xs font-bold'
                      : 'bg-white border border-slate-200/80 text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                  } active:scale-95`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Nút chức năng "Đảo gió" (Swing) */}
          <button
            type="button"
            title="Đảo gió tự động"
            onClick={handleSwingToggle}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all shrink-0 border ${
              swing
                ? 'bg-sky-500 text-white border-sky-500 shadow-xs'
                : 'bg-white border-slate-200/80 text-slate-600 hover:text-slate-800 hover:bg-slate-50'
            } active:scale-95`}
          >
            <RotateCw className={`w-3.5 h-3.5 ${swing ? 'animate-spin' : ''}`} />
            <span>Đảo gió</span>
          </button>
        </div>
      </div>
    </article>
  );
};
