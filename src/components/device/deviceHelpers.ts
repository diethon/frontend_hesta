import type { DeviceResponse } from '../../types/device';

export const KNOWN_NON_AC_TYPES = new Set([
  'LIGHT',
  'LED_RGB',
  'SMART_PLUG',
  'TEMP_HUMID_SENSOR',
  'MOTION_SENSOR',
  'SMOKE_SENSOR',
  'GATE',
  'ROLLING_DOOR',
  'CAMERA_AI',
  'LUX_SENSOR',
  'FAN',
]);

/**
 * Detect if a device represents or controls an Air Conditioner.
 * In HESTA, air conditioners are controlled either directly (AIR_CONDITIONER)
 * or via an ESP32 Infrared transmitter (IR_REMOTE), or identified by name.
 */
export const isAcDevice = (device: DeviceResponse): boolean => {
  if (!device) return false;
  if (device.deviceType === 'AIR_CONDITIONER') return true;

  // Non-AC device types must never be misclassified as an AC
  if (device.deviceType && KNOWN_NON_AC_TYPES.has(device.deviceType)) {
    return false;
  }

  const nameLower = (device.name || '').toLowerCase();
  if (
    nameLower.includes('điều hòa') ||
    nameLower.includes('máy lạnh') ||
    nameLower.includes('air conditioner') ||
    nameLower.includes('thermostat') ||
    nameLower.includes('daikin') ||
    nameLower.includes('panasonic') ||
    nameLower.includes('casper') ||
    nameLower.includes('lg ac')
  ) {
    return true;
  }

  const caps = device.capabilities;
  if (caps) {
    const allActions = Object.values(caps).flat();
    if (allActions.some((a) => ['SET_TEMPERATURE', 'SET_MODE', 'SET_FAN', 'SET_SWING'].includes(a))) {
      return true;
    }
  }

  return false;
};

/**
 * Get effective device type for UI rendering and dispatching specialized cards.
 */
export const resolveEffectiveType = (device: DeviceResponse): string => {
  if (!device) return 'UNKNOWN';
  if (device.deviceType === 'AIR_CONDITIONER') return 'AIR_CONDITIONER';
  if (device.deviceType && KNOWN_NON_AC_TYPES.has(device.deviceType)) {
    return device.deviceType;
  }
  if (isAcDevice(device)) return 'AIR_CONDITIONER';
  return device.deviceType || 'UNKNOWN';
};

/**
 * Resolve the power state from currentState.
 */
export const getPowerState = (device: DeviceResponse): 'ON' | 'OFF' => {
  const p = device.currentState?.power;
  return p === 'ON' || p === true || p === 'true' ? 'ON' : 'OFF';
};

/**
 * Check if a device type has a direct toggleable power switch.
 */
export const isControllable = (device: DeviceResponse): boolean => {
  const type = resolveEffectiveType(device);
  return ['LIGHT', 'LED_RGB', 'SMART_PLUG', 'AIR_CONDITIONER'].includes(type);
};

/**
 * Determine if a device card should span 2 columns in a bento grid (wide card)
 * for rich inline controls (like AC, Gate, Camera).
 */
export const isWideCard = (device: DeviceResponse): boolean => {
  const type = resolveEffectiveType(device);
  return ['AIR_CONDITIONER', 'GATE', 'ROLLING_DOOR', 'CAMERA_AI'].includes(type);
};

/**
 * Safely resolve RGB color from device currentState.
 * Handles both flat { r, g, b } and nested { color: { r, g, b } } formats.
 */
export const resolveDeviceRgb = (
  currentState?: Record<string, unknown>
): { r: number; g: number; b: number } | undefined => {
  if (!currentState) return undefined;

  // Case 1: Nested color object { color: { r, g, b } }
  if (currentState.color && typeof currentState.color === 'object') {
    const c = currentState.color as Record<string, unknown>;
    const r = Number(c.r);
    const g = Number(c.g);
    const b = Number(c.b);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return {
        r: Math.max(0, Math.min(255, Math.round(r))),
        g: Math.max(0, Math.min(255, Math.round(g))),
        b: Math.max(0, Math.min(255, Math.round(b))),
      };
    }
  }

  // Case 2: Flat r, g, b fields in currentState { r, g, b }
  if (currentState.r !== undefined && currentState.g !== undefined && currentState.b !== undefined) {
    const r = Number(currentState.r);
    const g = Number(currentState.g);
    const b = Number(currentState.b);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return {
        r: Math.max(0, Math.min(255, Math.round(r))),
        g: Math.max(0, Math.min(255, Math.round(g))),
        b: Math.max(0, Math.min(255, Math.round(b))),
      };
    }
  }

  return undefined;
};

