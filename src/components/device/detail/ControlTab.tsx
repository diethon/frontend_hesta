import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { HexColorPicker } from 'react-colorful';
import {
  Thermometer,
  Droplets,
  Sun,
  Activity,
  Flame,
  ShieldAlert,
  Wind,
  Battery,
  Radio,
  Gauge,
  Snowflake,
  Sparkles,
  RefreshCw,
  Clock,
  X,
  Minus,
  Plus,
  VolumeX,
  Volume1,
  Volume2,
  Tv,
  Home,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Undo2,
  Menu,
} from 'lucide-react';
import { Icon } from '../../home/HomeIcons';
import { DeviceVisual } from '../DeviceVisual';
import {
  sendDeviceCommand,
  updateDeviceConfig,
  setAcTemperature,
  setAcMode as setAcModeApi,
  setAcFan as setAcFanApi,
  setAcSwing as setAcSwingApi,
  setAcTimer,
  cancelAcTimer,
} from '../../../services/deviceApi';
import { notify } from '../../ui/notify';
import {
  resolveDeviceRgb,
  rgbToHex,
  APERTURE_TRANSIT_LOCK_MS,
  getApertureInterlock,
  isRgbLightDevice,
  isFanDevice,
  isTvDevice,
  isWaterPumpDevice,
  isDoorDevice,
  extractSensorMetrics,
  resolveFanSpeedLevel,
  AC_MODE_LABEL_TO_CODE,
  AC_FAN_LABEL_TO_CODE,
  AC_FAN_CODE_TO_LABEL,
} from '../deviceHelpers';
import type { FigmaDeviceType, CustomColorItem, DetailDeviceInput } from './detailTypes';
import { lightColors, hexToRgb } from './detailTypes';
import type { DeviceStateHistoryResponse } from '../../../types/device';

export interface ControlTabProps {
  device: DetailDeviceInput;
  resolvedType: FigmaDeviceType;
  disabled: boolean;
  isOn: boolean;
  onTogglePower?: () => void;
  onBrightnessChange?: (brightness: number) => void;
  onColorChange?: (r: number, g: number, b: number) => void;
  lightLevel: number;
  setLightLevel: (level: number) => void;
  acTemp: number;
  setAcTemp: (temp: number) => void;
  acMode: string;
  setAcMode: (mode: string) => void;
  gateState: string;
  setGateState: (state: string) => void;
  historyData?: DeviceStateHistoryResponse[];
}

