import type { DeviceSummary } from '../types/automation';

export type ActionValueKind = 'none' | 'percentage' | 'number' | 'text' | 'json';
export type ActionOption = { code: string; label: string; valueLabel?: string; defaultValue: string } & (
  | { valueKind: Extract<ActionValueKind, 'none' | 'json'>; parameterKey?: never }
  | { valueKind: Extract<ActionValueKind, 'percentage' | 'number' | 'text'>; parameterKey: string }
);

export const actionOptions: ActionOption[] = [
  { code: 'TURN_ON', label: 'Bật', valueKind: 'none', defaultValue: '' },
  { code: 'TURN_OFF', label: 'Tắt', valueKind: 'none', defaultValue: '' },
  { code: 'SET_BRIGHTNESS', label: 'Đặt độ sáng', valueKind: 'percentage', valueLabel: 'Độ sáng (%)', parameterKey: 'level', defaultValue: '50' },
  { code: 'SET_TEMPERATURE', label: 'Đặt nhiệt độ', valueKind: 'number', valueLabel: 'Nhiệt độ (°C)', parameterKey: 'temperature', defaultValue: '26' },
  { code: 'SET_SPEED', label: 'Đặt tốc độ', valueKind: 'percentage', valueLabel: 'Tốc độ (%)', parameterKey: 'speed', defaultValue: '50' },
  { code: 'SET_MODE', label: 'Đặt chế độ', valueKind: 'text', valueLabel: 'Chế độ', parameterKey: 'mode', defaultValue: '' },
  { code: 'TOGGLE', label: 'Đảo trạng thái bật/tắt', valueKind: 'none', defaultValue: '' },
  { code: 'SET_STATE', label: 'Đặt trạng thái nâng cao', valueKind: 'json', valueLabel: 'Trạng thái (JSON)', defaultValue: '' },
];

const defaultActionsByDeviceType: Record<string, string[]> = {
  LIGHT: ['TURN_ON', 'TURN_OFF', 'SET_BRIGHTNESS'],
  FAN: ['TURN_ON', 'TURN_OFF', 'SET_SPEED'],
  AC: ['TURN_ON', 'TURN_OFF', 'SET_TEMPERATURE'],
  SOCKET: ['TURN_ON', 'TURN_OFF', 'TOGGLE'],
};

export function getDeviceActions(device?: DeviceSummary): ActionOption[] {
  if (!device) return [];
  const capabilities = device.capabilities ?? {};
  let allowed: string[] = [];
  if (Object.keys(capabilities).length > 0) {
    allowed = Object.values(capabilities).flat() as string[];
  } else {
    allowed = defaultActionsByDeviceType[device.deviceType?.toUpperCase() ?? ''] ?? [];
  }
  allowed = allowed.map((value) => value.trim().toUpperCase());
  return actionOptions.filter((option) => allowed.includes(option.code));
}