/**
 * Convert RGB numbers (0-255) to hex string #rrggbb
 */
export const rgbToHex = (r: number, g: number, b: number): string => {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(Number(v) || 0)));
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/**
 * Normalizes device capabilities from database/API into a structured Record<string, string[]>.
 * Handles:
 * - Map: { "COLOR": ["SET_RGB"], "POWER": ["TURN_ON", "TURN_OFF", "TOGGLE"], "BRIGHTNESS": ["SET_BRIGHTNESS"] }
 * - Array: ["TURN_ON", "SET_BRIGHTNESS", "SET_RGB"]
 * - JSON string from raw backend payloads.
 */
export const normalizeDeviceCapabilities = (
  raw?: Record<string, string[]> | string[] | string | null,
): Record<string, string[]> => {
  if (!raw) return {};

  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {};
    }
  }

  if (Array.isArray(parsed)) {
    const map: Record<string, string[]> = {};
    for (const item of parsed) {
      const act = String(item).trim().toUpperCase();
      if (['TURN_ON', 'TURN_OFF', 'TOGGLE'].includes(act)) {
        map.POWER = [...(map.POWER || []), act];
      } else if (['SET_BRIGHTNESS'].includes(act)) {
        map.BRIGHTNESS = [...(map.BRIGHTNESS || []), act];
      } else if (['SET_RGB', 'SET_COLOR'].includes(act)) {
        map.COLOR = [...(map.COLOR || []), act];
      } else if (['SET_TEMPERATURE'].includes(act)) {
        map.CLIMATE = [...(map.CLIMATE || []), act];
      } else if (['SET_SPEED', 'SET_FAN'].includes(act)) {
        map.SPEED = [...(map.SPEED || []), act];
      } else if (['OPEN', 'CLOSE', 'STOP'].includes(act)) {
        map.GATE = [...(map.GATE || []), act];
      } else {
        map[act] = [act];
      }
    }
    return map;
  }

  if (typeof parsed === 'object' && parsed !== null) {
    const result: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const upperKey = key.trim().toUpperCase();
      if (Array.isArray(value)) {
        result[upperKey] = value.map((v) => String(v).trim().toUpperCase());
      } else if (typeof value === 'string') {
        result[upperKey] = [value.trim().toUpperCase()];
      } else {
        result[upperKey] = [];
      }
    }
    return result;
  }

  return {};
};

export interface DeviceCapabilityMap {
  hasPower: boolean;
  hasBrightness: boolean;
  hasColor: boolean;
  hasTemperature: boolean;
  hasSpeed: boolean;
  hasMode: boolean;
  hasGate: boolean;
  isAc: boolean;
  powerActions: string[];
  colorActions: string[];
  brightnessActions: string[];
}

/**
 * Returns a detailed capability map for any device based on database capabilities and device type fallback.
 * Checks COLOR (SET_RGB), POWER (TURN_ON, TURN_OFF, TOGGLE), BRIGHTNESS (SET_BRIGHTNESS), etc.
 */
