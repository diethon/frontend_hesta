import type { ApartmentPalette } from './apartmentPalette';
import { useMemo } from 'react';
import { Object3D } from 'three';
import { lighting } from '../v2/materials';

/** The demo and the real house use the same studio and evening light rig. */
export function ApartmentLighting({ palette: p, daylight, compact = false, centerX = 0, centerZ = 0, elevation = 0, extent = 8 }: {
  palette: ApartmentPalette; daylight: boolean; compact?: boolean; centerX?: number; centerZ?: number; elevation?: number; extent?: number;
}) {
  const target = useMemo(() => new Object3D(), []);
  return <>
    <primitive object={target} position={[centerX, elevation, centerZ]} />
    <ambientLight intensity={daylight ? .3 : .15} color={lighting.sky} />
    <hemisphereLight args={[lighting.sky, lighting.ground, daylight ? .7 : .35]} />
    <directionalLight position={[centerX - 5, elevation + 12, centerZ + 7]} target={target} intensity={daylight ? 2.5 : .65} color={daylight ? lighting.sun : p.warm} castShadow shadow-mapSize={[compact ? 1024 : 2048, compact ? 1024 : 2048]} shadow-camera-left={-extent} shadow-camera-right={extent} shadow-camera-top={extent} shadow-camera-bottom={-extent} shadow-camera-far={elevation + 100} shadow-normalBias={.018} shadow-bias={-.00008} shadow-radius={4} />
    <directionalLight position={[centerX + 6, elevation + 8, centerZ - 6]} target={target} intensity={daylight ? .45 : .16} color={lighting.fill} />
  </>;
}
