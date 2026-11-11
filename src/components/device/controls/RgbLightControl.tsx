import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Power, Sun, Plus, Trash2, Loader2, Sparkles } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import { motion } from 'motion/react';
import type { DeviceResponse } from '../../../types/device';
import { updateDeviceConfig } from '../../../services/deviceApi';
import { resolveDeviceRgb, rgbToHex } from '../deviceHelpers';
import { notify } from '../../ui/notify';

export interface CustomColorOption {
  id: string;
  name: string;
  hex: string;
  rgb: [number, number, number];
}

export const DEFAULT_SEED: CustomColorOption[] = [
  { id: '1', name: 'Trắng ấm', hex: '#fff4e5', rgb: [255, 244, 229] },
  { id: '2', name: 'Vàng nắng', hex: '#ffc107', rgb: [255, 193, 7] },
  { id: '3', name: 'Xanh băng', hex: '#00bcd4', rgb: [0, 188, 212] },
];

export const MOOD_PRESETS = [
  { name: 'Thư giãn', hex: '#ff9d5c', icon: '🌅' },
  { name: 'Đọc sách', hex: '#fff1d6', icon: '📖' },
  { name: 'Tập trung', hex: '#48cae4', icon: '🎯' },
  { name: 'Điện ảnh', hex: '#7209b7', icon: '🍿' },
  { name: 'Cyberpunk', hex: '#f72585', icon: '⚡' },
  { name: 'Dịu êm', hex: '#a7c957', icon: '🌿' },
];

export const hexToRgb = (hexVal: string): [number, number, number] => {
  const clean = hexVal.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [isNaN(r) ? 255 : r, isNaN(g) ? 255 : g, isNaN(b) ? 255 : b];
  }
  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(clean);
  if (result) {
    return [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16),
    ];
  }
  return [255, 255, 255];
};

export interface RgbLightControlProps {
  device: DeviceResponse;
  onTogglePower: (deviceId: string, currentPower: string) => void;
  onColorChange: (deviceId: string, r: number, g: number, b: number) => void;
  onBrightnessChange: (deviceId: string, brightness: number) => void;
  isPending?: boolean;
}

