import { resolveDeviceAppearance, type DeviceModelKind } from '../twin/devices/deviceAppearance';

export type PowerSpriteKind = 'light' | 'fan' | 'ac' | 'tv' | 'plug';

const SPRITE_BY_MODEL: Partial<Record<DeviceModelKind, PowerSpriteKind>> = {
  'ceiling-light': 'light', 'pendant-light': 'light', 'floor-lamp': 'light', 'table-lamp': 'light', 'wall-light': 'light', 'led-strip': 'light',
  'ceiling-fan': 'fan', 'standing-fan': 'fan', ac: 'ac', tv: 'tv', plug: 'plug',
};

/** Same visual inference as the digital twin; null when no Blender sprite exists for the device. */
export function powerSpriteKind(deviceType: string, name = ''): PowerSpriteKind | null {
  return SPRITE_BY_MODEL[resolveDeviceAppearance(deviceType, name).kind] ?? null;
}
