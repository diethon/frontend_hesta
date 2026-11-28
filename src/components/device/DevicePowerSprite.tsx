import type { PowerSpriteKind } from './powerSprite';
import './device-power-sprite.css';

/**
 * Blender-rendered device that plays off → on when `on` turns true and back when it turns false.
 * Frames come from public/device-sprites/<kind>.webp (scripts/blender/hesta_devices.py). Fills its container.
 */
export function DevicePowerSprite({ kind, on }: { kind: PowerSpriteKind; on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`power-sprite power-sprite--${kind}${on ? ' is-on' : ''}`}
      style={{ backgroundImage: `url(${import.meta.env.BASE_URL}device-sprites/${kind}.webp)` }}
    />
  );
}