function SegmentedControl({
  items,
  value,
  setValue,
  disabled = false,
  disabledItems,
}: {
  items: string[];
  value: string;
  setValue: (value: string) => void;
  disabled?: boolean;
  disabledItems?: ReadonlySet<string>;
}) {
  return (
    <div className="detail-segments">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          disabled={disabled || Boolean(disabledItems?.has(item))}
          className={item === value ? 'active' : ''}
          onClick={() => setValue(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

const AC_MIN_TEMP = 16;
const AC_MAX_TEMP = 32;
const AC_START_DEG = 150;
const AC_SWEEP_DEG = 240;
const AC_CX = 120;
const AC_CY = 114;
const AC_R = 84;

interface AcModeTheme {
  from: string;
  to: string;
  glow: string;
  badgeClass: string;
  activeBtnClass: string;
  idleBtnClass: string;
  iconColorClass: string;
  IconComp: React.ComponentType<{ size?: number; className?: string }>;
}

const AC_MODE_THEMES: Record<string, AcModeTheme> = {
  'Lạnh': {
    from: '#38bdf8',
    to: '#0284c7',
    glow: 'rgba(14, 165, 233, 0.32)',
    badgeClass: 'border-sky-500/35 bg-sky-500/12 text-sky-600 dark:text-sky-400',
    activeBtnClass: 'border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300 shadow-xs ring-1 ring-sky-500/30',
    idleBtnClass: 'border-sky-500/25 bg-[var(--solid)] text-[var(--text)] hover:border-sky-500/45 hover:bg-sky-500/10',
    iconColorClass: 'text-sky-500',
    IconComp: Snowflake,
  },
  'Hút ẩm': {
    from: '#2dd4bf',
    to: '#0d9488',
    glow: 'rgba(20, 184, 166, 0.32)',
    badgeClass: 'border-teal-500/35 bg-teal-500/12 text-teal-600 dark:text-teal-400',
    activeBtnClass: 'border-teal-500 bg-teal-500/15 text-teal-700 dark:text-teal-300 shadow-xs ring-1 ring-teal-500/30',
    idleBtnClass: 'border-teal-500/25 bg-[var(--solid)] text-[var(--text)] hover:border-teal-500/45 hover:bg-teal-500/10',
    iconColorClass: 'text-teal-500',
    IconComp: Droplets,
  },
  'Sưởi': {
    from: '#fb923c',
    to: '#ea580c',
    glow: 'rgba(249, 115, 22, 0.32)',
    badgeClass: 'border-orange-500/35 bg-orange-500/12 text-orange-600 dark:text-orange-400',
    activeBtnClass: 'border-orange-500 bg-orange-500/15 text-orange-700 dark:text-orange-300 shadow-xs ring-1 ring-orange-500/30',
    idleBtnClass: 'border-orange-500/25 bg-[var(--solid)] text-[var(--text)] hover:border-orange-500/45 hover:bg-orange-500/10',
    iconColorClass: 'text-orange-500',
    IconComp: Flame,
  },
  'Tự động': {
    from: '#818cf8',
    to: '#4f46e5',
    glow: 'rgba(99, 102, 241, 0.32)',
    badgeClass: 'border-indigo-500/35 bg-indigo-500/12 text-indigo-600 dark:text-indigo-400',
    activeBtnClass: 'border-indigo-500 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 shadow-xs ring-1 ring-indigo-500/30',
    idleBtnClass: 'border-indigo-500/25 bg-[var(--solid)] text-[var(--text)] hover:border-indigo-500/45 hover:bg-indigo-500/10',
    iconColorClass: 'text-indigo-500',
    IconComp: Sparkles,
  },
};

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const clampedEnd = Math.max(startDeg + 0.01, endDeg);
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, clampedEnd);
  const largeArcFlag = clampedEnd - startDeg <= 180 ? '0' : '1';
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

interface AcArcDialProps {
  uid: string;
  value: number;
  mode: string;
  disabled: boolean;
  isOn: boolean;
  onPreviewChange: (nextTemp: number) => void;
  onCommitChange: (nextTemp: number) => void;
  onStep: (delta: number) => void;
}

function AcArcDial({
  uid,
  value,
  mode,
  disabled,
  isOn,
  onPreviewChange,
  onCommitChange,
  onStep,
}: AcArcDialProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const draggingRef = useRef(false);
  const clampedValue = Math.max(AC_MIN_TEMP, Math.min(AC_MAX_TEMP, Math.round(value)));
  const latestTempRef = useRef(clampedValue);
  const [isDragging, setIsDragging] = useState(false);

  const theme = AC_MODE_THEMES[mode] ?? AC_MODE_THEMES['Lạnh'];
  const ModeIcon = theme.IconComp;
  const interactive = isOn && !disabled;

  const ratio = (clampedValue - AC_MIN_TEMP) / (AC_MAX_TEMP - AC_MIN_TEMP);
  const activeDeg = AC_START_DEG + ratio * AC_SWEEP_DEG;
  const trackPath = describeArc(AC_CX, AC_CY, AC_R, AC_START_DEG, AC_START_DEG + AC_SWEEP_DEG);
  const activePath =
    ratio > 0 ? describeArc(AC_CX, AC_CY, AC_R, AC_START_DEG, activeDeg) : '';
  const thumbPos = polarToCartesian(AC_CX, AC_CY, AC_R, activeDeg);
  const minLabelPos = polarToCartesian(AC_CX, AC_CY, AC_R + 18, AC_START_DEG - 8);
  const maxLabelPos = polarToCartesian(AC_CX, AC_CY, AC_R + 18, AC_START_DEG + AC_SWEEP_DEG + 8);
  const safeUid = uid.replace(/[^a-zA-Z0-9_-]/g, '');

  const clientToTemp = useCallback((clientX: number, clientY: number) => {
    const svgEl = svgRef.current;
    if (!svgEl) return latestTempRef.current;
    const rect = svgEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return latestTempRef.current;
    const x = ((clientX - rect.left) / rect.width) * 240;
    const y = ((clientY - rect.top) / rect.height) * 206;
    const rawDeg = (Math.atan2(y - AC_CY, x - AC_CX) * 180) / Math.PI;
    const normDeg = (rawDeg + 360) % 360;
    let rel = (normDeg - AC_START_DEG + 360) % 360;
    if (rel > AC_SWEEP_DEG) {
      rel = rel < AC_SWEEP_DEG + 60 ? AC_SWEEP_DEG : 0;
    }
    const next = Math.round(AC_MIN_TEMP + (rel / AC_SWEEP_DEG) * (AC_MAX_TEMP - AC_MIN_TEMP));
    return Math.max(AC_MIN_TEMP, Math.min(AC_MAX_TEMP, next));
  }, []);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!interactive) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    draggingRef.current = true;
    setIsDragging(true);
    const next = clientToTemp(e.clientX, e.clientY);
    latestTempRef.current = next;
    onPreviewChange(next);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current || !interactive) return;
    const next = clientToTemp(e.clientX, e.clientY);
    if (next !== latestTempRef.current) {
      latestTempRef.current = next;
      onPreviewChange(next);
    }
  };

  const handlePointerFinish = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (interactive) {
      onCommitChange(latestTempRef.current);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (!interactive) return;
    let next: number | null = null;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(AC_MIN_TEMP, clampedValue - 1);
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(AC_MAX_TEMP, clampedValue + 1);
    else if (e.key === 'Home') next = AC_MIN_TEMP;
    else if (e.key === 'End') next = AC_MAX_TEMP;
    if (next !== null) {
      e.preventDefault();
      latestTempRef.current = next;
      onCommitChange(next);
    }
  };

  const ticks = Array.from({ length: AC_MAX_TEMP - AC_MIN_TEMP + 1 }, (_, i) => {
    const tDeg = AC_START_DEG + (i / (AC_MAX_TEMP - AC_MIN_TEMP)) * AC_SWEEP_DEG;
    const isMajor = i % 4 === 0;
    const p1 = polarToCartesian(AC_CX, AC_CY, AC_R - (isMajor ? 16 : 13), tDeg);
    const p2 = polarToCartesian(AC_CX, AC_CY, AC_R - 9, tDeg);
    const lit = AC_MIN_TEMP + i <= clampedValue;
    return { i, p1, p2, isMajor, lit };
  });

  return (
    <div className="ac-arc-dial-wrap">
      <div className="ac-arc-stage">
        <svg
          ref={svgRef}
          viewBox="0 0 240 206"
          role="slider"
          tabIndex={interactive ? 0 : -1}
          aria-label="Nhiệt độ điều hòa"
          aria-valuemin={AC_MIN_TEMP}
          aria-valuemax={AC_MAX_TEMP}
          aria-valuenow={clampedValue}
          aria-valuetext={`${clampedValue}°C`}
          data-ac-arc-dial="true"
          className={`ac-arc-svg ${isDragging ? 'dragging' : ''} ${interactive ? '' : 'disabled'}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerFinish}
          onPointerCancel={handlePointerFinish}
          onKeyDown={handleKeyDown}
        >
          <defs>
            <linearGradient id={`ac-arc-grad-${safeUid}`} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={theme.from} />
              <stop offset="100%" stopColor={theme.to} />
            </linearGradient>
          </defs>

          {/* Scale ticks inside the arc */}
          {ticks.map((tk) => (
            <line
              key={tk.i}
              x1={tk.p1.x}
              y1={tk.p1.y}
              x2={tk.p2.x}
              y2={tk.p2.y}
              stroke={tk.lit && isOn ? theme.to : 'currentColor'}
              strokeOpacity={tk.lit && isOn ? (tk.isMajor ? 0.65 : 0.35) : (tk.isMajor ? 0.25 : 0.14)}
              strokeWidth={tk.isMajor ? 2 : 1.25}
              strokeLinecap="round"
            />
          ))}

          {/* Background track arc */}
          <path
            d={trackPath}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.14}
            strokeWidth={14}
            strokeLinecap="round"
          />

          {/* Soft glow under active arc */}
          {activePath && isOn && (
            <path
              d={activePath}
              fill="none"
              stroke={`url(#ac-arc-grad-${safeUid})`}
              strokeOpacity={0.22}
              strokeWidth={22}
              strokeLinecap="round"
            />
          )}

          {/* Active temperature progress arc */}
          {activePath && (
            <path
              d={activePath}
              fill="none"
              stroke={isOn ? `url(#ac-arc-grad-${safeUid})` : '#94a3b8'}
              strokeWidth={14}
              strokeLinecap="round"
            />
          )}

          {/* Endpoint labels */}
          <text
            x={minLabelPos.x}
            y={minLabelPos.y + 4}
            textAnchor="middle"
            fontSize="10"
            fontWeight="700"
            fill="currentColor"
            fillOpacity={0.55}
          >
            {AC_MIN_TEMP}°
          </text>
          <text
            x={maxLabelPos.x}
            y={maxLabelPos.y + 4}
            textAnchor="middle"
            fontSize="10"
            fontWeight="700"
            fill="currentColor"
            fillOpacity={0.55}
          >
            {AC_MAX_TEMP}°
          </text>

          {/* Draggable thumb handle */}
          <circle
            cx={thumbPos.x}
            cy={thumbPos.y}
            r={isDragging ? 13 : 11}
            fill="#ffffff"
            stroke={isOn ? theme.to : '#94a3b8'}
            strokeWidth={3.5}
          />
          <circle
            cx={thumbPos.x}
            cy={thumbPos.y}
            r={4}
            fill={isOn ? theme.to : '#94a3b8'}
          />
        </svg>

        <div className="ac-arc-center">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${theme.badgeClass}`}
          >
            <ModeIcon size={12} />
            {mode}
          </span>
          <strong>{clampedValue}°C</strong>
          <small className="text-[11px] text-[var(--secondary)] mt-1">
            {isOn ? 'Kéo vòng cung hoặc bấm ±' : 'Điều hòa đang tắt'}
          </small>
        </div>
      </div>

      <div className="flex items-center justify-between w-full max-w-[228px] px-1">
        <button
          type="button"
          disabled={!interactive || clampedValue <= AC_MIN_TEMP}
          onClick={() => onStep(-1)}
          aria-label="Giảm nhiệt độ"
          className="w-10 h-10 rounded-xl border border-sky-500/55 bg-sky-500/12 text-black flex items-center justify-center hover:bg-sky-500/20 active:scale-95 transition disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
        >
          <Minus size={18} />
        </button>
        <span className="px-3 py-1 rounded-full border border-[#cbd5e1] bg-white text-[11px] font-bold text-[#0f172a] tabular-nums">
          {AC_MIN_TEMP}° – {AC_MAX_TEMP}°C
        </span>
        <button
          type="button"
          disabled={!interactive || clampedValue >= AC_MAX_TEMP}
          onClick={() => onStep(1)}
          aria-label="Tăng nhiệt độ"
          className="w-10 h-10 rounded-xl border border-orange-500/55 bg-orange-500/12 text-black flex items-center justify-center hover:bg-orange-500/20 active:scale-95 transition disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
}

function DetailToggle({
  on,
  setOn,
  disabled = false,
}: {
  on: boolean;
  setOn: (on: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`toggle ${on ? 'active' : ''}`}
      onClick={() => setOn(!on)}
      aria-pressed={on}
    >
      <span />
    </button>
  );
}

function DetailAccordion({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="detail-accordion">
      <summary>
        {title}
        <Icon name="chevronDown" size={17} />
      </summary>
      <div>{children}</div>
    </details>
  );
}

function PillSlider({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <div className="light-pill-slider">
      <span style={{ width: `${value}%` }} />
      <i style={{ left: `calc(${value}% - 14px)` }} />
      <b>{value}%</b>
      <input
        aria-label={label}
        type="range"
        min="1"
        max="100"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function LightPowerPreview({
  uid,
  isRgb = false,
  on,
  level,
  disabled,
  color,
  onToggle,
}: {
  uid?: string;
  isRgb?: boolean;
  on: boolean;
  level: number;
  disabled: boolean;
  color?: string;
  onToggle: () => void;
}) {
  const activeBgStyle = on
    ? isRgb && color
      ? {
          background: `color-mix(in srgb, ${color} 18%, transparent)`,
          boxShadow: `0 0 36px color-mix(in srgb, ${color} 45%, transparent)`,
        }
      : {
          background: 'rgba(251, 191, 36, 0.16)',
          boxShadow: `0 0 32px rgba(245, 158, 11, ${(0.22 + (level / 100) * 0.28).toFixed(2)})`,
        }
    : undefined;

  return (
    <section className={`light-power-preview ${on ? 'on' : 'off'}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        aria-label={on ? 'Tắt đèn' : 'Bật đèn'}
        style={activeBgStyle}
      >
        <DeviceVisual
          uid={uid ? `preview-${uid}` : 'preview-light'}
          deviceType={isRgb ? 'LED_RGB' : 'LIGHT'}
          figmaType="Đèn"
          isOn={on}
          offline={disabled && !on}
          brightness={level}
          rgbColor={isRgb ? color : undefined}
          size={112}
        />
      </button>
      <strong>{on ? `Đang bật · ${level}%` : 'Đang tắt'}</strong>
      <small>{on ? 'Chạm để tắt' : 'Chạm để bật'}</small>
    </section>
  );
}

