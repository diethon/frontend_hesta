import type { DeviceSummary } from '../../types/automation';
import type { DeviceResponse } from '../../types/scene';
import { getDeviceCapabilityMap } from './deviceHelpers';

export type AnyDevice = DeviceSummary | DeviceResponse;

export interface ColorPreset {
  label: string;
  hex: string;
}

export const COLOR_PRESETS: readonly ColorPreset[] = [
  { label: 'Trắng ấm', hex: '#fff4e5' },
  { label: 'Vàng nắng', hex: '#ffc107' },
  { label: 'Cam hoàng hôn', hex: '#ff7043' },
  { label: 'Đỏ', hex: '#f44336' },
  { label: 'Xanh lá', hex: '#4caf50' },
  { label: 'Xanh băng', hex: '#00bcd4' },
  { label: 'Xanh dương', hex: '#2196f3' },
  { label: 'Tím', hex: '#9c27b0' },
];

export const AC_MODES = [
  { code: 'COOL', label: 'Làm lạnh' },
  { code: 'DRY', label: 'Hút ẩm' },
  { code: 'HEAT', label: 'Sưởi ấm' },
  { code: 'AUTO', label: 'Tự động' },
] as const;

export const AC_FAN_LEVELS = [
  { code: 'AUTO', label: 'Tự động' },
  { code: 'LOW', label: 'Thấp' },
  { code: 'MID', label: 'Vừa' },
  { code: 'HIGH', label: 'Mạnh' },
] as const;

export interface DeviceMultiActionState {
  power: 'ON' | 'OFF' | 'TOGGLE';
  enableBrightness: boolean;
  brightness: number;
  enableColor: boolean;
  color: string;
  enableTemp: boolean;
  temperature: number;
  enableMode: boolean;
  mode: string;
  enableFan: boolean;
  fan: string;
  gateAction?: 'OPEN' | 'CLOSE' | 'STOP' | null;
  isCustomJson?: boolean;
  customJson?: string;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return { r, g, b };
  }
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return { r, g, b };
  }
  return null;
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(n)));
    return clamped.toString(16).padStart(2, '0');
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function getColorLabel(hex: string): string {
  const lower = hex.toLowerCase();
  const match = COLOR_PRESETS.find((p) => p.hex.toLowerCase() === lower);
  return match ? `${match.label} (${hex})` : hex;
}

export interface DeviceCapabilityProfile {
  hasPower: boolean;
  hasBrightness: boolean;
  hasColor: boolean;
  hasTemperature: boolean;
  hasMode: boolean;
  hasFan: boolean;
  hasGate: boolean;
  isAc: boolean;
}

export function getDeviceCapabilityProfile(device?: AnyDevice): DeviceCapabilityProfile {
  const map = getDeviceCapabilityMap(device as any);
  return {
    hasPower: map.hasPower,
    hasBrightness: map.hasBrightness,
    hasColor: map.hasColor,
    hasTemperature: map.hasTemperature,
    hasMode: map.hasMode,
    hasFan: map.hasSpeed,
    hasGate: map.hasGate,
    isAc: map.isAc,
  };
}

