import type { TwinDeviceView } from '../../../types/twinView';
function numericState(value: unknown): number | null {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
export const boundedPercent = (value: unknown, fallback: number) => {
  const number = numericState(value);
  return number === null ? fallback : Math.max(0, Math.min(100, number));
};
export function lightColor(device: TwinDeviceView, fallback: string) {
  const color = device.state.color ?? device.state.rgb;
  if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) return color;
  const rgb = color && typeof color === 'object' && !Array.isArray(color) ? color : device.state;
  const values = [rgb.r, rgb.g, rgb.b];
  return values.every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 255)
    ? `#${values.map((v) => Math.round(v as number).toString(16).padStart(2, '0')).join('')}` : fallback;
}
export function openingFraction(device: TwinDeviceView) {
  if (numericState(device.state.position) !== null) return boundedPercent(device.state.position, 0) / 100;
  return device.state.open === true || device.state.state === 'OPEN' || device.state.status === 'OPEN' ? 1 : 0;
}

/** SET_FAN is returned as `fan`; SET_SPEED uses `speed`. Both are backend state. */
export function fanSpeed(device: TwinDeviceView): number {
  const value = device.state.speed ?? device.state.fan ?? device.state.fanSpeed;
  const number = numericState(value);
  if (number !== null) return boundedPercent(number, 50);
  const levels: Record<string, number> = { OFF: 0, LOW: 25, MEDIUM: 55, HIGH: 100, AUTO: 50 };
  return typeof value === 'string' ? levels[value.trim().toUpperCase()] ?? 50 : 50;
}