export const getDeviceCapabilityMap = (device?: DeviceResponse | any): DeviceCapabilityMap => {
  if (!device) {
    return {
      hasPower: true,
      hasBrightness: false,
      hasColor: false,
      hasTemperature: false,
      hasSpeed: false,
      hasMode: false,
      hasGate: false,
      isAc: false,
      powerActions: ['TURN_ON', 'TURN_OFF', 'TOGGLE'],
      colorActions: [],
      brightnessActions: [],
    };
  }

  const isAc = isAcDevice(device);
  const effectiveType = isAc ? 'AIR_CONDITIONER' : resolveEffectiveType(device).toUpperCase();
  const caps = normalizeDeviceCapabilities(device.capabilities);

  const hasExplicitCaps = Object.keys(caps).length > 0;

  let hasPower = false;
  let hasBrightness = false;
  let hasColor = false;
  let hasTemperature = false;
  let hasSpeed = false;
  let hasMode = false;
  let hasGate = false;

  const powerActions: string[] = [];
  const colorActions: string[] = [];
  const brightnessActions: string[] = [];

  if (hasExplicitCaps) {
    for (const [key, actions] of Object.entries(caps)) {
      const k = key.toUpperCase();
      const allActs = actions.map((a) => a.toUpperCase());

      if (k === 'POWER' || allActs.some((a) => ['TURN_ON', 'TURN_OFF', 'TOGGLE', 'SET_POWER'].includes(a))) {
        hasPower = true;
        for (const a of allActs) {
          if (['TURN_ON', 'TURN_OFF', 'TOGGLE'].includes(a) && !powerActions.includes(a)) {
            powerActions.push(a);
          }
        }
      }

      if (k === 'BRIGHTNESS' || allActs.includes('SET_BRIGHTNESS')) {
        hasBrightness = true;
        if (!brightnessActions.includes('SET_BRIGHTNESS')) brightnessActions.push('SET_BRIGHTNESS');
      }

      if (k === 'COLOR' || k === 'RGB' || allActs.some((a) => ['SET_RGB', 'SET_COLOR'].includes(a))) {
        hasColor = true;
        for (const a of allActs) {
          if (['SET_RGB', 'SET_COLOR'].includes(a) && !colorActions.includes(a)) {
            colorActions.push(a);
          }
        }
        if (!colorActions.includes('SET_RGB')) colorActions.push('SET_RGB');
      }

      if (k === 'CLIMATE' || k === 'TEMPERATURE' || allActs.includes('SET_TEMPERATURE')) {
        hasTemperature = true;
      }

      if (k === 'SPEED' || k === 'FAN' || allActs.some((a) => ['SET_SPEED', 'SET_FAN'].includes(a))) {
        hasSpeed = true;
      }

      if (k === 'MODE' || allActs.includes('SET_MODE')) {
        hasMode = true;
      }

      if (k === 'GATE' || k === 'DOOR' || allActs.some((a) => ['OPEN', 'CLOSE', 'STOP'].includes(a))) {
        hasGate = true;
      }
    }
  }

  // If AC detected (either via caps, type, or device name)
  if (isAc) {
    hasPower = true;
    hasTemperature = true;
    hasMode = true;
    hasSpeed = true;
  }

  // Fallback defaults based on device type if capabilities was empty
  if (!hasExplicitCaps) {
    if (effectiveType === 'LED_RGB') {
      hasPower = true;
      hasBrightness = true;
      hasColor = true;
      colorActions.push('SET_RGB', 'SET_COLOR');
      brightnessActions.push('SET_BRIGHTNESS');
      powerActions.push('TURN_ON', 'TURN_OFF', 'TOGGLE');
    } else if (effectiveType === 'LIGHT' || effectiveType === 'LED') {
      hasPower = true;
      hasBrightness = true;
      brightnessActions.push('SET_BRIGHTNESS');
      powerActions.push('TURN_ON', 'TURN_OFF');
    } else if (effectiveType === 'FAN') {
      hasPower = true;
      hasSpeed = true;
      powerActions.push('TURN_ON', 'TURN_OFF');
    } else if (effectiveType === 'SOCKET' || effectiveType === 'SMART_PLUG') {
      hasPower = true;
      powerActions.push('TURN_ON', 'TURN_OFF', 'TOGGLE');
    } else if (effectiveType === 'GATE' || effectiveType === 'ROLLING_DOOR') {
      hasGate = true;
    }
  }

  if (hasPower && powerActions.length === 0) {
    powerActions.push('TURN_ON', 'TURN_OFF', 'TOGGLE');
  }

  return {
    hasPower,
    hasBrightness,
    hasColor,
    hasTemperature,
    hasSpeed,
    hasMode,
    hasGate,
    isAc,
    powerActions,
    colorActions,
    brightnessActions,
  };
};