export const RgbLightControl: React.FC<RgbLightControlProps> = ({
  device,
  onTogglePower,
  onColorChange,
  onBrightnessChange,
  isPending = false,
}) => {
  const isOnline = device.status === 'ONLINE';
  const powerState = String(device.currentState?.power || 'OFF').toUpperCase();
  const isOn = powerState === 'ON';

  const [brightness, setBrightness] = useState<number>(Number(device.currentState?.brightness) || 100);
  const [color, setColor] = useState<string>(() => {
    const resolved = resolveDeviceRgb(device.currentState);
    return resolved ? rgbToHex(resolved.r, resolved.g, resolved.b) : '#ffffff';
  });
  const [newColorName, setNewColorName] = useState<string>('');

  const [customColors, setCustomColors] = useState<CustomColorOption[]>(() => {
    // Ưu tiên đọc từ settings của Device trên server
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
    if (Array.isArray(device.settings?.customColors) && device.settings.customColors.length > 0) {
      setCustomColors(device.settings.customColors);
      try {
        localStorage.setItem(`hesta_custom_colors_${device.id}`, JSON.stringify(device.settings.customColors));
      } catch {
        // Ignore localStorage error
      }
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
  }, [device.id, device.settings?.customColors]);

  useEffect(() => {
    if (device.currentState?.brightness !== undefined) {
      setBrightness(Number(device.currentState.brightness));
    }
    const resolved = resolveDeviceRgb(device.currentState);
    if (resolved) {
      const hex = rgbToHex(resolved.r, resolved.g, resolved.b);
      setColor(hex);
      latestColorRef.current = hex;
    }
  }, [device.currentState]);

  const latestColorRef = useRef<string>(color);
  const colorDebounceRef = useRef<number | null>(null);
  const brightDebounceRef = useRef<number | null>(null);

  useEffect(() => {
    latestColorRef.current = color;
  }, [color]);

  useEffect(() => {
    return () => {
      if (colorDebounceRef.current) window.clearTimeout(colorDebounceRef.current);
      if (brightDebounceRef.current) window.clearTimeout(brightDebounceRef.current);
    };
  }, []);

  const scheduleColorSync = useCallback((hexVal: string) => {
    if (colorDebounceRef.current) {
      window.clearTimeout(colorDebounceRef.current);
    }
    colorDebounceRef.current = window.setTimeout(() => {
      const [r, g, b] = hexToRgb(hexVal);
      onColorChange(device.id, r, g, b);
    }, 50);
  }, [device.id, onColorChange]);

  const handleBrightnessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setBrightness(val);
    if (brightDebounceRef.current) {
      window.clearTimeout(brightDebounceRef.current);
    }
    brightDebounceRef.current = window.setTimeout(() => {
      onBrightnessChange(device.id, val);
    }, 60);
  };

  const handleBrightnessRelease = () => {
    if (brightDebounceRef.current) {
      window.clearTimeout(brightDebounceRef.current);
    }
    onBrightnessChange(device.id, brightness);
  };

  const handleColorRelease = (hexVal: string = latestColorRef.current) => {
    if (colorDebounceRef.current) {
      window.clearTimeout(colorDebounceRef.current);
    }
    const [r, g, b] = hexToRgb(hexVal);
    onColorChange(device.id, r, g, b);
  };

  const handleSelectCustomColor = (opt: CustomColorOption) => {
    setColor(opt.hex);
    latestColorRef.current = opt.hex;
    handleColorRelease(opt.hex);
    notify.success('Đã đổi màu đèn', `Màu: ${opt.name}`);
  };

  const handleAddCustomColor = () => {
    if (customColors.length >= 12) return;
    const name = newColorName.trim() || `Màu #${color.replace('#', '').toUpperCase()}`;
    const rgb = hexToRgb(color);
    const newOption: CustomColorOption = {
      id: Date.now().toString(),
      name,
      hex: color,
      rgb,
    };
    const updated = [...customColors, newOption];
    setCustomColors(updated);
    setNewColorName('');
    notify.success('Đã lưu màu tùy chỉnh', name);
    try {
      localStorage.setItem(`hesta_custom_colors_${device.id}`, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('hesta_custom_colors_updated', { detail: { deviceId: device.id } }));
    } catch (err) {
      console.error('Lỗi ghi custom colors vào localStorage:', err);
    }
    // Đồng bộ lên Cloud/Database (settings JSONB)
    void updateDeviceConfig(device.id, {
      settings: {
        ...(device.settings || {}),
        customColors: updated,
      },
    }).catch((err) => {
      console.warn('Lỗi đồng bộ custom colors lên server:', err);
    });
  };

  const handleDeleteCustomColor = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customColors.filter((c) => c.id !== id);
    setCustomColors(updated);
    notify.success('Đã xóa màu tùy chỉnh');
    try {
      localStorage.setItem(`hesta_custom_colors_${device.id}`, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('hesta_custom_colors_updated', { detail: { deviceId: device.id } }));
    } catch (err) {
      console.error('Lỗi khi xóa custom color khỏi localStorage:', err);
    }
    // Đồng bộ lên Cloud/Database (settings JSONB)
    void updateDeviceConfig(device.id, {
      settings: {
        ...(device.settings || {}),
        customColors: updated,
      },
    }).catch((err) => {
      console.warn('Lỗi đồng bộ xóa custom colors lên server:', err);
    });
  };

  return (
    <div className="flex flex-col p-4 space-y-6 bg-app-bg text-text rounded-xl">
      {/* Power Toggle */}
      <div className="flex items-center justify-between">
        <span className="font-medium">Nguồn</span>
        <button
          disabled={!isOnline || isPending}
          onClick={() => onTogglePower(device.id, powerState)}
          className={`flex items-center justify-center p-3 rounded-full transition-colors ${
            isOn ? 'bg-primary text-white shadow-md' : 'bg-surface border border-line text-icon'
          } ${(!isOnline || isPending) ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
        >
          {isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Power className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Brightness Control */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-muted">
            <Sun className="w-4 h-4" />
            <span className="text-sm font-medium">Độ sáng</span>
          </div>
          <span className="text-sm font-medium">{brightness}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={brightness}
          disabled={!isOnline || !isOn}
          onChange={handleBrightnessChange}
          onMouseUp={handleBrightnessRelease}
          onTouchEnd={handleBrightnessRelease}
          className="w-full h-2 bg-line rounded-lg appearance-none cursor-pointer accent-primary disabled:opacity-50"
        />
      </div>

      {/* Modern Palette & Atmosphere Presets */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-text flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Vùng chọn màu quang học</span>
          </span>
          <span className="text-xs font-mono font-bold uppercase text-text bg-surface px-2.5 py-1 rounded-md border border-line shadow-xs">
            {color}
          </span>
        </div>

        {/* Dynamic Glowing Color Canvas */}
        <div className="relative p-3.5 rounded-2xl bg-surface border border-line shadow-sm overflow-hidden flex flex-col items-center">
          {/* Subtle Ambient Spotlight Glow behind picker */}
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-300 opacity-20"
            style={{
              background: `radial-gradient(circle at 50% 40%, ${color} 0%, transparent 70%)`,
              filter: 'blur(24px)',
            }}
          />

          <div className="w-full relative z-10">
            <HexColorPicker
              color={color}
              onChange={(newHex) => {
                setColor(newHex);
                latestColorRef.current = newHex;
                scheduleColorSync(newHex);
              }}
              onChangeEnd={(newHex) => {
                setColor(newHex);
                latestColorRef.current = newHex;
                handleColorRelease(newHex);
              }}
            />
          </div>
        </div>

        {/* Quick Atmosphere / Mood Presets */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-muted">Ngữ cảnh ánh sáng gợi ý</span>
          <div className="grid grid-cols-3 gap-2">
            {MOOD_PRESETS.map((m) => (
              <motion.button
                key={m.name}
                type="button"
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.02 }}
                disabled={!isOnline || !isOn}
                onClick={() => {
                  setColor(m.hex);
                  handleColorRelease(m.hex);
                  notify.success('Đã áp dụng ngữ cảnh', m.name);
                }}
                className={`flex items-center gap-1.5 p-2 rounded-xl border border-line bg-surface hover:border-primary/50 transition-all text-left text-xs font-medium ${
                  !isOnline || !isOn ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-xs'
                }`}
                title={`Áp dụng mood: ${m.name}`}
              >
                <span className="text-sm">{m.icon}</span>
                <span className="truncate flex-1">{m.name}</span>
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10 shadow-inner"
                  style={{ backgroundColor: m.hex }}
                />
              </motion.button>
            ))}
          </div>
        </div>

        {/* Save Custom Color Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">Lưu vào bộ sưu tập cá nhân</span>
            <span className="text-xs text-muted font-mono">{customColors.length}/12 màu</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newColorName}
              onChange={(e) => setNewColorName(e.target.value)}
              placeholder="Đặt tên màu (VD: Đêm muộn, Cà phê)..."
              maxLength={25}
              disabled={!isOnline || !isOn || customColors.length >= 12}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCustomColor();
                }
              }}
              className="flex-1 px-3 py-2 text-xs bg-surface border border-line rounded-xl text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
            />
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              disabled={!isOnline || !isOn || customColors.length >= 12}
              onClick={handleAddCustomColor}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-primary hover:bg-primary-hover text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-xs"
              title={customColors.length >= 12 ? 'Đã đạt giới hạn 12 màu' : '+ Lưu màu tùy chỉnh'}
            >
              <Plus className="w-4 h-4" />
              <span>Lưu</span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Saved Custom Colors List */}
      <div className="space-y-3">
        <span className="text-sm font-medium text-muted">Màu đã lưu</span>
        {customColors.length === 0 ? (
          <p className="text-xs text-muted italic">Chưa có màu tùy chỉnh nào được lưu.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {customColors.map((opt) => (
              <motion.div
                key={opt.id}
                role="button"
                tabIndex={0}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => (!isOnline || !isOn ? undefined : handleSelectCustomColor(opt))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isOnline && isOn) {
                    handleSelectCustomColor(opt);
                  }
                }}
                className={`group relative flex items-center gap-2.5 p-2 rounded-xl border border-line bg-surface hover:border-primary/50 transition-all select-none cursor-pointer ${
                  !isOnline || !isOn ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-xs'
                }`}
                title={`Áp dụng màu: ${opt.name}`}
              >
                <span
                  className="w-6 h-6 rounded-full border border-black/10 shrink-0 shadow-inner"
                  style={{ backgroundColor: opt.hex }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-text truncate leading-tight" title={opt.name}>
                    {opt.name}
                  </p>
                  <p className="text-[10px] font-mono text-muted uppercase">
                    {opt.hex}
                  </p>
                </div>
                <button
                  type="button"
                  title={`Xóa màu ${opt.name}`}
                  disabled={!isOnline || !isOn}
                  onClick={(e) => handleDeleteCustomColor(opt.id, e)}
                  className="p-1 rounded-md text-muted hover:text-rose-500 hover:bg-rose-50 opacity-60 group-hover:opacity-100 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

