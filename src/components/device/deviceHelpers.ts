import type { DeviceResponse } from '../../types/device';

export const KNOWN_NON_AC_TYPES = new Set([
  'LIGHT',
  'LED_RGB',
  'SMART_PLUG',
  'TEMP_HUMID_SENSOR',
  'MOTION_SENSOR',
  'SMOKE_SENSOR',
  'FLAME_SENSOR',
  'GATE',
  'GATE_MOTOR',
  'ROLLING_DOOR',
  'DOOR',
  'CURTAIN',
  'CAMERA_AI',
  'LUX_SENSOR',
  'FAN',
  'WATER_PUMP',
  'TV',
]);

export const APERTURE_DEVICE_TYPES = new Set([
  'DOOR',
  'ROLLING_DOOR',
  'GATE',
  'GATE_MOTOR',
  'CURTAIN',
]);

export const isApertureDeviceType = (type?: string | null): boolean =>
  APERTURE_DEVICE_TYPES.has((type || '').trim().toUpperCase());

export const isRgbLightDevice = (
  device?: { deviceType?: string | null; raw?: { deviceType?: string | null } } | null,
): boolean => {
  const rawType = (device?.raw?.deviceType ?? device?.deviceType ?? '').trim().toUpperCase();
  return rawType === 'LED_RGB';
};

export const isFanDevice = (
  device?: { deviceType?: string | null; raw?: { deviceType?: string | null } } | null,
): boolean => {
  const rawType = (device?.raw?.deviceType ?? device?.deviceType ?? '').trim().toUpperCase();
  return rawType === 'FAN' || rawType === 'SMART_FAN';
};

export const isTvDevice = (
  device?: { deviceType?: string | null; raw?: { deviceType?: string | null } } | null,
): boolean => {
  const rawType = (device?.raw?.deviceType ?? device?.deviceType ?? '').trim().toUpperCase();
  return rawType === 'TV' || rawType === 'SMART_TV';
};

export const isWaterPumpDevice = (
  device?: { deviceType?: string | null; raw?: { deviceType?: string | null } } | null,
): boolean => (device?.raw?.deviceType ?? device?.deviceType ?? '').trim().toUpperCase() === 'WATER_PUMP';

export const isDoorDevice = (
  device?: { deviceType?: string | null; raw?: { deviceType?: string | null } } | null,
): boolean => (device?.raw?.deviceType ?? device?.deviceType ?? '').trim().toUpperCase() === 'DOOR';

export const AC_MODE_LABEL_TO_CODE: Record<string, string> = {
  'Lạnh': 'COOL',
  'Hút ẩm': 'DRY',
  'Sưởi': 'HEAT',
  'Tự động': 'AUTO',
  COOL: 'COOL',
  DRY: 'DRY',
  HEAT: 'HEAT',
  AUTO: 'AUTO',
};

export const AC_MODE_CODE_TO_LABEL: Record<string, string> = {
  COOL: 'Lạnh',
  DRY: 'Hút ẩm',
  HEAT: 'Sưởi',
  AUTO: 'Tự động',
};

export const AC_FAN_LABEL_TO_CODE: Record<string, string> = {
  'Tự động': 'AUTO',
  'Thấp': 'LOW',
  'Vừa': 'MID',
  'Cao': 'HIGH',
  AUTO: 'AUTO',
  LOW: 'LOW',
  MID: 'MID',
  HIGH: 'HIGH',
};

export const AC_FAN_CODE_TO_LABEL: Record<string, string> = {
  AUTO: 'Tự động',
  LOW: 'Thấp',
  MID: 'Vừa',
  HIGH: 'Cao',
};

export const resolveFanSpeedLevel = (state?: Record<string, unknown> | null): 0 | 1 | 2 | 3 => {
  if (!state) return 0;
  const raw = state.speed ?? state.fan ?? state.fanSpeed;
  if (raw === undefined || raw === null) return 0;
  if (typeof raw === 'number') {
    if (raw <= 0) return 0;
    if (raw === 1) return 1;
    if (raw === 2) return 2;
    return 3;
  }
  const s = String(raw).trim().toUpperCase();
  if (s === '0' || s === 'OFF') return 0;
  if (s === '1' || s === 'LOW' || s === 'THẤP') return 1;
  if (s === '2' || s === 'MED' || s === 'MID' || s === 'MEDIUM' || s === 'VỪA') return 2;
  if (s === '3' || s === 'HIGH' || s === 'CAO') return 3;
  const num = Number(s);
  if (!Number.isNaN(num) && num > 0) return num >= 3 ? 3 : num >= 2 ? 2 : 1;
  return 0;
};