export function parseActionToMultiState(
  action: string,
  valueOrParams: unknown,
  device?: AnyDevice
): DeviceMultiActionState {
  const profile = getDeviceCapabilityProfile(device);

  let power: 'ON' | 'OFF' | 'TOGGLE' = 'ON';
  let enableBrightness = false;
  let brightness = 50;
  let enableColor = false;
  let color = '#ffc107';
  let enableTemp = false;
  let temperature = 24;
  let enableMode = false;
  let mode = 'COOL';
  let enableFan = false;
  let fan = profile.isAc ? 'AUTO' : '50';
  let gateAction: 'OPEN' | 'CLOSE' | 'STOP' | null = profile.hasGate ? 'OPEN' : null;
  let isCustomJson = false;
  let customJson = '';

  let obj: Record<string, unknown> = {};
  if (valueOrParams && typeof valueOrParams === 'object' && !Array.isArray(valueOrParams)) {
    obj = valueOrParams as Record<string, unknown>;
  } else if (typeof valueOrParams === 'string' && valueOrParams.trim().startsWith('{')) {
    try {
      obj = JSON.parse(valueOrParams) as Record<string, unknown>;
    } catch {
      // not JSON
    }
  }

  const act = (action || '').toUpperCase();

  if (act === 'TURN_OFF' || act === 'POWER_OFF') {
    power = 'OFF';
  } else if (act === 'TOGGLE') {
    power = 'TOGGLE';
  } else if (act === 'TURN_ON' || act === 'POWER_ON') {
    power = 'ON';
  } else if (act === 'OPEN' || act === 'CLOSE' || act === 'STOP') {
    gateAction = act;
  } else if (act === 'SET_BRIGHTNESS') {
    power = 'ON';
    enableBrightness = true;
    const b = Number(typeof valueOrParams === 'number' ? valueOrParams : obj.brightness ?? obj.level ?? valueOrParams);
    if (!Number.isNaN(b)) brightness = Math.max(0, Math.min(100, b));
  } else if (act === 'SET_COLOR' || act === 'SET_RGB') {
    power = 'ON';
    enableColor = true;
    if (typeof valueOrParams === 'string' && valueOrParams.startsWith('#')) {
      color = valueOrParams;
    } else if (obj.color || obj.hex) {
      color = String(obj.color || obj.hex);
    } else if (obj.r !== undefined && obj.g !== undefined && obj.b !== undefined) {
      color = rgbToHex(Number(obj.r), Number(obj.g), Number(obj.b));
    }
    if (obj.brightness !== undefined || obj.level !== undefined) {
      enableBrightness = true;
      brightness = Number(obj.brightness ?? obj.level);
    }
    if (obj.power) {
      const p = String(obj.power).toUpperCase();
      if (p === 'OFF') power = 'OFF';
      else if (p === 'TOGGLE') power = 'TOGGLE';
      else power = 'ON';
    }
  } else if (act === 'SET_TEMPERATURE') {
    power = 'ON';
    enableTemp = true;
    const t = Number(typeof valueOrParams === 'number' ? valueOrParams : obj.temperature ?? obj.temp ?? valueOrParams);
    if (!Number.isNaN(t)) temperature = Math.max(16, Math.min(32, t));
  } else if (act === 'SET_MODE') {
    power = 'ON';
    enableMode = true;
    mode = String(obj.mode ?? valueOrParams ?? 'COOL').toUpperCase();
  } else if (act === 'SET_FAN' || act === 'SET_SPEED') {
    power = 'ON';
    enableFan = true;
    fan = String(obj.fan ?? obj.speed ?? valueOrParams ?? (profile.isAc ? 'AUTO' : '50')).toUpperCase();
  } else if (act === 'SET_STATE') {
    if (obj && Object.keys(obj).length > 0) {
      if (obj.power !== undefined) {
        const p = String(obj.power).toUpperCase();
        if (p === 'OFF' || p === 'FALSE') power = 'OFF';
        else if (p === 'TOGGLE') power = 'TOGGLE';
        else power = 'ON';
      }
      if (obj.brightness !== undefined || obj.level !== undefined) {
        enableBrightness = true;
        const b = Number(obj.brightness ?? obj.level);
        if (!Number.isNaN(b)) brightness = Math.max(0, Math.min(100, b));
      }
      if (obj.color || obj.hex || (obj.r !== undefined && obj.g !== undefined && obj.b !== undefined)) {
        enableColor = true;
        if (obj.color || obj.hex) color = String(obj.color || obj.hex);
        else color = rgbToHex(Number(obj.r), Number(obj.g), Number(obj.b));
      }
      if (obj.temperature !== undefined || obj.temp !== undefined) {
        enableTemp = true;
        const t = Number(obj.temperature ?? obj.temp);
        if (!Number.isNaN(t)) temperature = Math.max(16, Math.min(32, t));
      }
      if (obj.mode !== undefined) {
        enableMode = true;
        mode = String(obj.mode).toUpperCase();
      }
      if (obj.fan !== undefined || obj.speed !== undefined) {
        enableFan = true;
        fan = String(obj.fan ?? obj.speed).toUpperCase();
      }
      if (obj.gateAction !== undefined || obj.state !== undefined) {
        const ga = String(obj.gateAction ?? obj.state).toUpperCase();
        if (ga === 'OPEN' || ga === 'CLOSE' || ga === 'STOP') gateAction = ga;
      }
    } else if (typeof valueOrParams === 'string' && valueOrParams.trim()) {
      isCustomJson = true;
      customJson = valueOrParams;
    }
  }

  return {
    power,
    enableBrightness,
    brightness,
    enableColor,
    color,
    enableTemp,
    temperature,
    enableMode,
    mode,
    enableFan,
    fan,
    gateAction,
    isCustomJson,
    customJson: isCustomJson ? customJson : Object.keys(obj).length > 0 ? JSON.stringify(obj, null, 2) : '',
  };
}

