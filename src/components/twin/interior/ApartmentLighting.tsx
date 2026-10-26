import type { ApartmentPalette } from './apartmentPalette';
import { useMemo } from 'react';
import { Object3D } from 'three';

/** The demo and the real house use the same studio and evening light rig. */
export function ApartmentLighting({ palette: p, daylight, compact = false, centerX = 0, centerZ = 0, elevation = 0, extent = 8 }: {
  palette: ApartmentPalette; daylight: boolean; compact?: boolean; centerX?: number; centerZ?: number; elevation?: number; extent?: number;
}) {
  const target = useMemo(() => new Object3D(), []);
  return <>
    <primitive object={target} position={[centerX, elevation, centerZ]} />
    <ambientLight intensity={daylight ? .8 : .17} color={p.glass} />
    <hemisphereLight args={[p.surface, p.floor, daylight ? 1.1 : .35]} />
    <directionalLight position={[centerX - 3, elevation + 9, centerZ + 5]} target={target} intensity={daylight ? 2.2 : .45} color={p.warm} castShadow shadow-mapSize={[compact ? 512 : 1024, compact ? 512 : 1024]} shadow-camera-left={-extent} shadow-camera-right={extent} shadow-camera-top={extent} shadow-camera-bottom={-extent} shadow-camera-far={elevation + 70} shadow-normalBias={.04} />
    <directionalLight position={[centerX + 7, elevation + 4, centerZ - 5]} target={target} intensity={daylight ? .7 : .35} color={p.glass} />
  </>;
}