export interface ExtractedSensorMetrics {
  temperature?: number;
  humidity?: number;
  lux?: number;
  lightBinary?: boolean;
  motion?: boolean;
  smoke?: boolean | number;
  gasPpm?: number;
  flame?: boolean;
  co2?: number;
  pm25?: number;
  battery?: number;
  rssi?: number;
}

const pickCaseInsensitive = (state: Record<string, unknown>, keys: string[]): unknown => {
  for (const key of keys) {
    if (state[key] !== undefined && state[key] !== null) return state[key];
  }
  const lowerMap = new Map<string, unknown>();
  for (const [k, v] of Object.entries(state)) {
    if (v !== undefined && v !== null) lowerMap.set(k.toLowerCase(), v);
  }
  for (const key of keys) {
    const hit = lowerMap.get(key.toLowerCase());
    if (hit !== undefined) return hit;
  }
  return undefined;
};

const toNumOrUndefined = (val: unknown): number | undefined => {
  if (val === undefined || val === null || typeof val === 'boolean') return undefined;
  const n = Number(val);
  return Number.isNaN(n) ? undefined : n;
};

const toBoolOrUndefined = (val: unknown): boolean | undefined => {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val > 0;
  const s = String(val).trim().toUpperCase();
  if (['TRUE', '1', 'ON', 'DETECTED', 'BRIGHT', 'ALERT', 'FIRE', 'YES'].includes(s)) return true;
  if (['FALSE', '0', 'OFF', 'CLEAR', 'DARK', 'SAFE', 'NO'].includes(s)) return false;
  return undefined;
};

export const extractSensorMetrics = (
  state?: Record<string, unknown> | null,
): ExtractedSensorMetrics => {
  if (!state || typeof state !== 'object') return {};
  const temperature = toNumOrUndefined(pickCaseInsensitive(state, ['temperature', 'temp']));
  const humidity = toNumOrUndefined(pickCaseInsensitive(state, ['humidity', 'hum', 'humid']));

  const rawLux = pickCaseInsensitive(state, ['lux', 'illuminance']);
  const rawLightFlag = pickCaseInsensitive(state, ['LIGHT_SENSOR', 'light_sensor', 'light']);
  let lux = toNumOrUndefined(rawLux);
  let lightBinary: boolean | undefined;
  if (rawLightFlag !== undefined) {
    if (typeof rawLightFlag === 'string' && (rawLightFlag.toUpperCase() === 'BRIGHT' || rawLightFlag.toUpperCase() === 'DARK')) {
      lightBinary = rawLightFlag.toUpperCase() === 'BRIGHT';
    } else {
      const n = Number(rawLightFlag);
      if (!Number.isNaN(n)) {
        if (n === 0 || n === 1) {
          lightBinary = n === 1;
        } else if (lux === undefined) {
          lux = n;
        }
      } else {
        lightBinary = toBoolOrUndefined(rawLightFlag);
      }
    }
  }
  if (lightBinary === undefined && lux !== undefined) {
    lightBinary = lux > 200;
  }

  const rawMotion = pickCaseInsensitive(state, ['motion', 'MOTION_SENSOR', 'motion_sensor', 'motionDetected']);
  const motion = toBoolOrUndefined(rawMotion);

  const rawSmoke = pickCaseInsensitive(state, ['smoke', 'SMOKE_SENSOR', 'smoke_sensor', 'smokeDetected']);
  let smoke: boolean | number | undefined;
  if (rawSmoke !== undefined) {
    if (typeof rawSmoke === 'boolean') smoke = rawSmoke;
    else {
      const n = Number(rawSmoke);
      smoke = !Number.isNaN(n) ? n : toBoolOrUndefined(rawSmoke);
    }
  }

  const gasPpm = toNumOrUndefined(pickCaseInsensitive(state, ['gas_ppm', 'gas', 'mq2']));
  const flame = toBoolOrUndefined(pickCaseInsensitive(state, ['flame', 'FLAME_SENSOR', 'flame_sensor', 'fire', 'flameDetected']));
  const co2 = toNumOrUndefined(pickCaseInsensitive(state, ['co2']));
  const pm25 = toNumOrUndefined(pickCaseInsensitive(state, ['pm25', 'pm2_5']));
  const battery = toNumOrUndefined(pickCaseInsensitive(state, ['battery']));
  const rssi = toNumOrUndefined(pickCaseInsensitive(state, ['rssi']));

  return {
    temperature,
    humidity,
    lux,
    lightBinary,
    motion,
    smoke,
    gasPpm,
    flame,
    co2,
    pm25,
    battery,
    rssi,
  };
};

