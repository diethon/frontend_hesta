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
} from 'lucide-react';
import { Icon, type IconName } from '../../home/HomeIcons';
import { sendDeviceCommand, updateDeviceConfig } from '../../../services/deviceApi';
import { notify } from '../../ui/notify';
import { resolveDeviceRgb, rgbToHex } from '../deviceHelpers';
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
}: {
  items: string[];
  value: string;
  setValue: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="detail-segments">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          disabled={disabled}
          className={item === value ? 'active' : ''}
          onClick={() => setValue(item)}
        >
          {item}
        </button>
      ))}
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
  on,
  level,
  disabled,
  color,
  onToggle,
}: {
  on: boolean;
  level: number;
  disabled: boolean;
  color?: string;
  onToggle: () => void;
}) {
  return (
    <section className={`light-power-preview ${on ? 'on' : 'off'}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        aria-label={on ? 'Tắt đèn' : 'Bật đèn'}
        style={
          on && color
            ? {
                color: color,
                filter: `drop-shadow(0 0 16px ${color}80)`,
              }
            : undefined
        }
      >
        <Icon name="lamp" size={40} />
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
  const [selectedColor, setSelectedColor] = useState(() => {
    const rawState = device?.raw?.currentState || device?.currentState;
    const resolved = resolveDeviceRgb(rawState);
    if (resolved) {
      return rgbToHex(resolved.r, resolved.g, resolved.b);
    }
    return lightColors[0] || '#f5d6a0';
  });

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

  const emitColorChange = useCallback((hex: string) => {
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
  }, [onColorChange, device, lightLevel]);

  const handlePickerChange = (newHex: string) => {
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
    if (colorDebounceRef.current) {
      window.clearTimeout(colorDebounceRef.current);
    }
    emitColorChange(latestColorRef.current);
  };

  const handleApplyColor = (hex: string) => {
    setSelectedColor(hex);
    latestColorRef.current = hex;
    if (colorDebounceRef.current) {
      window.clearTimeout(colorDebounceRef.current);
    }
    emitColorChange(hex);
  };

  const handleLevel = (val: number) => {
    setLightLevel(val);
    onBrightnessChange?.(val);
  };

  const lightControlsDisabled = disabled || !isOn;

  // ──────────────────────────────────────────────────────────────────────────
  // AC Specific State & Handlers
  // ──────────────────────────────────────────────────────────────────────────
  const initialFan = String(device?.raw?.currentState?.fanSpeed || device?.currentState?.fanSpeed || 'Tự động');
  const initialSwing = Boolean(device?.raw?.currentState?.swing ?? device?.currentState?.swing ?? false);

  const [acFan, setAcFan] = useState(initialFan);
  const [acSwing, setAcSwing] = useState(initialSwing);

  const [prevAcFan, setPrevAcFan] = useState(initialFan);
  if (initialFan !== prevAcFan) {
    setPrevAcFan(initialFan);
    setAcFan(initialFan);
  }

  const [prevAcSwing, setPrevAcSwing] = useState(initialSwing);
  if (initialSwing !== prevAcSwing) {
    setPrevAcSwing(initialSwing);
    setAcSwing(initialSwing);
  }

  const handleAcTemp = (delta: number) => {
    const next = Math.max(16, Math.min(32, acTemp + delta));
    setAcTemp(next);
    const targetId = device?.realDeviceId || device?.id;
    if (targetId) {
      sendDeviceCommand(targetId, 'SET_TEMPERATURE', {
        temperature: next,
      }).catch(console.warn);
    }
  };

  const handleAcModeChange = (m: string) => {
    setAcMode(m);
    const targetId = device?.realDeviceId || device?.id;
    if (targetId) {
      sendDeviceCommand(targetId, 'SET_AC_MODE', {
        mode: m,
      }).catch(console.warn);
    }
  };

  const handleAcFanChange = (fan: string) => {
    setAcFan(fan);
    const targetId = device?.realDeviceId || device?.id;
    if (targetId) {
      sendDeviceCommand(targetId, 'SET_AC_FAN', { fanSpeed: fan }).catch(console.warn);
    }
  };

  const handleAcSwingChange = (swing: boolean) => {
    setAcSwing(swing);
    const targetId = device?.realDeviceId || device?.id;
    if (targetId) {
      sendDeviceCommand(targetId, 'SET_AC_SWING', { swing }).catch(console.warn);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Gate Specific State & Handlers
  // ──────────────────────────────────────────────────────────────────────────
  const rawPosition = device?.raw?.currentState?.position ?? device?.currentState?.position;
  const gatePosition =
    rawPosition !== undefined && rawPosition !== null && !Number.isNaN(Number(rawPosition))
      ? Math.min(100, Math.max(0, Number(rawPosition)))
      : gateState === 'Mở'
      ? 100
      : gateState === 'Đóng'
      ? 0
      : 50;

  const handleGateAction = async (item: string) => {
    setGateState(item);
    const action = item === 'Mở' ? 'OPEN' : item === 'Đóng' ? 'CLOSE' : 'STOP';
    const targetId = device?.realDeviceId || device?.id;
    if (targetId) {
      try {
        await sendDeviceCommand(targetId, action);
        notify.success(`Đã gửi lệnh ${item} cổng`);
      } catch (e) {
        console.warn(e);
      }
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Sensor Telemetry & Chart Computation
  // ──────────────────────────────────────────────────────────────────────────
  const [sensorRange, setSensorRange] = useState('24 giờ');
  const curSensorState = (device?.raw?.currentState || device?.currentState || {}) as Record<string, unknown>;

  const rawCurTemp = curSensorState.temperature;
  const rawCurHum = curSensorState.humidity;
  const rawCurLux = curSensorState.lux ?? curSensorState.illuminance;

  let primaryMetric: 'temperature' | 'humidity' | 'lux' | 'value' = 'temperature';
  let unit = '°C';

  if (rawCurTemp !== undefined && rawCurTemp !== null) {
    primaryMetric = 'temperature';
    unit = '°C';
  } else if (rawCurHum !== undefined && rawCurHum !== null) {
    primaryMetric = 'humidity';
    unit = '%';
  } else if (rawCurLux !== undefined && rawCurLux !== null) {
    primaryMetric = 'lux';
    unit = 'lux';
  } else if (curSensorState.value !== undefined && typeof curSensorState.value === 'number') {
    primaryMetric = 'value';
    unit = '';
  } else if (historyData && historyData.length > 0) {
    for (const h of historyData) {
      const s = h.newState;
      if (s?.temperature !== undefined) { primaryMetric = 'temperature'; unit = '°C'; break; }
      if (s?.humidity !== undefined) { primaryMetric = 'humidity'; unit = '%'; break; }
      if (s?.lux !== undefined || s?.illuminance !== undefined) { primaryMetric = 'lux'; unit = 'lux'; break; }
      if (s?.value !== undefined && typeof s.value === 'number') { primaryMetric = 'value'; unit = ''; break; }
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
      const v =
        primaryMetric === 'temperature'
          ? state.temperature
          : primaryMetric === 'humidity'
          ? state.humidity
          : primaryMetric === 'lux'
          ? (state.lux ?? state.illuminance)
          : (state.value ?? state.temperature ?? state.humidity ?? state.lux ?? state.illuminance);
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
    device?.sensor ||
    (rawCurTemp !== undefined && rawCurTemp !== null
      ? `${rawCurTemp}°C`
      : rawCurHum !== undefined && rawCurHum !== null
      ? `${rawCurHum}%`
      : rawCurLux !== undefined && rawCurLux !== null
      ? `${rawCurLux} lux`
      : curSensorState.gas !== undefined
      ? `${curSensorState.gas} ppm`
      : curSensorState.co2 !== undefined
      ? `${curSensorState.co2} ppm`
      : '--');

  const sensorStat =
    device?.offline
      ? 'Ngoại tuyến'
      : device?.status && device.status !== 'ONLINE'
      ? device.status
      : 'Bình thường';

  const sensorTelemetryItems: { label: string; value: string; icon: React.ReactNode }[] = [];

  if (rawCurTemp !== undefined && rawCurTemp !== null) {
    sensorTelemetryItems.push({
      label: 'Nhiệt độ môi trường',
      value: `${rawCurTemp}°C`,
      icon: <Thermometer className="w-4 h-4" />,
    });
  }
  if (rawCurHum !== undefined && rawCurHum !== null) {
    sensorTelemetryItems.push({
      label: 'Độ ẩm không khí',
      value: `${rawCurHum}%`,
      icon: <Droplets className="w-4 h-4" />,
    });
  }
  if (rawCurLux !== undefined && rawCurLux !== null) {
    sensorTelemetryItems.push({
      label: 'Độ sáng quang thông',
      value: `${rawCurLux} lux`,
      icon: <Sun className="w-4 h-4" />,
    });
  }
  if (curSensorState.motion !== undefined) {
    sensorTelemetryItems.push({
      label: 'Phát hiện chuyển động',
      value: curSensorState.motion ? 'Có chuyển động' : 'Không có người',
      icon: <Activity className="w-4 h-4" />,
    });
  }
  if (curSensorState.gas !== undefined) {
    const isGasAlert = typeof curSensorState.gas === 'boolean' ? curSensorState.gas : Number(curSensorState.gas) > 200;
    sensorTelemetryItems.push({
      label: 'Nồng độ khí gas',
      value: typeof curSensorState.gas === 'boolean' ? (curSensorState.gas ? 'Phát hiện rò rỉ' : 'An toàn') : `${curSensorState.gas} ppm`,
      icon: <Flame className={`w-4 h-4 ${isGasAlert ? 'text-rose-500' : ''}`} />,
    });
  }
  if (curSensorState.smoke !== undefined) {
    const isSmokeAlert = typeof curSensorState.smoke === 'boolean' ? curSensorState.smoke : Number(curSensorState.smoke) > 50;
    sensorTelemetryItems.push({
      label: 'Cảm biến khói',
      value: typeof curSensorState.smoke === 'boolean' ? (curSensorState.smoke ? 'Báo động cháy' : 'Bình thường') : `${curSensorState.smoke} ppm`,
      icon: <ShieldAlert className={`w-4 h-4 ${isSmokeAlert ? 'text-rose-500' : ''}`} />,
    });
  }
  if (curSensorState.pm25 !== undefined || curSensorState.airQuality !== undefined) {
    sensorTelemetryItems.push({
      label: 'Chất lượng không khí (AQI)',
      value: curSensorState.pm25 !== undefined ? `${curSensorState.pm25} µg/m³` : String(curSensorState.airQuality),
      icon: <Wind className="w-4 h-4" />,
    });
  }
  if (curSensorState.co2 !== undefined) {
    sensorTelemetryItems.push({
      label: 'Nồng độ CO2',
      value: `${curSensorState.co2} ppm`,
      icon: <Gauge className="w-4 h-4" />,
    });
  }
  if (curSensorState.battery !== undefined || curSensorState.batteryPercent !== undefined) {
    sensorTelemetryItems.push({
      label: 'Dung lượng pin',
      value: `${curSensorState.battery ?? curSensorState.batteryPercent}%`,
      icon: <Battery className="w-4 h-4" />,
    });
  }
  if (curSensorState.rssi !== undefined) {
    sensorTelemetryItems.push({
      label: 'Tín hiệu kết nối',
      value: `${curSensorState.rssi} dBm`,
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
            on={isOn}
            level={lightLevel}
            disabled={disabled}
            color={selectedColor}
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
      ) : resolvedType === 'Điều hòa' ? (
        <>
          <section className={`ac-detail-hero glass-g1 ${isOn ? '' : 'disabled'}`}>
            <div className="temperature-dial">
              <button
                type="button"
                disabled={!isOn || disabled}
                onClick={() => handleAcTemp(-1)}
                aria-label="Giảm nhiệt độ"
              >
                −
              </button>
              <div>
                <strong>{acTemp}°C</strong>
                <small>{acMode}</small>
              </div>
              <button
                type="button"
                disabled={!isOn || disabled}
                onClick={() => handleAcTemp(1)}
                aria-label="Tăng nhiệt độ"
              >
                +
              </button>
            </div>
            {!isOn && <p className="text-center text-xs text-muted mt-2">Điều hòa đang tắt</p>}
          </section>

          <section className="detail-section">
            <h3>Chế độ</h3>
            <SegmentedControl
              items={['Lạnh', 'Hút ẩm', 'Sưởi', 'Tự động']}
              value={acMode}
              setValue={handleAcModeChange}
              disabled={!isOn || disabled}
            />
          </section>

          <section className="detail-section">
            <h3>Quạt gió</h3>
            <SegmentedControl
              items={['Tự động', 'Thấp', 'Vừa', 'Cao']}
              value={acFan}
              setValue={handleAcFanChange}
              disabled={!isOn || disabled}
            />
            <label className="swing-row">
              Đảo gió tự động{' '}
              <DetailToggle
                on={acSwing}
                setOn={handleAcSwingChange}
                disabled={!isOn || disabled}
              />
            </label>
          </section>

          <DetailAccordion title="Hẹn giờ & nâng cao">
            <div className="detail-list">
              <span>Hẹn giờ tắt (Sau 2 giờ)</span>
              <span>Chế độ ngủ đêm</span>
              <span>Chế độ tiết kiệm điện ECO</span>
            </div>
          </DetailAccordion>
        </>
      ) : resolvedType === 'Cổng' ? (
        <>
          <section className="gate-detail-hero glass-g1">
            <small>TRẠNG THÁI</small>
            <strong>
              {gateState === 'Dừng' ? 'Đã dừng' : `Đang ${gateState.toLowerCase()}`}
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
            />
          </section>
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
      ) : (
        /* Công tắc & Camera */
        <>
          <section className="switch-detail-hero glass-g1">
            <span className="device-icon">
              <Icon name={(device?.icon as IconName) || 'automation'} size={34} />
            </span>
            <div>
              <strong>{isOn ? 'Đang bật' : 'Đang tắt'}</strong>
              <small>{device?.name || 'Công tắc thông minh'}</small>
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
