import { useEffect, useRef } from 'react';
import { Html, RoundedBox } from '@react-three/drei';
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
import type { DeviceAppearance } from './deviceAppearance';
import { AirflowEffect } from './AirflowEffect';

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

export interface DeviceModelProps { device: TwinDeviceView; palette: Twin3DPalette; opening?: OpeningInfo; appearance?: DeviceAppearance }
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
  const flap = useRef<Group>(null), reduced = useReducedMotion(), invalidate = useThree((state) => state.invalidate);
  const active = device.powered;
  const fan = String(device.state.fan ?? device.state.fanSpeed ?? device.state.speed ?? 'AUTO').toUpperCase();
  const speed = fan === 'HIGH' ? 1.5 : fan === 'LOW' ? .6 : 1;
  const mode = String(device.state.mode ?? 'COOL').toUpperCase();
  const color = mode === 'HEAT' ? palette.lightOn : mode === 'DRY' ? palette.mint : palette.primary;
  const temperature = Number(device.state.temperature ?? device.state.targetTemperature);
  const swing = device.state.swing === true || device.state.swing === 'ON';
  useEffect(() => { invalidate(); }, [active, swing, invalidate]);
  useFrame(({ clock }, delta) => {
    if (!flap.current) return;
    const target = active ? -.4 + (swing && !reduced ? Math.sin(clock.elapsedTime * .8) * .15 : 0) : 0;
    const moving = Math.abs(flap.current.rotation.x - target) > .001;
    flap.current.rotation.x += (target - flap.current.rotation.x) * (reduced ? 1 : 1 - Math.exp(-Math.min(delta, .05) * 10));
    if (moving || active && swing && !reduced) invalidate();
  });
  return <group>
    <RoundedBox args={[1.2, .38, .28]} radius={.065} smoothness={3} castShadow><meshStandardMaterial color={device.online ? palette.surface : palette.off} roughness={.5} /></RoundedBox>
    <mesh position={[0, -.115, .145]}><boxGeometry args={[1.04, .065, .02]} /><meshStandardMaterial color={palette.dark} /></mesh>
    <group ref={flap} position={[0, -.12, .16]}><mesh><boxGeometry args={[1.07, .035, .09]} /><meshStandardMaterial color={palette.metal} /></mesh></group>
    <mesh position={[.43, .015, .145]}><planeGeometry args={[.025, .02]} /><meshStandardMaterial color={active ? palette.success : palette.off} emissive={palette.success} emissiveIntensity={active ? .5 : 0} /></mesh>
    {active && Number.isFinite(temperature) ? <Html position={[.23, .015, .15]} transform distanceFactor={4} zIndexRange={[20, 0]}><span className="pointer-events-none text-[8px] font-semibold text-muted">{temperature}°</span></Html> : null}
    <AirflowEffect active={active} color={color} speed={speed} />
  </group>;
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