export const normalizeSensorReadingPatch = (
  metricType?: string | null,
  value?: unknown,
): Record<string, unknown> => {
  if (!metricType || value === undefined || value === null) return {};
  const m = metricType.trim();
  const ml = m.toLowerCase();
  const patch: Record<string, unknown> = { [m]: value };
  if (ml === 'temp' || ml === 'temperature') {
    patch.temperature = value;
  } else if (ml === 'hum' || ml === 'humid' || ml === 'humidity') {
    patch.humidity = value;
  } else if (ml === 'light' || ml === 'light_sensor' || ml === 'lux' || ml === 'illuminance') {
    patch.lux = value;
    if (ml === 'light' || ml === 'light_sensor') patch.LIGHT_SENSOR = value;
  } else if (ml === 'motion' || ml === 'motion_sensor') {
    patch.motion = toBoolOrUndefined(value) ?? Boolean(value);
  } else if (ml === 'smoke' || ml === 'smoke_sensor') {
    patch.smoke = value;
  } else if (ml === 'gas' || ml === 'gas_ppm') {
    patch.gas = value;
    patch.gas_ppm = value;
  } else if (ml === 'flame' || ml === 'flame_sensor' || ml === 'fire') {
    patch.flame = toBoolOrUndefined(value) ?? Boolean(value);
  }
  return patch;
};

export const APERTURE_TRANSIT_LOCK_MS = 4500;

export interface ApertureInterlockState {
  state: string;
  isOpen: boolean;
  isClosed: boolean;
  isOpening: boolean;
  isClosing: boolean;
  isStopped: boolean;
  isMoving: boolean;
  disableOpen: boolean;
  disableClose: boolean;
  disableStop: boolean;
}

/**
 * Interlock state machine for limitless motorized apertures (DOOR, ROLLING_DOOR, GATE, GATE_MOTOR, CURTAIN).
 * Locks OPEN when OPEN or moving, locks CLOSE when CLOSED or moving, and only enables STOP while moving.
 */
export const getApertureInterlock = (
  rawState?: unknown,
  transitLocked = false,
): ApertureInterlockState => {
  const state = String(rawState ?? '').trim().toUpperCase();
  const isOpening = state === 'OPENING';
  const isClosing = state === 'CLOSING';
  const isStopped = state === 'STOPPED' || state === 'STOP';
  const isMoving = isOpening || isClosing || transitLocked;
  const isOpen = state === 'OPEN';
  const isClosed = state === 'CLOSED' || state === 'CLOSE';

  return {
    state,
    isOpen,
    isClosed,
    isOpening,
    isClosing,
    isStopped,
    isMoving,
    disableOpen: isOpen || isMoving,
    disableClose: isClosed || isMoving,
    disableStop: !isMoving,
  };
};

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
  if (device.accessLevel === 'VIEW' || device.accessLevel === 'NONE') return false;
  const type = resolveEffectiveType(device);
  return ['LIGHT', 'LED_RGB', 'SMART_PLUG', 'AIR_CONDITIONER'].includes(type);
};

export const canControlDevice = (device: DeviceResponse): boolean => {
  return device.accessLevel !== 'VIEW' && device.accessLevel !== 'NONE';
};

export const isReadOnlyDevice = (device: DeviceResponse): boolean => {
  return device.accessLevel === 'VIEW';
};

/**
 * Determine if a device card should span 2 columns in a bento grid (wide card)
 * for rich inline controls (like AC, Gate, Camera).
 */
export const isWideCard = (device: DeviceResponse): boolean => {
  const type = resolveEffectiveType(device);
  return type === 'AIR_CONDITIONER' || type === 'CAMERA_AI' || isApertureDeviceType(type);
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
    } else if (isApertureDeviceType(effectiveType)) {
      hasGate = true;
    }
  }

  if (effectiveType === 'LIGHT') {
    hasColor = false;
    colorActions.length = 0;
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