export function serializeMultiStateToAction(
  state: DeviceMultiActionState,
  device?: AnyDevice
): {
  action: string;
  value: string;
  parameters: Record<string, unknown>;
  summary: string;
} {
  const profile = getDeviceCapabilityProfile(device);

  // 1. Raw Custom JSON
  if (state.isCustomJson && state.customJson?.trim()) {
    try {
      const parsed = JSON.parse(state.customJson) as Record<string, unknown>;
      return {
        action: 'SET_STATE',
        value: JSON.stringify(parsed),
        parameters: parsed,
        summary: 'Tùy chỉnh JSON nâng cao',
      };
    } catch {
      return {
        action: 'SET_STATE',
        value: state.customJson,
        parameters: {},
        summary: 'JSON (Đang soạn thảo)',
      };
    }
  }

  // 2. Gate / Door Device
  if (profile.hasGate) {
    const ga = state.gateAction || 'OPEN';
    const label = ga === 'OPEN' ? 'Mở cửa' : ga === 'CLOSE' ? 'Đóng cửa' : 'Dừng cửa';
    return {
      action: ga,
      value: '',
      parameters: { action: ga },
      summary: label,
    };
  }

  // 3. Multi-capability check (Light with Brightness/Color, AC, Fan)
  const isPowerOff = state.power === 'OFF';
  const hasExtraCaps =
    (profile.hasBrightness && state.enableBrightness) ||
    (profile.hasColor && state.enableColor) ||
    (profile.hasTemperature && state.enableTemp) ||
    (profile.hasMode && state.enableMode) ||
    (profile.hasFan && state.enableFan);

  // If power is OFF and no explicit extra settings, send clean TURN_OFF
  if (isPowerOff && !hasExtraCaps) {
    return {
      action: 'TURN_OFF',
      value: '',
      parameters: { power: 'OFF' },
      summary: 'Tắt nguồn',
    };
  }

  // If TOGGLE and no extra settings, send clean TOGGLE
  if (state.power === 'TOGGLE' && !hasExtraCaps) {
    return {
      action: 'TOGGLE',
      value: '',
      parameters: {},
      summary: 'Đảo bật/tắt',
    };
  }

  // If only Power ON without any extra settings, send clean TURN_ON
  if (state.power === 'ON' && !hasExtraCaps) {
    return {
      action: 'TURN_ON',
      value: '',
      parameters: { power: 'ON' },
      summary: 'Bật nguồn',
    };
  }

  // Combined Multi-capability Payload
  const params: Record<string, unknown> = {
    power: state.power,
  };

  const summaryParts: string[] = [state.power === 'ON' ? 'Bật' : state.power === 'OFF' ? 'Tắt' : 'Đảo bật/tắt'];

  if (profile.hasBrightness && state.enableBrightness) {
    params.brightness = state.brightness;
    params.level = state.brightness;
    summaryParts.push(`Độ sáng ${state.brightness}%`);
  }

  if (profile.hasColor && state.enableColor) {
    params.color = state.color;
    params.hex = state.color;
    const rgb = hexToRgb(state.color);
    if (rgb) {
      params.r = rgb.r;
      params.g = rgb.g;
      params.b = rgb.b;
    }
    summaryParts.push(`Màu ${getColorLabel(state.color)}`);
  }

  if (profile.hasTemperature && state.enableTemp) {
    params.temperature = state.temperature;
    params.temp = state.temperature;
    summaryParts.push(`${state.temperature}°C`);
  }

  if (profile.hasMode && state.enableMode) {
    params.mode = state.mode;
    const modeLabel = AC_MODES.find((m) => m.code === state.mode)?.label ?? state.mode;
    summaryParts.push(modeLabel);
  }

  if (profile.hasFan && state.enableFan) {
    params.fan = state.fan;
    params.speed = state.fan;
    if (profile.isAc) {
      const fanLabel = AC_FAN_LEVELS.find((f) => f.code === state.fan)?.label ?? state.fan;
      summaryParts.push(`Gió ${fanLabel}`);
    } else {
      summaryParts.push(`Tốc độ ${state.fan}%`);
    }
  }

  return {
    action: 'SET_STATE',
    value: JSON.stringify(params),
    parameters: params,
    summary: summaryParts.join(' · '),
  };
}

export function formatMultiActionSummary(
  action: string,
  valueOrParams: unknown,
  devices?: AnyDevice[],
  deviceId?: string
): string {
  const dev = devices?.find((d) => d.id === deviceId);
  const state = parseActionToMultiState(action, valueOrParams, dev);
  const result = serializeMultiStateToAction(state, dev);
  return result.summary;
}
