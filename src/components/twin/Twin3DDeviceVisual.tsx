import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Group } from 'three';
import type { TwinDeviceSnapshotResponse } from '../../types/twin';
import type { Twin3DPalette } from './twin3dPalette';
import { deviceVisualKind, knownPower } from './twinPresentation';
import { useReducedMotion } from './useTwinMotion';

export function Twin3DDeviceVisual({ device, palette }: { device: TwinDeviceSnapshotResponse; palette: Twin3DPalette }) {
  const kind = deviceVisualKind(device.deviceType);
  // Offline state is historical; do not suggest the device is still operating.
  const powered = knownPower(device.currentState) === true && device.status === 'ONLINE' && device.healthStatus === 'ACTIVE';
  const blades = useRef<Group>(null);
  const reduced = useReducedMotion();
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => { invalidate(); }, [invalidate, powered, reduced]);
  useFrame((_, delta) => {
    if (kind === 'fan' && powered && !reduced && blades.current) {
      blades.current.rotation.y += Math.min(delta, .05) * 2.5;
      invalidate();
    }
  });
  if (kind === 'light') return <group>
    <mesh position={[0, .13, 0]}><sphereGeometry args={[.23, 12, 8]} /><meshStandardMaterial color={powered ? palette.warningSoft : palette.surface} emissive={palette.warning} emissiveIntensity={powered ? .7 : 0} /></mesh>
    {powered ? <pointLight position={[0, .3, 0]} color={palette.warningSoft} intensity={.65} distance={4.5} decay={2} /> : null}
  </group>;
  if (kind === 'fan') return <group ref={blades} position={[0, .16, 0]}>
    {[0, 1, 2].map((blade) => <mesh key={blade} rotation={[0, blade * Math.PI * 2 / 3, 0]} position={[0, 0, 0]}><boxGeometry args={[.7, .06, .13]} /><meshStandardMaterial color={palette.fabricAccent} /></mesh>)}
    <mesh><sphereGeometry args={[.12, 10, 8]} /><meshStandardMaterial color={palette.surface} /></mesh>
  </group>;
  if (kind === 'ac') return <group>
    <mesh position={[0, .15, 0]}><boxGeometry args={[.65, .28, .22]} /><meshStandardMaterial color={palette.surface} /></mesh>
    <mesh position={[0, .11, .12]}><boxGeometry args={[.48, .035, .015]} /><meshStandardMaterial color={powered ? palette.primary : palette.off} emissive={palette.primary} emissiveIntensity={powered ? .5 : 0} /></mesh>
    {powered ? [0, 1, 2].map((line) => <mesh key={line} position={[(line - 1) * .16, -.03, .16]} rotation={[-.5, 0, 0]}><boxGeometry args={[.025, .18, .025]} /><meshStandardMaterial color={palette.primary} transparent opacity={.55} /></mesh>) : null}
  </group>;
  if (kind === 'plug' || kind === 'remote') return <mesh position={[0, .13, 0]}>
    <boxGeometry args={kind === 'plug' ? [.32, .3, .22] : [.23, .09, .48]} /><meshStandardMaterial color={palette.surface} roughness={.6} />
  </mesh>;
  return null;
}
