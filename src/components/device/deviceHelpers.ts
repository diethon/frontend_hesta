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
