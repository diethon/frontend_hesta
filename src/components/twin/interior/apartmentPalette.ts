import { readTwin3DPalette, type Twin3DPalette } from '../twin3dPalette';

export function readApartmentPalette(base?: Twin3DPalette) {
  const p = base ?? readTwin3DPalette();
  const styles = getComputedStyle(document.documentElement);
  const get = (name: string) => styles.getPropertyValue(`--color-twin-demo-${name}`).trim();
  return { ...p, wall: get('wall'), floor: get('floor'), sofa: get('sofa'), cushion: get('cushion'), rug: get('rug'), brass: get('brass'), night: get('night'), warm: get('warm'), rose: styles.getPropertyValue('--color-error').trim() };
}
export type ApartmentPalette = ReturnType<typeof readApartmentPalette>;
