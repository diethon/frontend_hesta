import type { DeviceResponse } from '../../types/device';

/**
 * Detect if a device represents or controls an Air Conditioner.
 * In HESTA, air conditioners are controlled either directly (AIR_CONDITIONER)
 * or via an ESP32 Infrared transmitter (IR_REMOTE), or identified by name.
 */
export const isAcDevice = (device: DeviceResponse): boolean => {
  if (!device) return false;
  if (device.deviceType === 'AIR_CONDITIONER') return true;
  if (device.deviceType === 'IR_REMOTE') return true;

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

  const s = device.currentState;
  if (s && (s.temperature !== undefined || s.mode !== undefined || s.fan !== undefined)) {
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
