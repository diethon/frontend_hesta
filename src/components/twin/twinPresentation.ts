import type { JsonValue, TwinHealthStatus } from '../../types/twin';

export const healthSymbols: Record<TwinHealthStatus, string> = { ACTIVE: 'A', STALE: '!', OFFLINE: '×' };

// Presentation only. IR_REMOTE does not identify the appliance it controls.
export function deviceVisualKind(type: string) {
  switch (type) {
    case 'LIGHT': case 'LED_RGB': return 'light';
    case 'FAN': return 'fan';
    case 'AC': return 'ac';
    case 'SMART_PLUG': case 'SOCKET': return 'plug';
    case 'LOCK': return 'lock';
    case 'IR_REMOTE': return 'remote';
    case 'TEMP_HUMID_SENSOR': case 'SENSOR': return 'sensor';
    case 'MOTION_SENSOR': return 'motion';
    case 'SMOKE_SENSOR': return 'smoke';
    case 'CAMERA_AI': case 'CAMERA': return 'camera';
    case 'MICROPHONE': return 'microphone';
    default: return 'generic';
  }
}

export function sensorVisualKind(metric: string) {
  switch (metric.toUpperCase()) {
    case 'TEMPERATURE': return 'temperature';
    case 'HUMIDITY': return 'humidity';
    case 'LIGHT': case 'ILLUMINANCE': return 'light';
    case 'MOTION': return 'motion';
    case 'AIR_QUALITY': return 'air';
    case 'CO2': return 'gas';
    case 'SMOKE': return 'smoke';
    default: return 'generic';
  }
}

export function knownPower(state: JsonValue): boolean | null {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return null;
  const power = state.power;
  if (power === true || power === 'ON') return true;
  if (power === false || power === 'OFF') return false;
  return null;
}

export function summarizeState(value: JsonValue, depth = 0): string {
  if (value === null) return 'Chưa có dữ liệu';
  if (typeof value === 'boolean') return value ? 'Có / ON' : 'Không / OFF';
  if (typeof value !== 'object') return String(value);
  if (depth >= 2) return Array.isArray(value) ? `${value.length} giá trị` : `${Object.keys(value).length} thuộc tính`;
  if (Array.isArray(value)) return value.slice(0, 4).map((item) => summarizeState(item, depth + 1)).join(', ') || 'Trống';
  return Object.entries(value).slice(0, 4).map(([key, item]) => `${key}: ${summarizeState(item, depth + 1)}`).join(' · ') || 'Trống';
}
