import React, { useState, useEffect } from 'react';
import { Power, Sun } from 'lucide-react';
import type { DeviceResponse } from '../../../types/device';

export interface RgbLightControlProps {
  device: DeviceResponse;
  onTogglePower: (deviceId: string, currentPower: string) => void;
  onColorChange: (deviceId: string, r: number, g: number, b: number) => void;
  onBrightnessChange: (deviceId: string, brightness: number) => void;
  isPending?: boolean;
}

const PRESET_COLORS = [
  { name: 'Đỏ', hex: '#FF0000', rgb: [255, 0, 0] },
  { name: 'Cam', hex: '#FFA500', rgb: [255, 165, 0] },
  { name: 'Vàng', hex: '#FFFF00', rgb: [255, 255, 0] },
  { name: 'Lục', hex: '#00FF00', rgb: [0, 255, 0] },
  { name: 'Lam', hex: '#00FFFF', rgb: [0, 255, 255] },
  { name: 'Chàm', hex: '#0000FF', rgb: [0, 0, 255] },
  { name: 'Tím', hex: '#800080', rgb: [128, 0, 128] },
  { name: 'Trắng', hex: '#FFFFFF', rgb: [255, 255, 255] },
];

export const RgbLightControl: React.FC<RgbLightControlProps> = ({
  device,
  onTogglePower,
  onColorChange,
  onBrightnessChange,
  isPending = false
}) => {
  const isOnline = device.status === 'ONLINE';
  const powerState = String(device.currentState?.power || 'OFF').toUpperCase();
  const isOn = powerState === 'ON';
  
  const [brightness, setBrightness] = useState<number>(Number(device.currentState?.brightness) || 100);
  const [color, setColor] = useState<string>('#ffffff');

  useEffect(() => {
    if (device.currentState?.brightness !== undefined) {
      setBrightness(Number(device.currentState.brightness));
    }
    if (device.currentState?.color) {
      const c = device.currentState.color as { r: number; g: number; b: number };
      const hex = '#' + [c.r, c.g, c.b].map(x => {
        const hexVal = x.toString(16);
        return hexVal.length === 1 ? '0' + hexVal : hexVal;
      }).join('');
      setColor(hex);
    }
  }, [device.currentState]);

  const handleBrightnessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setBrightness(val);
  };

  const handleBrightnessRelease = () => {
    onBrightnessChange(device.id, brightness);
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setColor(e.target.value);
  };

  const handleColorRelease = (hexVal: string = color) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexVal);
    if (result) {
      onColorChange(
        device.id,
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
      );
    }
  };

  const applyPresetColor = (rgb: number[]) => {
    const hex = '#' + rgb.map(x => {
      const hexVal = x.toString(16);
      return hexVal.length === 1 ? '0' + hexVal : hexVal;
    }).join('');
    setColor(hex);
    onColorChange(device.id, rgb[0], rgb[1], rgb[2]);
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
          <Power className="w-5 h-5" />
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

      {/* Custom Color Input */}
      <div className="space-y-3">
        <span className="text-sm font-medium text-muted">Màu tùy chỉnh</span>
        <div className="flex items-center space-x-4">
          <input
            type="color"
            value={color}
            disabled={!isOnline || !isOn}
            onChange={handleColorChange}
            onBlur={() => handleColorRelease(color)}
            className="w-16 h-12 p-1 bg-surface border border-line rounded cursor-pointer disabled:opacity-50"
          />
          <div className="text-sm uppercase font-mono text-muted">{color}</div>
        </div>
      </div>

      {/* Preset Colors */}
      <div className="space-y-3">
        <span className="text-sm font-medium text-muted">Màu có sẵn</span>
        <div className="grid grid-cols-4 gap-3">
          {PRESET_COLORS.map((preset) => (
            <button
              key={preset.name}
              disabled={!isOnline || !isOn}
              onClick={() => applyPresetColor(preset.rgb)}
              className="w-full aspect-square rounded-lg border border-line shadow-sm disabled:opacity-50 hover:scale-105 active:scale-95 transition-transform"
              style={{ backgroundColor: preset.hex }}
              title={preset.name}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
