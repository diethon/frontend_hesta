import type { DeviceSummary } from '../types/automation';
import { isAcDevice, normalizeDeviceCapabilities } from './device/deviceHelpers';

export type ActionValueKind = 'none' | 'percentage' | 'number' | 'text' | 'color' | 'json';
export type ActionOption = { code: string; label: string; valueLabel?: string; defaultValue: string } & (
  | { valueKind: Extract<ActionValueKind, 'none' | 'json'>; parameterKey?: never }
  | { valueKind: Extract<ActionValueKind, 'percentage' | 'number' | 'text' | 'color'>; parameterKey: string }
);

export const actionOptions: ActionOption[] = [
  { code: 'TURN_ON', label: 'Bật nguồn', valueKind: 'none', defaultValue: '' },
  { code: 'TURN_OFF', label: 'Tắt nguồn', valueKind: 'none', defaultValue: '' },
  { code: 'TOGGLE', label: 'Đảo trạng thái bật/tắt', valueKind: 'none', defaultValue: '' },
  { code: 'SET_BRIGHTNESS', label: 'Đặt độ sáng', valueKind: 'percentage', valueLabel: 'Độ sáng (%)', parameterKey: 'level', defaultValue: '50' },
  { code: 'SET_RGB', label: 'Đặt màu RGB', valueKind: 'color', valueLabel: 'Mã màu RGB (HEX)', parameterKey: 'color', defaultValue: '#ffc107' },
  { code: 'SET_COLOR', label: 'Đổi màu', valueKind: 'color', valueLabel: 'Mã màu (HEX hoặc RGB)', parameterKey: 'color', defaultValue: '#ffc107' },
  { code: 'SET_TEMPERATURE', label: 'Đặt nhiệt độ', valueKind: 'number', valueLabel: 'Nhiệt độ (°C)', parameterKey: 'temperature', defaultValue: '26' },
  { code: 'SET_SPEED', label: 'Đặt tốc độ', valueKind: 'percentage', valueLabel: 'Tốc độ (%)', parameterKey: 'speed', defaultValue: '50' },
  { code: 'SET_MODE', label: 'Đặt chế độ', valueKind: 'text', valueLabel: 'Chế độ', parameterKey: 'mode', defaultValue: 'COOL' },
  { code: 'OPEN', label: 'Mở cửa', valueKind: 'none', defaultValue: '' },
  { code: 'CLOSE', label: 'Đóng cửa', valueKind: 'none', defaultValue: '' },
  { code: 'STOP', label: 'Dừng cửa', valueKind: 'none', defaultValue: '' },
  { code: 'SET_STATE', label: 'Đặt trạng thái nâng cao', valueKind: 'json', valueLabel: 'Trạng thái (JSON)', defaultValue: '' },
];

const defaultActionsByDeviceType: Record<string, string[]> = {
  LIGHT: ['TURN_ON', 'TURN_OFF', 'TOGGLE', 'SET_BRIGHTNESS'],
  LED: ['TURN_ON', 'TURN_OFF', 'TOGGLE', 'SET_BRIGHTNESS'],
  LED_RGB: ['TURN_ON', 'TURN_OFF', 'TOGGLE', 'SET_BRIGHTNESS', 'SET_RGB', 'SET_COLOR'],
  FAN: ['TURN_ON', 'TURN_OFF', 'TOGGLE', 'SET_SPEED'],
  AC: ['TURN_ON', 'TURN_OFF', 'TOGGLE', 'SET_TEMPERATURE', 'SET_MODE', 'SET_SPEED'],
  AIR_CONDITIONER: ['TURN_ON', 'TURN_OFF', 'TOGGLE', 'SET_TEMPERATURE', 'SET_MODE', 'SET_SPEED'],
  SOCKET: ['TURN_ON', 'TURN_OFF', 'TOGGLE'],
  SMART_PLUG: ['TURN_ON', 'TURN_OFF', 'TOGGLE'],
  GATE: ['OPEN', 'CLOSE', 'STOP'],
  ROLLING_DOOR: ['OPEN', 'CLOSE', 'STOP'],
};

export function getDeviceActions(device?: DeviceSummary | any): ActionOption[] {
  if (!device) return [];
  const normalizedCaps = normalizeDeviceCapabilities(device.capabilities);
  let allowed: string[] = [];

  if (Object.keys(normalizedCaps).length > 0) {
    allowed = Object.values(normalizedCaps).flat();
    for (const key of Object.keys(normalizedCaps)) {
      const uKey = key.toUpperCase();
      if (uKey === 'POWER' && !allowed.some((a) => ['TURN_ON', 'TURN_OFF', 'TOGGLE'].includes(a))) {
        allowed.push('TURN_ON', 'TURN_OFF', 'TOGGLE');
      }
      if ((uKey === 'COLOR' || uKey === 'RGB') && !allowed.includes('SET_RGB') && !allowed.includes('SET_COLOR')) {
        allowed.push('SET_RGB', 'SET_COLOR');
      }
      if (uKey === 'BRIGHTNESS' && !allowed.includes('SET_BRIGHTNESS')) {
        allowed.push('SET_BRIGHTNESS');
      }
      if ((uKey === 'CLIMATE' || uKey === 'TEMPERATURE') && !allowed.includes('SET_TEMPERATURE')) {
        allowed.push('SET_TEMPERATURE');
      }
      if ((uKey === 'SPEED' || uKey === 'FAN') && !allowed.includes('SET_SPEED')) {
        allowed.push('SET_SPEED');
      }
      if ((uKey === 'GATE' || uKey === 'DOOR') && !allowed.includes('OPEN')) {
        allowed.push('OPEN', 'CLOSE', 'STOP');
      }
    }
  } else {
    const isAc = isAcDevice(device);
    const effType = isAc ? 'AIR_CONDITIONER' : (device.deviceType?.toUpperCase() ?? '');
    allowed = defaultActionsByDeviceType[effType] ?? [];
  }

  // Cross-mapping equivalents
  if (allowed.includes('SET_RGB') && !allowed.includes('SET_COLOR')) allowed.push('SET_COLOR');
  if (allowed.includes('SET_COLOR') && !allowed.includes('SET_RGB')) allowed.push('SET_RGB');
  if (allowed.includes('SET_FAN') && !allowed.includes('SET_SPEED')) allowed.push('SET_SPEED');
  if (allowed.includes('SET_SPEED') && !allowed.includes('SET_FAN')) allowed.push('SET_FAN');
  allowed.push('SET_STATE');

  const allowedSet = new Set(allowed.map((v) => v.trim().toUpperCase()));
  return actionOptions.filter((option) => allowedSet.has(option.code));
}