function ColorCreationSheet({
  currentColor,
  editColor,
  onClose,
  onSave,
}: {
  currentColor: string;
  editColor?: CustomColorItem | null;
  onClose: () => void;
  onSave: (name: string, color: string, id?: string) => void;
}) {
  const [color, setColor] = useState(() => editColor?.hex || currentColor || '#f5d6a0');
  const [name, setName] = useState(() => editColor?.name || '');

  const handleSave = () => {
    if (!name.trim()) return;
    const cleanHex = color.startsWith('#') ? color : `#${color}`;
    onSave(name.trim(), cleanHex, editColor?.id);
    onClose();
  };

  return (
    <div className="color-sheet-layer">
      <button
        type="button"
        className="color-sheet-scrim"
        onClick={onClose}
        aria-label="Đóng"
      />
      <section className="color-creation-sheet glass-g2">
        <div className="sheet-handle" />
        <header>
          <strong>{editColor ? 'Chỉnh sửa màu' : 'Thêm màu mới'}</strong>
        </header>
        <div className="color-sheet-content">
          <div className="color-sheet-preview">
            <span style={{ background: color }}>
              <Icon name="lamp" size={26} />
            </span>
            <strong>{color.toUpperCase()}</strong>
            <small>Xem trước</small>
          </div>

          <div className="custom-color-picker-wrap">
            <HexColorPicker
              color={color.startsWith('#') && color.length === 7 ? color : '#f5d6a0'}
              onChange={setColor}
            />
          </div>

          <div className="custom-color">
            <label>
              Mã màu HEX{' '}
              <input
                value={color.toUpperCase()}
                onChange={(event) => setColor(event.target.value)}
                placeholder="#FFFFFF"
              />
            </label>
            <button
              type="button"
              className="use-current"
              onClick={() => setColor(currentColor)}
            >
              Dùng màu hiện tại
            </button>
          </div>

          <div className="quick-color-swatches flex gap-2 overflow-x-auto py-1">
            {lightColors.map((c) => (
              <button
                key={c}
                type="button"
                style={{ background: c }}
                title={`Chọn ${c}`}
                className={`w-7 h-7 rounded-full shrink-0 border border-black/10 transition-transform ${
                  color.toLowerCase() === c.toLowerCase() ? 'scale-110 ring-2 ring-blue-500' : ''
                }`}
                onClick={() => setColor(c)}
              />
            ))}
          </div>

          <label className="color-name-field">
            <span>
              Tên màu <small>{name.length}/20</small>
            </span>
            <input
              maxLength={20}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="VD: Chơi game, Đêm muộn, Cà phê"
              autoFocus
            />
          </label>
        </div>
        <footer>
          <button type="button" onClick={onClose}>
            Hủy
          </button>
          <button type="button" disabled={!name.trim()} onClick={handleSave}>
            Lưu màu
          </button>
        </footer>
      </section>
    </div>
  );
}

function SavedColors({
  saved,
  disabled,
  onApply,
  onAddClick,
  onEditClick,
  onDeleteClick,
}: {
  saved: CustomColorItem[];
  disabled: boolean;
  onApply: (color: string) => void;
  onAddClick: () => void;
  onEditClick: (item: CustomColorItem) => void;
  onDeleteClick: (item: CustomColorItem) => void;
}) {
  const [menu, setMenu] = useState<string | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<CustomColorItem | null>(null);

  const handleDelete = () => {
    if (deleteConfirmItem) {
      onDeleteClick(deleteConfirmItem);
      setDeleteConfirmItem(null);
      setMenu(null);
    }
  };

  return (
    <section
      className={`detail-section light-disableable ${
        disabled ? 'disabled' : ''
      }`}
    >
      <div className="saved-color-heading">
        <h3>Màu đã lưu</h3>
        <small>{`${saved.length}/12`}</small>
      </div>
      {saved.length === 0 && <p className="saved-empty">Chưa có màu nào được lưu</p>}
      <div className="named-colors">
        {saved.map((item) => (
          <span className="named-color-wrap" key={item.id || item.name}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                onApply(item.hex);
                setMenu(menu === item.id ? null : item.id);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                setMenu(item.id);
              }}
            >
              <i style={{ background: item.hex }} />
              {item.name}
              {menu === item.id && <b>⋯</b>}
            </button>
            {menu === item.id && (
              <span className="saved-color-menu glass-g2">
                <button
                  type="button"
                  onClick={() => {
                    onEditClick(item);
                    setMenu(null);
                  }}
                >
                  Đổi màu
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    setDeleteConfirmItem(item);
                    setMenu(null);
                  }}
                >
                  Xóa
                </button>
              </span>
            )}
          </span>
        ))}
        <button
          type="button"
          disabled={disabled || saved.length >= 12}
          className="named-add-color"
          onClick={onAddClick}
        >
          + Thêm màu
        </button>
      </div>
      {saved.length >= 12 && (
        <small className="saved-limit">Đã đủ 12 màu · Xóa bớt để thêm</small>
      )}
      {deleteConfirmItem && (
        <span className="saved-delete-confirm glass-g2">
          <strong>Xóa màu “{deleteConfirmItem.name}”?</strong>
          <small>Thao tác này không thể hoàn tác.</small>
          <span>
            <button type="button" onClick={() => setDeleteConfirmItem(null)}>
              Hủy
            </button>
            <button type="button" className="danger" onClick={handleDelete}>
              Xóa
            </button>
          </span>
        </span>
      )}
    </section>
  );
}

