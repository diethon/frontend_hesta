import type { TwinDeviceView } from '../../../types/twinView';
export const boundedPercent = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : fallback;
export function lightColor(device: TwinDeviceView, fallback: string) {
  const color = device.state.color ?? device.state.rgb;
  if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) return color;
  const rgb = color && typeof color === 'object' && !Array.isArray(color) ? color : device.state;
  const values = [rgb.r, rgb.g, rgb.b];
  return values.every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 255)
    ? `#${values.map((v) => Math.round(v as number).toString(16).padStart(2, '0')).join('')}` : fallback;
}
export function openingFraction(device: TwinDeviceView) {
  if (typeof device.state.position === 'number') return boundedPercent(device.state.position, 0) / 100;
  return device.state.open === true || device.state.state === 'OPEN' || device.state.status === 'OPEN' ? 1 : 0;
}
