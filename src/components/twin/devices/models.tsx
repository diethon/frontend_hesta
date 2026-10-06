import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { DoubleSide, Group } from 'three';
import type { TwinDeviceView } from '../../../types/twinView';
import type { Twin3DPalette } from '../twin3dPalette';
import { useReducedMotion } from '../useTwinMotion';
import { GeoBuffer } from '../neonplan/viewer/geo';
import { pushLampModel } from '../neonplan/viewer/lamps';
import { pushCameraModel } from '../neonplan/viewer/furniture';
import { boundedPercent, lightColor } from './deviceVisualState';
import { ArchitecturalOpeningModel } from './ArchitecturalOpeningModel';
import type { OpeningInfo } from '../neonplan/viewer/build';
import { useTwinResource } from '../hooks/useTwinResource';

function createPendantGeometry() {
  const buffer = new GeoBuffer();
  pushLampModel(buffer, { x: 0, z: 0, lamp: 'pendant', variant: 'drum', size: [.44, .44, .65] }, 2.25, 0xfff5df);
  const geometry = buffer.geometry();
  geometry.translate(0, -2.25, 0);
  return geometry;
}
function createCameraGeometry() {
  const buffer = new GeoBuffer();
  pushCameraModel(buffer, 'camera_wall', 0, 0, 0, 0);
  return buffer.geometry();
}

export interface DeviceModelProps { device: TwinDeviceView; palette: Twin3DPalette; opening?: OpeningInfo }
export function LightModel({ device, palette }: DeviceModelProps) {
  const brightness = boundedPercent(device.state.brightness ?? device.state.level, 100) / 100;
  const color = lightColor(device, palette.lightOn);
  const geometry = useTwinResource('device-pendant-drum', createPendantGeometry);
  return <group><mesh castShadow><primitive attach="geometry" object={geometry} /><meshStandardMaterial vertexColors color={device.powered ? color : palette.off} emissive={color} emissiveIntensity={device.powered ? brightness * .65 : 0} roughness={.55} /></mesh>
    {device.powered && brightness > 0 ? <pointLight position={[0, -.55, 0]} color={color} intensity={brightness * 16} distance={9} decay={2} /> : null}</group>;
}
export function FanModel({ device, palette }: DeviceModelProps) {
  const blades = useRef<Group>(null), reduced = useReducedMotion(), invalidate = useThree((state) => state.invalidate);
  const speed = typeof device.state.speed === 'string' ? ({ LOW: 25, MEDIUM: 55, HIGH: 100 }[device.state.speed] ?? 50) : boundedPercent(device.state.speed, 50);
  useFrame((_, delta) => { if (!device.powered || reduced || !blades.current || speed === 0) return; blades.current.rotation.y += Math.min(delta, .05) * (1 + speed / 12); invalidate(); });
  return <group><mesh position={[0, -.12, 0]} castShadow><cylinderGeometry args={[.035, .035, .24, 8]} /><meshStandardMaterial color={palette.metal} /></mesh><group ref={blades} position={[0, -.3, 0]}>{[0, 1, 2].map((blade) => <group key={blade} rotation={[0, blade * Math.PI * 2 / 3, 0]}><mesh position={[.36, 0, 0]} castShadow><boxGeometry args={[.62, .035, .16]} /><meshStandardMaterial color={device.online ? palette.wood : palette.off} /></mesh></group>)}<mesh castShadow><sphereGeometry args={[.12, 12, 8]} /><meshStandardMaterial color={palette.surface} /></mesh></group></group>;
}
export function AirConditionerModel({ device, palette }: DeviceModelProps) {
  return <group><mesh castShadow><boxGeometry args={[.98, .3, .22]} /><meshStandardMaterial color={device.online ? palette.surface : palette.off} roughness={.6} /></mesh><mesh position={[0, -.09, .12]} rotation={[device.powered ? -.3 : 0, 0, 0]}><boxGeometry args={[.83, .045, .03]} /><meshStandardMaterial color={palette.metal} /></mesh><mesh position={[.32, -.005, .113]}><planeGeometry args={[.06, .03]} /><meshStandardMaterial color={device.powered ? palette.success : palette.off} emissive={palette.success} emissiveIntensity={device.powered ? .35 : 0} /></mesh>
    {device.powered ? [0, 1, 2].map((line) => <mesh key={line} position={[(line - 1) * .25, -.24, .23]} rotation={[-.5, 0, 0]}><boxGeometry args={[.015, .23, .015]} /><meshStandardMaterial color={palette.primary} transparent opacity={.2} /></mesh>) : null}</group>;
}
export function TvModel({ device, palette }: DeviceModelProps) {
  return <group><mesh castShadow><boxGeometry args={[1.25, .74, .075]} /><meshStandardMaterial color={palette.dark} roughness={.55} /></mesh><mesh position={[0, 0, .04]}><planeGeometry args={[1.18, .67]} /><meshStandardMaterial color={device.powered ? palette.glass : palette.dark} emissive={palette.primary} emissiveIntensity={device.powered ? .35 : 0} roughness={.25} /></mesh></group>;
}
export function CameraModel({ device, palette }: DeviceModelProps) {
  const geometry = useTwinResource('device-camera-wall', createCameraGeometry);
  return <group><mesh scale={1.5} castShadow><primitive attach="geometry" object={geometry} /><meshStandardMaterial vertexColors color={device.online ? palette.surface : palette.off} /></mesh>{device.state.showFov === true && device.online ? <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -.2, .55]}><coneGeometry args={[.45, 1.1, 16, 1, true]} /><meshBasicMaterial color={palette.primary} transparent opacity={.05} depthWrite={false} side={DoubleSide} /></mesh> : null}</group>;
}
export function DoorModel(props: DeviceModelProps) { return <ArchitecturalOpeningModel {...props} kind="door" />; }
export function WindowModel(props: DeviceModelProps) { return <ArchitecturalOpeningModel {...props} kind="window" />; }
export function CurtainModel(props: DeviceModelProps) { return <ArchitecturalOpeningModel {...props} kind="blind" />; }
export function GenericDeviceModel({ device, palette }: DeviceModelProps) { return <mesh castShadow><boxGeometry args={[.22, .16, .22]} /><meshStandardMaterial color={device.online ? palette.fabric : palette.off} roughness={.8} /></mesh>; }