export const ControlTab: React.FC<ControlTabProps> = ({
  device,
  resolvedType,
  disabled,
  isOn,
  onTogglePower,
  onBrightnessChange,
  onColorChange,
  lightLevel,
  setLightLevel,
  acTemp,
  setAcTemp,
  acMode,
  setAcMode,
  gateState,
  setGateState,
  historyData,
}) => {
  // ──────────────────────────────────────────────────────────────────────────
  // Light Specific State
  // ──────────────────────────────────────────────────────────────────────────
  const [lightTab, setLightTab] = useState('Gợi ý');
  const rawLightState = device?.raw?.currentState || device?.currentState;
  const resolvedLightRgb = resolveDeviceRgb(rawLightState);
  const resolvedRgbHex = resolvedLightRgb
    ? rgbToHex(resolvedLightRgb.r, resolvedLightRgb.g, resolvedLightRgb.b)
    : null;
  const [selectedColor, setSelectedColor] = useState(() => resolvedRgbHex ?? lightColors[0] ?? '#f5d6a0');
  const [prevRgbHex, setPrevRgbHex] = useState<string | null>(resolvedRgbHex);
  if (resolvedRgbHex !== prevRgbHex) {
    setPrevRgbHex(resolvedRgbHex);
    if (resolvedRgbHex) {
      setSelectedColor(resolvedRgbHex);
    }
  }

  const devId = device?.realDeviceId || device?.id;
  const storageKey = devId ? `hesta_custom_colors_${devId}` : null;

  const [savedColors, setSavedColors] = useState<CustomColorItem[]>(() => {
    const fromSettings = device?.raw?.settings?.customColors || device?.settings?.customColors;
    if (Array.isArray(fromSettings) && fromSettings.length > 0) {
      return (fromSettings as Partial<CustomColorItem>[]).map((item, idx: number) => ({
        id: item.id || `preset-${idx}`,
        name: item.name || 'Màu tùy chỉnh',
        hex: item.hex || (item.rgb ? rgbToHex(item.rgb[0], item.rgb[1], item.rgb[2]) : lightColors[0] || '#ffffff'),
        rgb: item.rgb || hexToRgb(item.hex || lightColors[0] || '#ffffff'),
      }));
    }
    if (storageKey) {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {
        console.warn('Failed to parse cached custom colors:', e);
      }
    }
    return [
      { id: 'p1', name: 'Chơi game', hex: lightColors[2] || '#d9b8f4', rgb: hexToRgb(lightColors[2] || '#d9b8f4') },
      { id: 'p2', name: 'Đêm muộn', hex: lightColors[3] || '#91b8f1', rgb: hexToRgb(lightColors[3] || '#91b8f1') },
      { id: 'p3', name: 'Cà phê', hex: lightColors[0] || '#f5d6a0', rgb: hexToRgb(lightColors[0] || '#f5d6a0') },
      { id: 'p4', name: 'Thư giãn', hex: lightColors[4] || '#9ed9c2', rgb: hexToRgb(lightColors[4] || '#9ed9c2') },
    ];
  });

  const [colorSheet, setColorSheet] = useState<{
    mode: 'add' | 'edit';
    item?: CustomColorItem;
  } | null>(null);

  const persistCustomColors = async (newList: CustomColorItem[]) => {
    setSavedColors(newList);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(newList));
      } catch (e) {
        console.warn('Failed to store custom colors locally:', e);
      }
    }
    if (devId) {
      try {
        const existingSettings = device?.raw?.settings || device?.settings || {};
        await updateDeviceConfig(devId, {
          name: device.name,
          settings: {
            ...existingSettings,
            customColors: newList,
          },
        });
      } catch (err) {
        console.warn('Failed to persist custom colors to backend:', err);
      }
    }
  };

  const handleSaveColor = async (name: string, hex: string, id?: string) => {
    let updated: CustomColorItem[];
    if (id) {
      updated = savedColors.map((c) => (c.id === id ? { ...c, name, hex, rgb: hexToRgb(hex) } : c));
    } else {
      const generatedId = `color-${savedColors.length + 1}-${name.toLowerCase().replace(/\s+/g, '-')}`;
      const newItem: CustomColorItem = {
        id: generatedId,
        name,
        hex,
        rgb: hexToRgb(hex),
      };
      updated = [...savedColors, newItem];
    }
    await persistCustomColors(updated);
    handleApplyColor(hex);
    notify.success(`Đã lưu màu "${name}"`);
  };

  const handleDeleteColor = async (item: CustomColorItem) => {
    const updated = savedColors.filter((c) => c.id !== item.id);
    await persistCustomColors(updated);
    notify.info(`Đã xóa màu "${item.name}"`);
  };

  const colorDebounceRef = useRef<number | null>(null);
  const latestColorRef = useRef<string>(selectedColor);

  useEffect(() => {
    latestColorRef.current = selectedColor;
  }, [selectedColor]);

  useEffect(() => {
    return () => {
      if (colorDebounceRef.current) window.clearTimeout(colorDebounceRef.current);
    };
  }, []);

  const isRgbLight = isRgbLightDevice(device);

  const emitColorChange = useCallback((hex: string) => {
    if (disabled || !isRgbLight) return;
    const clean = hex.replace('#', '');
    if (clean.length === 6) {
      const num = parseInt(clean, 16);
      const r = (num >> 16) & 255;
      const g = (num >> 8) & 255;
      const b = num & 255;
      if (onColorChange) {
        onColorChange(r, g, b);
      } else {
        const targetId = device?.realDeviceId || device?.id;
        if (targetId) {
          sendDeviceCommand(targetId, 'SET_RGB', {
            r,
            g,
            b,
            brightness: lightLevel || 80,
          }).catch(console.warn);
        }
      }
    }
  }, [disabled, isRgbLight, onColorChange, device, lightLevel]);

  const handlePickerChange = (newHex: string) => {
    if (disabled || !isRgbLight) return;
    setSelectedColor(newHex);
    latestColorRef.current = newHex;

    if (colorDebounceRef.current) {
      window.clearTimeout(colorDebounceRef.current);
    }
    colorDebounceRef.current = window.setTimeout(() => {
      emitColorChange(newHex);
    }, 60);
  };

  const handlePointerUp = () => {
    if (disabled || !isRgbLight) return;
    if (colorDebounceRef.current) {
      window.clearTimeout(colorDebounceRef.current);
    }
    emitColorChange(latestColorRef.current);
  };

  const handleApplyColor = (hex: string) => {
    if (disabled || !isRgbLight) return;
    setSelectedColor(hex);
    latestColorRef.current = hex;
    if (colorDebounceRef.current) {
      window.clearTimeout(colorDebounceRef.current);
    }
    emitColorChange(hex);
  };

  const handleLevel = (val: number) => {
    if (disabled) return;
    setLightLevel(val);
    onBrightnessChange?.(val);
  };

  const lightControlsDisabled = disabled || !isOn;

  // ──────────────────────────────────────────────────────────────────────────
  // AC Specific State & Handlers
  // ──────────────────────────────────────────────────────────────────────────
  const rawInitialFan = String(device?.raw?.currentState?.fanSpeed ?? device?.raw?.currentState?.fan ?? device?.currentState?.fanSpeed ?? 'AUTO').toUpperCase();
  const initialFan = AC_FAN_CODE_TO_LABEL[rawInitialFan] ?? (String(device?.raw?.currentState?.fanSpeed || 'Tự động'));
  const initialSwing = Boolean(device?.raw?.currentState?.swing ?? device?.currentState?.swing ?? false);

  const [acFan, setAcFanState] = useState(initialFan);
  const [acSwing, setAcSwingState] = useState(initialSwing);

  const [prevAcFan, setPrevAcFan] = useState(initialFan);
  if (initialFan !== prevAcFan) {
    setPrevAcFan(initialFan);
    setAcFanState(initialFan);
  }

  const [prevAcSwing, setPrevAcSwing] = useState(initialSwing);
  if (initialSwing !== prevAcSwing) {
    setPrevAcSwing(initialSwing);
    setAcSwingState(initialSwing);
  }

  const handleAcTemp = (delta: number) => {
    if (disabled) return;
    const next = Math.max(16, Math.min(32, acTemp + delta));
    setAcTemp(next);
    const targetId = device?.realDeviceId || device?.id;
    if (targetId) {
      setAcTemperature(targetId, next).catch(console.warn);
    }
  };

  const handleAcTempPreview = (targetTemp: number) => {
    if (disabled || !isOn) return;
    const next = Math.max(16, Math.min(32, Math.round(targetTemp)));
    setAcTemp(next);
  };

  const handleAcTempCommit = (targetTemp: number) => {
    if (disabled || !isOn) return;
    const next = Math.max(16, Math.min(32, Math.round(targetTemp)));
    setAcTemp(next);
    const targetId = device?.realDeviceId || device?.id;
    if (targetId) {
      setAcTemperature(targetId, next).catch(console.warn);
    }
  };

  const handleAcModeChange = (m: string) => {
    if (disabled) return;
    setAcMode(m);
    const targetId = device?.realDeviceId || device?.id;
    if (targetId) {
      const code = AC_MODE_LABEL_TO_CODE[m] ?? m.toUpperCase();
      setAcModeApi(targetId, code).catch(console.warn);
    }
  };

  const handleAcFanChange = (fan: string) => {
    if (disabled) return;
    setAcFanState(fan);
    const targetId = device?.realDeviceId || device?.id;
    if (targetId) {
      const code = AC_FAN_LABEL_TO_CODE[fan] ?? fan.toUpperCase();
      setAcFanApi(targetId, code).catch(console.warn);
    }
  };

  const handleAcSwingChange = (swing: boolean) => {
    if (disabled) return;
    setAcSwingState(swing);
    const targetId = device?.realDeviceId || device?.id;
    if (targetId) {
      setAcSwingApi(targetId, swing).catch(console.warn);
    }
  };

  // Fan & TV & Gate Calibration Helpers
  const isFan = isFanDevice(device);
  const isTv = isTvDevice(device);
  const isPump = isWaterPumpDevice(device);
  const isDoor = isDoorDevice(device);
  const curRawState = (device?.raw?.currentState || device?.currentState || {}) as Record<string, unknown>;
  const initialFanSpeed = isOn ? resolveFanSpeedLevel(curRawState) : 0;
  const [fanSpeedLevel, setFanSpeedLevel] = useState<0 | 1 | 2 | 3>(initialFanSpeed);
  const [prevFanSpeed, setPrevFanSpeed] = useState<0 | 1 | 2 | 3>(initialFanSpeed);
  if (initialFanSpeed !== prevFanSpeed) {
    setPrevFanSpeed(initialFanSpeed);
    setFanSpeedLevel(initialFanSpeed);
  }

  const handleFanSpeedSelect = (label: string) => {
    if (disabled) return;
    const targetId = device?.realDeviceId || device?.id;
    if (label === 'Tắt') {
      const prevLevel = fanSpeedLevel;
      setFanSpeedLevel(0);
      if (isOn) onTogglePower?.();
      else if (targetId) {
        sendDeviceCommand(targetId, 'TURN_OFF')
          .then((res) => {
            if (res && res.success === false) {
              setFanSpeedLevel(prevLevel);
              notify.error(res.message || 'Không thể tắt quạt');
            }
          })
          .catch(() => {
            setFanSpeedLevel(prevLevel);
            notify.error('Không thể tắt quạt');
          });
      }
      return;
    }
    const prevLevel = fanSpeedLevel;
    const lvl = label.includes('1') ? 1 : label.includes('2') ? 2 : 3;
    setFanSpeedLevel(lvl);
    if (targetId) {
      sendDeviceCommand(targetId, 'SET_SPEED', { speed: lvl })
        .then((res) => {
          if (res && res.success === false) {
            setFanSpeedLevel(prevLevel);
            notify.error(res.message || 'Không thể chỉnh tốc độ quạt');
            return;
          }
          notify.success(`Tốc độ quạt: Mức ${lvl}`);
        })
        .catch(() => {
          setFanSpeedLevel(prevLevel);
          notify.error('Không thể chỉnh tốc độ quạt');
        });
    }
  };

  const handleTvCommand = (action: string, label?: string) => {
    if (disabled) return;
    const targetId = device?.realDeviceId || device?.id;
    if (!targetId) return;
    sendDeviceCommand(targetId, action)
      .then((res) => {
        if (res && res.success === false) {
          notify.error(res.message || `Không thể gửi lệnh ${label || action}`);
          return;
        }
        if (label) notify.success(`TV: ${label}`);
      })
      .catch(() => notify.error(`Không thể gửi lệnh ${label || action}`));
  };

  const [openDurationSec, setOpenDurationSec] = useState(3);
  const [closeDurationSec, setCloseDurationSec] = useState(3);
  const [motorSpeedVal, setMotorSpeedVal] = useState(220);

  // ──────────────────────────────────────────────────────────────────────────
  // Gate Specific State & Handlers
  // ──────────────────────────────────────────────────────────────────────────
  const rawGateState = String(device?.raw?.currentState?.state ?? device?.currentState?.state ?? '').toUpperCase();
  const [gateTransitLocked, setGateTransitLocked] = useState(false);
  const gateTransitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (rawGateState === 'OPEN' || rawGateState === 'CLOSED' || rawGateState === 'STOPPED') {
      if (gateTransitTimerRef.current) {
        clearTimeout(gateTransitTimerRef.current);
        gateTransitTimerRef.current = null;
      }
      setGateTransitLocked(false);
    }
  }, [rawGateState]);

  useEffect(() => () => {
    if (gateTransitTimerRef.current) clearTimeout(gateTransitTimerRef.current);
  }, []);

  const gateInterlock = getApertureInterlock(
    rawGateState || (gateState === 'Mở' ? 'OPEN' : gateState === 'Đóng' ? 'CLOSED' : 'STOPPED'),
    gateTransitLocked,
  );
  const disabledGateItems = new Set<string>();
  if (gateInterlock.disableOpen) disabledGateItems.add('Mở');
  if (gateInterlock.disableStop) disabledGateItems.add('Dừng');
  if (gateInterlock.disableClose) disabledGateItems.add('Đóng');

  const rawPosition = device?.raw?.currentState?.position ?? device?.currentState?.position;
  const gatePosition =
    rawPosition !== undefined && rawPosition !== null && !Number.isNaN(Number(rawPosition))
      ? Math.min(100, Math.max(0, Number(rawPosition)))
      : gateState === 'Mở'
      ? 100
      : gateState === 'Đóng'
      ? 0
      : 50;

  const gateNoun = (() => {
    const t = String(device?.raw?.deviceType || device?.deviceType || '').toUpperCase();
    return t.includes('ROLLING') ? 'cửa cuốn' : t.includes('CURTAIN') ? 'rèm' : t.includes('DOOR') ? 'cửa' : 'cổng';
  })();

  const handleGateAction = async (item: string) => {
    if (disabled || disabledGateItems.has(item)) return;
    const prevGateState = gateState;
    setGateState(item);
    const action = item === 'Mở' ? 'OPEN' : item === 'Đóng' ? 'CLOSE' : 'STOP';
    const targetId = device?.realDeviceId || device?.id;
    if (targetId) {
      try {
        const command = await sendDeviceCommand(targetId, action);
        if (command && command.success === false) {
          setGateState(prevGateState);
          notify.error(command.message || `Không thể gửi lệnh ${item} ${gateNoun}`);
          return;
        }
        if (action === 'STOP') {
          if (gateTransitTimerRef.current) {
            clearTimeout(gateTransitTimerRef.current);
            gateTransitTimerRef.current = null;
          }
          setGateTransitLocked(false);
        } else {
          if (gateTransitTimerRef.current) clearTimeout(gateTransitTimerRef.current);
          setGateTransitLocked(true);
          gateTransitTimerRef.current = setTimeout(() => {
            setGateTransitLocked(false);
            gateTransitTimerRef.current = null;
          }, APERTURE_TRANSIT_LOCK_MS);
        }
        notify.success(`Đã gửi lệnh ${item} ${gateNoun}`);
      } catch (e) {
        setGateState(prevGateState);
        notify.error(`Không thể gửi lệnh ${item} ${gateNoun}`);
        console.warn(e);
      }
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Sensor Telemetry & Chart Computation
  // ──────────────────────────────────────────────────────────────────────────
  const [sensorRange, setSensorRange] = useState('24 giờ');
  const curSensorState = (device?.raw?.currentState || device?.currentState || {}) as Record<string, unknown>;
  const sm = extractSensorMetrics(curSensorState);

  const rawCurTemp = sm.temperature;
  const rawCurHum = sm.humidity;
  const rawCurLux = sm.lux;

  let primaryMetric: 'temperature' | 'humidity' | 'lux' | 'gas' | 'value' = 'temperature';
  let unit = '°C';

  if (rawCurTemp !== undefined) {
    primaryMetric = 'temperature';
    unit = '°C';
  } else if (rawCurHum !== undefined) {
    primaryMetric = 'humidity';
    unit = '%';
  } else if (rawCurLux !== undefined) {
    primaryMetric = 'lux';
    unit = 'lux';
  } else if (sm.gasPpm !== undefined) {
    primaryMetric = 'gas';
    unit = 'ppm';
  } else if (curSensorState.value !== undefined && typeof curSensorState.value === 'number') {
    primaryMetric = 'value';
    unit = '';
  } else if (historyData && historyData.length > 0) {
    for (const h of historyData) {
      const hm = extractSensorMetrics(h.newState as Record<string, unknown>);
      if (hm.temperature !== undefined) { primaryMetric = 'temperature'; unit = '°C'; break; }
      if (hm.humidity !== undefined) { primaryMetric = 'humidity'; unit = '%'; break; }
      if (hm.lux !== undefined) { primaryMetric = 'lux'; unit = 'lux'; break; }
      if (hm.gasPpm !== undefined) { primaryMetric = 'gas'; unit = 'ppm'; break; }
      if (h.newState?.value !== undefined && typeof h.newState.value === 'number') { primaryMetric = 'value'; unit = ''; break; }
    }
  }

  // Memoize sensor telemetry sorting, filtering, statistics and SVG paths so it doesn't re-sort on unrelated renders
  const { minValStr, avgValStr, maxValStr, linePath, areaPath } = useMemo(() => {
    const latestHistoryTime =
      historyData && historyData.length > 0
        ? Math.max(...historyData.map((h) => new Date(h.changedAt).getTime()).filter((t) => !Number.isNaN(t)))
        : 0;

    const rangeMs =
      sensorRange === '7 ngày'
        ? 7 * 24 * 60 * 60 * 1000
        : sensorRange === '30 ngày'
        ? 30 * 24 * 60 * 60 * 1000
        : 24 * 60 * 60 * 1000;

    const cutoff = latestHistoryTime > 0 ? latestHistoryTime - rangeMs : 0;

    const extractReading = (state?: Record<string, unknown> | null): number | null => {
      if (!state) return null;
      const m = extractSensorMetrics(state);
      const v =
        primaryMetric === 'temperature'
          ? m.temperature
          : primaryMetric === 'humidity'
          ? m.humidity
          : primaryMetric === 'lux'
          ? m.lux
          : primaryMetric === 'gas'
          ? m.gasPpm
          : (state.value ?? m.temperature ?? m.humidity ?? m.lux ?? m.gasPpm);
      const num = Number(v);
      return !Number.isNaN(num) && v !== null && v !== undefined ? num : null;
    };

    const sortedHistory = [...(historyData || [])].sort(
      (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime()
    );

    const filteredHistory = sortedHistory.filter((h) => {
      const t = new Date(h.changedAt).getTime();
      return Number.isNaN(t) || t >= cutoff;
    });

    const targetHistory = filteredHistory.length > 0 ? filteredHistory : sortedHistory;
    const sensorPoints: number[] = [];

    for (const h of targetHistory) {
      const r = extractReading(h.newState as Record<string, unknown>);
      if (r !== null) sensorPoints.push(r);
    }

    const currentReading = extractReading(curSensorState);
    if (currentReading !== null) {
      sensorPoints.push(currentReading);
    }

    const hasSeries = sensorPoints.length > 0;
    const minVal = hasSeries ? Math.min(...sensorPoints) : null;
    const maxVal = hasSeries ? Math.max(...sensorPoints) : null;
    const avgVal = hasSeries
      ? sensorPoints.reduce((acc, c) => acc + c, 0) / sensorPoints.length
      : null;

    const minStr = minVal !== null ? `${minVal.toFixed(1)}${unit}` : '--';
    const avgStr = avgVal !== null ? `${avgVal.toFixed(1)}${unit}` : '--';
    const maxStr = maxVal !== null ? `${maxVal.toFixed(1)}${unit}` : '--';

    let lPath = 'M0 65 L340 65';
    let aPath = 'M0 65 L340 65 V130 H0 Z';

    if (sensorPoints.length === 1) {
      const y = 65;
      lPath = `M0 ${y} L340 ${y}`;
      aPath = `M0 ${y} L340 ${y} V130 H0 Z`;
    } else if (sensorPoints.length > 1 && minVal !== null && maxVal !== null) {
      const valRange = maxVal === minVal ? 1 : maxVal - minVal;
      const pts = sensorPoints.map((val, idx) => {
        const x = ((idx / (sensorPoints.length - 1)) * 340).toFixed(1);
        const y = (105 - ((val - minVal) / valRange) * 80).toFixed(1);
        return `${idx === 0 ? 'M' : 'L'}${x} ${y}`;
      });
      lPath = pts.join(' ');
      aPath = `${lPath} V130 H0 Z`;
    }

    return {
      minValStr: minStr,
      avgValStr: avgStr,
      maxValStr: maxStr,
      linePath: lPath,
      areaPath: aPath,
    };
  }, [historyData, sensorRange, primaryMetric, curSensorState, unit]);

  const sensorVal =
    device?.value ||
    (typeof device?.sensor === 'string' ? device.sensor : undefined) ||
    (rawCurTemp !== undefined
      ? `${rawCurTemp}°C`
      : rawCurHum !== undefined
      ? `${rawCurHum}%`
      : rawCurLux !== undefined
      ? `${rawCurLux} lux`
      : sm.lightBinary !== undefined
      ? (sm.lightBinary ? 'Sáng' : 'Tối')
      : sm.motion !== undefined
      ? (sm.motion ? 'Chuyển động' : 'Tĩnh')
      : sm.gasPpm !== undefined
      ? `${sm.gasPpm} ppm`
      : sm.flame !== undefined
      ? (sm.flame ? 'Có lửa!' : 'An toàn')
      : sm.co2 !== undefined
      ? `${sm.co2} ppm`
      : '--');

  const sensorStat =
    device?.offline
      ? 'Ngoại tuyến'
      : device?.status && device.status !== 'ONLINE'
      ? device.status
      : 'Bình thường';

  const sensorTelemetryItems: { label: string; value: string; icon: React.ReactNode }[] = [];

  if (rawCurTemp !== undefined) {
    sensorTelemetryItems.push({
      label: 'Nhiệt độ môi trường',
      value: `${rawCurTemp}°C`,
      icon: <Thermometer className="w-4 h-4" />,
    });
  }
  if (rawCurHum !== undefined) {
    sensorTelemetryItems.push({
      label: 'Độ ẩm không khí',
      value: `${rawCurHum}%`,
      icon: <Droplets className="w-4 h-4" />,
    });
  }
  if (rawCurLux !== undefined || sm.lightBinary !== undefined) {
    sensorTelemetryItems.push({
      label: 'Độ sáng quang thông',
      value: rawCurLux !== undefined ? `${rawCurLux} lux` : sm.lightBinary ? 'Trời sáng' : 'Trời tối',
      icon: <Sun className="w-4 h-4" />,
    });
  }
  if (sm.motion !== undefined) {
    sensorTelemetryItems.push({
      label: 'Phát hiện chuyển động',
      value: sm.motion ? 'Có chuyển động' : 'Không có người',
      icon: <Activity className="w-4 h-4" />,
    });
  }
  if (sm.gasPpm !== undefined) {
    const isGasAlert = sm.gasPpm > 200;
    sensorTelemetryItems.push({
      label: 'Nồng độ khí gas',
      value: `${sm.gasPpm} ppm`,
      icon: <Flame className={`w-4 h-4 ${isGasAlert ? 'text-rose-500' : ''}`} />,
    });
  }
  if (sm.flame !== undefined) {
    sensorTelemetryItems.push({
      label: 'Cảm biến lửa',
      value: sm.flame ? 'Phát hiện lửa!' : 'An toàn',
      icon: <Flame className={`w-4 h-4 ${sm.flame ? 'text-rose-500' : ''}`} />,
    });
  }
  if (sm.smoke !== undefined) {
    const isSmokeAlert = typeof sm.smoke === 'boolean' ? sm.smoke : sm.smoke > 50;
    sensorTelemetryItems.push({
      label: 'Cảm biến khói',
      value: typeof sm.smoke === 'boolean' ? (sm.smoke ? 'Báo động cháy' : 'Bình thường') : `${sm.smoke} ppm`,
      icon: <ShieldAlert className={`w-4 h-4 ${isSmokeAlert ? 'text-rose-500' : ''}`} />,
    });
  }
  if (sm.pm25 !== undefined || curSensorState.airQuality !== undefined) {
    sensorTelemetryItems.push({
      label: 'Chất lượng không khí (AQI)',
      value: sm.pm25 !== undefined ? `${sm.pm25} µg/m³` : String(curSensorState.airQuality),
      icon: <Wind className="w-4 h-4" />,
    });
  }
  if (sm.co2 !== undefined) {
    sensorTelemetryItems.push({
      label: 'Nồng độ CO2',
      value: `${sm.co2} ppm`,
      icon: <Gauge className="w-4 h-4" />,
    });
  }
  if (sm.battery !== undefined || curSensorState.batteryPercent !== undefined) {
    sensorTelemetryItems.push({
      label: 'Dung lượng pin',
      value: `${sm.battery ?? curSensorState.batteryPercent}%`,
      icon: <Battery className="w-4 h-4" />,
    });
  }
  if (sm.rssi !== undefined) {
    sensorTelemetryItems.push({
      label: 'Tín hiệu kết nối',
      value: `${sm.rssi} dBm`,
      icon: <Radio className="w-4 h-4" />,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Render Tab Content by Resolved Type
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="detail-tab-panel" role="tabpanel" id="device-panel-control" aria-labelledby="device-tab-control">
      {resolvedType === 'Đèn' ? (
        <>
          <LightPowerPreview
            uid={devId}
            isRgb={isRgbLight}
            on={isOn}
            level={lightLevel}
            disabled={disabled}
            color={isRgbLight ? selectedColor : undefined}
            onToggle={() => onTogglePower?.()}
          />

          <section className={`detail-section light-disableable ${lightControlsDisabled ? 'disabled' : ''}`}>
            <h3>Độ sáng</h3>
            <PillSlider
              value={lightLevel}
              onChange={handleLevel}
              disabled={lightControlsDisabled}
              label="Độ sáng"
            />
          </section>

          {isRgbLight && (
            <>
              <section className={`detail-section light-disableable ${lightControlsDisabled ? 'disabled' : ''}`}>
                <h3>Màu sắc</h3>
            <SegmentedControl
              items={['Gợi ý', 'Tùy chỉnh']}
              value={lightTab}
              setValue={setLightTab}
              disabled={lightControlsDisabled}
            />

            {lightTab === 'Gợi ý' ? (
              <>
                <div className="light-color-swatches">
                  {lightColors.map((color) => (
                    <button
                      type="button"
                      disabled={lightControlsDisabled}
                      key={color}
                      style={{ background: color }}
                      className={selectedColor.toLowerCase() === color.toLowerCase() ? 'selected' : ''}
                      onClick={() => handleApplyColor(color)}
                    >
                      {selectedColor.toLowerCase() === color.toLowerCase() && '✓'}
                    </button>
                  ))}
                </div>
                <div className="light-context-grid">
                  {[
                    'Thư giãn',
                    'Đọc sách',
                    'Tập trung',
                    'Điện ảnh',
                    'Cyberpunk',
                    'Dịu êm',
                  ].map((item, index) => (
                    <button
                      type="button"
                      disabled={lightControlsDisabled}
                      key={item}
                      onClick={() => handleApplyColor(lightColors[index] || '#f5d6a0')}
                    >
                      <i style={{ background: lightColors[index] }} />
                      {item}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="custom-color">
                <div
                  className={`custom-color-picker-wrap ${lightControlsDisabled ? 'pointer-events-none opacity-50' : ''}`}
                  onPointerUp={handlePointerUp}
                >
                  <HexColorPicker
                    color={selectedColor}
                    onChange={handlePickerChange}
                  />
                </div>
                <label>
                  HEX{' '}
                  <input
                    disabled={lightControlsDisabled}
                    value={selectedColor.toUpperCase()}
                    onChange={(event) => {
                      const val = event.target.value;
                      setSelectedColor(val);
                      if (/^#?[0-9a-fA-F]{6}$/.test(val)) {
                        handleApplyColor(val.startsWith('#') ? val : `#${val}`);
                      }
                    }}
                  />
                </label>
                <button
                  type="button"
                  disabled={lightControlsDisabled}
                  className="save-current-color"
                  onClick={() => setColorSheet({ mode: 'add' })}
                >
                  Lưu màu này
                </button>
              </div>
            )}
          </section>

          <SavedColors
            saved={savedColors}
            disabled={lightControlsDisabled}
            onApply={handleApplyColor}
            onAddClick={() => setColorSheet({ mode: 'add' })}
            onEditClick={(item) => setColorSheet({ mode: 'edit', item })}
            onDeleteClick={handleDeleteColor}
          />

              {colorSheet && (
                <ColorCreationSheet
                  currentColor={selectedColor}
                  editColor={colorSheet.item}
                  onClose={() => setColorSheet(null)}
                  onSave={handleSaveColor}
                />
              )}
            </>
          )}
        </>
      ) : resolvedType === 'Điều hòa' ? (
        <>
          <section className={`ac-detail-hero glass-g1 ${isOn ? '' : 'disabled'}`}>
            <AcArcDial
              uid={devId || 'ac'}
              value={acTemp}
              mode={acMode}
              disabled={disabled}
              isOn={isOn}
              onPreviewChange={handleAcTempPreview}
              onCommitChange={handleAcTempCommit}
              onStep={handleAcTemp}
            />
          </section>

          <section className="detail-section">
            <h3>Chế độ</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['Lạnh', 'Hút ẩm', 'Sưởi', 'Tự động'] as const).map((m) => {
                const modeTheme = AC_MODE_THEMES[m];
                const ModeIcon = modeTheme.IconComp;
                const active = acMode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={!isOn || disabled}
                    onClick={() => handleAcModeChange(m)}
                    aria-pressed={active}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-2.5 rounded-xl border text-xs font-semibold text-black transition active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer ${
                      active ? modeTheme.activeBtnClass : modeTheme.idleBtnClass
                    }`}
                  >
                    <ModeIcon size={15} className={modeTheme.iconColorClass} />
                    <span>{m}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="detail-section space-y-2.5">
            <h3>Quạt gió</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {([
                ['Tự động', 0],
                ['Thấp', 1],
                ['Vừa', 2],
                ['Cao', 3],
              ] as const).map(([fanLbl, bars]) => {
                const active = acFan === fanLbl;
                return (
                  <button
                    key={fanLbl}
                    type="button"
                    disabled={!isOn || disabled}
                    onClick={() => handleAcFanChange(fanLbl)}
                    aria-pressed={active}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border text-xs font-semibold text-black transition active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer ${
                      active
                        ? 'border-cyan-500 bg-cyan-500/15 shadow-xs ring-1 ring-cyan-500/35'
                        : 'border-cyan-500/45 bg-[var(--solid)] hover:border-cyan-500 hover:bg-cyan-500/10'
                    }`}
                  >
                    {bars === 0 ? (
                      <Sparkles size={14} className="text-cyan-600 shrink-0" />
                    ) : (
                      <Wind size={14} className="text-cyan-600 shrink-0" />
                    )}
                    <span>{fanLbl}</span>
                    {bars > 0 && (
                      <span className="inline-flex items-end gap-0.5 h-3" aria-hidden="true">
                        {[1, 2, 3].map((b) => (
                          <i
                            key={b}
                            className={`w-0.5 rounded-full not-italic ${
                              b <= bars ? 'bg-cyan-600' : 'bg-[#cbd5e1]'
                            }`}
                            style={{ height: `${b * 3 + 3}px` }}
                          />
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <label className="swing-row rounded-2xl border border-sky-500/40 bg-[var(--solid)] px-3.5 py-2">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#0f172a]">
                <RefreshCw
                  size={15}
                  className={acSwing && isOn ? 'text-sky-600' : 'text-[#475569]'}
                />
                Đảo gió tự động
              </span>
              <DetailToggle
                on={acSwing}
                setOn={handleAcSwingChange}
                disabled={!isOn || disabled}
              />
            </label>
          </section>

          <DetailAccordion title="Hẹn giờ tắt điều hòa">
            <div className="flex flex-wrap gap-2 py-1">
              {[1, 2, 4].map((h) => (
                <button
                  key={h}
                  type="button"
                  disabled={!isOn || disabled}
                  onClick={() => {
                    const targetId = device?.realDeviceId || device?.id;
                    if (!targetId) return;
                    setAcTimer(targetId, h, false)
                      .then(() => notify.success(`Đã hẹn giờ tắt điều hòa sau ${h} giờ`))
                      .catch(() => notify.error('Không thể cài hẹn giờ'));
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-sky-500/50 bg-sky-500/12 text-xs font-semibold text-black hover:bg-sky-500/20 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Clock size={13} className="text-sky-600" />
                  Tắt sau {h} giờ
                </button>
              ))}
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  const targetId = device?.realDeviceId || device?.id;
                  if (!targetId) return;
                  cancelAcTimer(targetId)
                    .then(() => notify.info('Đã hủy hẹn giờ điều hòa'))
                    .catch(() => notify.error('Không thể hủy hẹn giờ'));
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/55 bg-rose-500/12 text-xs font-semibold text-black hover:bg-rose-500/20 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
              >
                <X size={13} className="text-rose-600" />
                Hủy hẹn giờ
              </button>
            </div>
          </DetailAccordion>
        </>
      ) : resolvedType === 'Cổng' ? (
        <>
          <section className="gate-detail-hero glass-g1">
            <small>TRẠNG THÁI</small>
            <strong>
              {gateInterlock.isOpening
                ? 'Đang mở...'
                : gateInterlock.isClosing
                ? 'Đang đóng...'
                : gateInterlock.isOpen
                ? 'Đã mở'
                : gateInterlock.isClosed
                ? 'Đã đóng'
                : 'Đã dừng'}
            </strong>
            <div className="position-track">
              <i style={{ width: `${gatePosition}%` }} />
            </div>
            <span>Vị trí {gatePosition}%</span>
          </section>

          <section className="detail-section">
            <h3>Lệnh điều khiển</h3>
            <SegmentedControl
              items={['Mở', 'Dừng', 'Đóng']}
              value={gateState}
              setValue={handleGateAction}
              disabled={disabled}
              disabledItems={disabledGateItems}
            />
          </section>

          <DetailAccordion title="Hiệu chỉnh hành trình & tốc độ">
            {isDoor ? (
              <div className="space-y-2 py-1">
                <span className="text-xs text-[var(--secondary)] block">Tốc độ quay Servo (ms/độ)</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Nhanh (10ms)', speed: 10 },
                    { label: 'Chuẩn (20ms)', speed: 20 },
                    { label: 'Êm (35ms)', speed: 35 },
                  ].map((opt) => (
                    <button
                      key={opt.speed}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        const targetId = device?.realDeviceId || device?.id;
                        if (!targetId) return;
                        sendDeviceCommand(targetId, 'SET_SPEED', { speed: opt.speed })
                          .then(() => notify.success(`Đã đặt tốc độ cửa: ${opt.label}`))
                          .catch(() => notify.error('Không thể đặt tốc độ'));
                      }}
                      className="px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--solid)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--g1)] disabled:opacity-40 cursor-pointer"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3 py-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span>Thời gian mở (giây)</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      disabled={disabled}
                      value={openDurationSec}
                      onChange={(e) => setOpenDurationSec(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                      className="w-16 px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--solid)] text-center font-semibold"
                    />
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        const targetId = device?.realDeviceId || device?.id;
                        if (!targetId) return;
                        sendDeviceCommand(targetId, 'SET_OPEN_DURATION', { openDurationMs: openDurationSec * 1000 })
                          .then(() => notify.success(`Đã lưu thời gian mở: ${openDurationSec}s`))
                          .catch(() => notify.error('Lỗi cấu hình thời gian mở'));
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[var(--accent)] text-white font-semibold disabled:opacity-40 cursor-pointer"
                    >
                      Lưu
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span>Thời gian đóng (giây)</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      disabled={disabled}
                      value={closeDurationSec}
                      onChange={(e) => setCloseDurationSec(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                      className="w-16 px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--solid)] text-center font-semibold"
                    />
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        const targetId = device?.realDeviceId || device?.id;
                        if (!targetId) return;
                        sendDeviceCommand(targetId, 'SET_CLOSE_DURATION', { closeDurationMs: closeDurationSec * 1000 })
                          .then(() => notify.success(`Đã lưu thời gian đóng: ${closeDurationSec}s`))
                          .catch(() => notify.error('Lỗi cấu hình thời gian đóng'));
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[var(--accent)] text-white font-semibold disabled:opacity-40 cursor-pointer"
                    >
                      Lưu
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span>Tốc độ motor (PWM)</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={80}
                      max={255}
                      disabled={disabled}
                      value={motorSpeedVal}
                      onChange={(e) => setMotorSpeedVal(Math.max(80, Math.min(255, Number(e.target.value) || 200)))}
                      className="w-16 px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--solid)] text-center font-semibold"
                    />
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        const targetId = device?.realDeviceId || device?.id;
                        if (!targetId) return;
                        sendDeviceCommand(targetId, 'SET_SPEED', { speed: motorSpeedVal })
                          .then(() => notify.success(`Đã đặt tốc độ motor: ${motorSpeedVal}`))
                          .catch(() => notify.error('Lỗi đặt tốc độ motor'));
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[var(--accent)] text-white font-semibold disabled:opacity-40 cursor-pointer"
                    >
                      Lưu
                    </button>
                  </div>
                </div>
              </div>
            )}
          </DetailAccordion>
        </>
      ) : resolvedType === 'Cảm biến' ? (
        <>
          <section className="sensor-detail-hero">
            <strong>{sensorVal}</strong>
            <span>{sensorStat}</span>
          </section>

          <SegmentedControl
            items={['24 giờ', '7 ngày', '30 ngày']}
            value={sensorRange}
            setValue={setSensorRange}
          />

          <div className="detail-chart">
            <svg viewBox="0 0 340 130" preserveAspectRatio="none">
              <path className="grid" d="M0 25h340M0 65h340M0 105h340" />
              <path className="area" d={areaPath} />
              <path className="line" d={linePath} />
            </svg>
          </div>

          <div className="mini-stats">
            <span>
              <small>Thấp nhất</small>
              <b>{minValStr}</b>
            </span>
            <span>
              <small>Trung bình</small>
              <b>{avgValStr}</b>
            </span>
            <span>
              <small>Cao nhất</small>
              <b>{maxValStr}</b>
            </span>
          </div>

          {sensorTelemetryItems.length > 0 && (
            <div className="sensor-telemetry-section mt-4 pt-3 border-t border-[var(--border)]/60">
              <span className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block mb-2.5">
                Chỉ số vi khí hậu &amp; an toàn đo thực tế
              </span>
              <div className="grid grid-cols-2 gap-2">
                {sensorTelemetryItems.map((item) => (
                  <div
                    key={item.label}
                    className="p-2.5 rounded-xl bg-[var(--solid)] border border-[var(--border)] flex items-center gap-2.5 shadow-2xs"
                  >
                    <div className="p-1.5 rounded-lg bg-[var(--g1)] text-[var(--accent)] shrink-0 border border-[var(--border)]">
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] text-[var(--secondary)] block truncate">
                        {item.label}
                      </span>
                      <strong className="text-xs font-bold text-[var(--text)] block truncate">
                        {item.value}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (resolvedType === 'Quạt' || isFan) ? (
        <section className="detail-section">
          <h3>Tốc độ quạt</h3>
          <SegmentedControl
            items={['Tắt', 'Mức 1', 'Mức 2', 'Mức 3']}
            value={isOn ? (fanSpeedLevel === 1 ? 'Mức 1' : fanSpeedLevel === 2 ? 'Mức 2' : fanSpeedLevel === 3 ? 'Mức 3' : 'Mức 1') : 'Tắt'}
            setValue={handleFanSpeedSelect}
            disabled={disabled}
          />
        </section>
      ) : (resolvedType === 'TV' || isTv) ? (
        <>
          <section className="detail-section space-y-3">
            <h3>Điều khiển nhanh TV</h3>
            <div className="grid grid-cols-3 gap-2">
              {([
                [
                  'MUTE',
                  'Tắt tiếng',
                  VolumeX,
                  'border-rose-500/55 bg-rose-500/10 text-black hover:bg-rose-500/20',
                  'text-rose-600',
                ],
                [
                  'INPUT',
                  'Nguồn HDMI',
                  Tv,
                  'border-amber-500/55 bg-amber-500/10 text-black hover:bg-amber-500/20',
                  'text-amber-600',
                ],
                [
                  'HOME',
                  'Màn hình chính',
                  Home,
                  'border-sky-500/55 bg-sky-500/10 text-black hover:bg-sky-500/20',
                  'text-sky-600',
                ],
              ] as const).map(([act, lbl, ActionIcon, toneCls, iconTone]) => (
                <button
                  key={act}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleTvCommand(act, lbl)}
                  className={`flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-2xl border text-[11px] font-semibold transition active:scale-[0.97] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer ${toneCls}`}
                >
                  <ActionIcon size={16} className={iconTone} />
                  <span>{lbl}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex items-center justify-between gap-1 p-2 rounded-2xl border border-emerald-500/50 bg-emerald-500/[0.08]">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleTvCommand('VOL_DOWN', 'Giảm âm lượng')}
                  aria-label="Giảm âm lượng"
                  title="Giảm âm lượng"
                  className="w-8 h-8 rounded-xl border border-emerald-500/55 bg-[var(--solid)] text-emerald-700 flex items-center justify-center hover:bg-emerald-500/20 active:scale-95 transition cursor-pointer disabled:opacity-70"
                >
                  <Volume1 size={15} />
                </button>
                <span className="text-[11px] font-bold text-[#0f172a]">
                  Âm lượng
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleTvCommand('VOL_UP', 'Tăng âm lượng')}
                  aria-label="Tăng âm lượng"
                  title="Tăng âm lượng"
                  className="w-8 h-8 rounded-xl border border-emerald-500/55 bg-[var(--solid)] text-emerald-700 flex items-center justify-center hover:bg-emerald-500/20 active:scale-95 transition cursor-pointer disabled:opacity-70"
                >
                  <Volume2 size={15} />
                </button>
              </div>

              <div className="flex items-center justify-between gap-1 p-2 rounded-2xl border border-violet-500/50 bg-violet-500/[0.08]">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleTvCommand('CH_DOWN', 'Kênh trước')}
                  aria-label="Kênh trước"
                  title="Kênh trước"
                  className="w-8 h-8 rounded-xl border border-violet-500/55 bg-[var(--solid)] text-violet-700 flex items-center justify-center hover:bg-violet-500/20 active:scale-95 transition cursor-pointer disabled:opacity-70"
                >
                  <ChevronDown size={15} />
                </button>
                <span className="text-[11px] font-bold text-[#0f172a]">
                  Kênh
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleTvCommand('CH_UP', 'Kênh sau')}
                  aria-label="Kênh sau"
                  title="Kênh sau"
                  className="w-8 h-8 rounded-xl border border-violet-500/55 bg-[var(--solid)] text-violet-700 flex items-center justify-center hover:bg-violet-500/20 active:scale-95 transition cursor-pointer disabled:opacity-70"
                >
                  <ChevronUp size={15} />
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-[#cbd5e1] bg-[var(--g1)]/70 p-3 max-w-[236px] mx-auto shadow-xs">
              <div className="grid grid-cols-3 gap-2">
                <div />
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleTvCommand('UP', 'Lên')}
                  aria-label="Lên"
                  className="h-10 rounded-xl border border-sky-500/50 bg-[var(--solid)] text-black flex items-center justify-center hover:border-sky-500 hover:bg-sky-500/12 active:scale-95 transition cursor-pointer disabled:opacity-70"
                >
                  <ChevronUp size={18} />
                </button>
                <div />

                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleTvCommand('LEFT', 'Trái')}
                  aria-label="Trái"
                  className="h-10 rounded-xl border border-sky-500/50 bg-[var(--solid)] text-black flex items-center justify-center hover:border-sky-500 hover:bg-sky-500/12 active:scale-95 transition cursor-pointer disabled:opacity-70"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleTvCommand('OK', 'OK')}
                  className="h-10 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-white border border-sky-400/60 text-xs font-bold shadow-md hover:brightness-110 active:scale-95 transition cursor-pointer disabled:opacity-70"
                >
                  OK
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleTvCommand('RIGHT', 'Phải')}
                  aria-label="Phải"
                  className="h-10 rounded-xl border border-sky-500/50 bg-[var(--solid)] text-black flex items-center justify-center hover:border-sky-500 hover:bg-sky-500/12 active:scale-95 transition cursor-pointer disabled:opacity-70"
                >
                  <ChevronRight size={18} />
                </button>

                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleTvCommand('BACK', 'Quay lại')}
                  className="h-10 rounded-xl border border-amber-500/55 bg-amber-500/10 text-black text-[11px] font-semibold flex items-center justify-center gap-1 hover:bg-amber-500/20 active:scale-95 transition cursor-pointer disabled:opacity-70"
                >
                  <Undo2 size={13} className="text-amber-600" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleTvCommand('DOWN', 'Xuống')}
                  aria-label="Xuống"
                  className="h-10 rounded-xl border border-sky-500/50 bg-[var(--solid)] text-black flex items-center justify-center hover:border-sky-500 hover:bg-sky-500/12 active:scale-95 transition cursor-pointer disabled:opacity-70"
                >
                  <ChevronDown size={18} />
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleTvCommand('MENU', 'Menu')}
                  className="h-10 rounded-xl border border-indigo-500/55 bg-indigo-500/10 text-black text-[11px] font-semibold flex items-center justify-center gap-1 hover:bg-indigo-500/20 active:scale-95 transition cursor-pointer disabled:opacity-70"
                >
                  <Menu size={13} className="text-indigo-600" />
                  <span>Menu</span>
                </button>
              </div>
            </div>
          </section>

          <DetailAccordion title="Bàn phím số (0–9)">
            <div className="grid grid-cols-3 gap-2 max-w-[236px] mx-auto py-1.5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleTvCommand(digit, `Phím ${digit}`)}
                  className={`h-10 rounded-xl border border-sky-500/55 bg-sky-500/10 text-sm font-bold text-black hover:border-sky-500 hover:bg-sky-500/20 active:scale-95 transition disabled:opacity-70 cursor-pointer ${
                    digit === '0' ? 'col-start-2' : ''
                  }`}
                >
                  {digit}
                </button>
              ))}
            </div>
          </DetailAccordion>
        </>
      ) : (
        /* Công tắc, Máy bơm & Camera */
        <>
          <section className="switch-detail-hero glass-g1">
            <span className="device-icon device-visual-tile">
              <DeviceVisual
                uid={`ctrl-sw-${devId || 'sw'}`}
                deviceType={device?.raw?.deviceType || device?.deviceType}
                figmaType={resolvedType}
                name={device?.name}
                icon={device?.icon}
                isOn={isOn}
                offline={disabled && !isOn}
                size={58}
              />
            </span>
            <div>
              <strong>
                {isPump
                  ? (isOn ? 'Đang bơm nước' : 'Đã dừng bơm')
                  : (isOn ? 'Đang bật' : 'Đang tắt')}
              </strong>
              <small>{device?.name || (isPump ? 'Máy bơm nước' : 'Công tắc thông minh')}</small>
            </div>
            <DetailToggle on={isOn} setOn={() => onTogglePower?.()} disabled={disabled} />
          </section>

          <DetailAccordion title="Hẹn giờ tự động">
            <p className="text-xs text-muted py-2">Chưa đặt hẹn giờ bật/tắt tự động</p>
          </DetailAccordion>
        </>
      )}
    </div>
  );
};
