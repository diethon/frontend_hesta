import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { DoubleSide, Group } from 'three';
import type { DeviceModelProps } from './models';
import { boundedPercent, lightColor } from './deviceVisualState';
import { useReducedMotion } from '../useTwinMotion';

function LampGlow({ device, palette }: DeviceModelProps) {
  const brightness = boundedPercent(device.state.brightness ?? device.state.level, 100) / 100;
  const color = lightColor(device, palette.lightOn);
  return <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => undefined}><circleGeometry args={[.19, 24]} /><meshStandardMaterial color={palette.surface} emissive={color} emissiveIntensity={device.powered ? brightness * 2 : 0} side={DoubleSide} toneMapped={false} /></mesh>
    {device.powered && brightness > 0 ? <pointLight position={[0, -.08, 0]} color={color} intensity={brightness * 12} distance={6} decay={2} /> : null}
  </group>;
}
export function CeilingLightModel(props: DeviceModelProps) {
  return <group><mesh position={[0, -.045, 0]} castShadow><cylinderGeometry args={[.26, .25, .09, 32]} /><meshStandardMaterial color={props.palette.surface} roughness={.5} /></mesh><group position={[0, -.095, 0]}><LampGlow {...props} /></group></group>;
}
export function StandingLampModel({ appearance, ...props }: DeviceModelProps) {
  const { palette } = props;
  const height = appearance?.kind === 'table-lamp' ? .48 : 1.6;
  return <group>
    <mesh position={[0, .035, 0]} castShadow><cylinderGeometry args={[.2, .23, .07, 24]} /><meshStandardMaterial color={palette.metal} metalness={.5} roughness={.35} /></mesh>
    <mesh position={[0, height / 2, 0]} castShadow><cylinderGeometry args={[.02, .02, height, 12]} /><meshStandardMaterial color={palette.wood} /></mesh>
    <mesh position={[0, height, 0]} castShadow><cylinderGeometry args={[.15, .26, .3, 32, 1, true]} /><meshStandardMaterial color={palette.surface} side={DoubleSide} roughness={.75} /></mesh>
    <group position={[0, height - .14, 0]}><LampGlow {...props} /></group>
  </group>;
}
export function WallLightModel(props: DeviceModelProps) {
  const { palette } = props;
  return <group><mesh castShadow><boxGeometry args={[.18, .3, .08]} /><meshStandardMaterial color={palette.metal} /></mesh><mesh position={[0, .02, .16]} castShadow><cylinderGeometry args={[.12, .19, .26, 24, 1, true]} /><meshStandardMaterial color={palette.surface} side={DoubleSide} /></mesh><group position={[0, -.12, .16]}><LampGlow {...props} /></group></group>;
}
export function LedStripModel({ device, palette }: DeviceModelProps) {
  const brightness = boundedPercent(device.state.brightness ?? device.state.level, 100) / 100;
  const color = lightColor(device, palette.lightOn);
  return <group><mesh castShadow><boxGeometry args={[1.15, .055, .035]} /><meshStandardMaterial color={palette.metal} /></mesh><mesh position={[0, 0, .022]}><boxGeometry args={[1.1, .035, .015]} /><meshStandardMaterial color={device.powered ? color : palette.off} emissive={color} emissiveIntensity={device.powered ? brightness * 2 : 0} toneMapped={false} /></mesh>{device.powered && brightness > 0 ? <pointLight position={[0, 0, .2]} color={color} intensity={brightness * 9} distance={5} decay={2} /> : null}</group>;
}
export function StandingFanModel({ device, palette }: DeviceModelProps) {
  const blades = useRef<Group>(null), reduced = useReducedMotion(), invalidate = useThree((state) => state.invalidate);
  const speed = typeof device.state.speed === 'string' ? ({ LOW: 25, MEDIUM: 55, HIGH: 100 }[device.state.speed.toUpperCase()] ?? 50) : boundedPercent(device.state.speed, 50);
  useFrame((_, delta) => { if (device.powered && !reduced && blades.current && speed > 0) { blades.current.rotation.z += Math.min(delta, .05) * (2 + speed / 8); invalidate(); } });
  return <group>
    <mesh position={[0, .035, 0]} castShadow><cylinderGeometry args={[.25, .28, .07, 24]} /><meshStandardMaterial color={palette.surface} /></mesh>
    <mesh position={[0, .57, 0]} castShadow><cylinderGeometry args={[.025, .035, 1.1, 12]} /><meshStandardMaterial color={palette.metal} /></mesh>
    <group position={[0, 1.25, 0]}>
      <mesh castShadow><torusGeometry args={[.35, .025, 8, 32]} /><meshStandardMaterial color={palette.metal} /></mesh>
      <group ref={blades}>{[0, 1, 2].map((index) => <group key={index} rotation={[0, 0, index * Math.PI * 2 / 3]}><mesh position={[.15, 0, .01]}><boxGeometry args={[.28, .11, .025]} /><meshStandardMaterial color={device.online ? palette.fabricAccent : palette.off} /></mesh></group>)}</group>
      {[0, 1, 2, 3, 4, 5].map((index) => <mesh key={index} rotation={[0, 0, index * Math.PI / 6]} position={[0, 0, .05]}><boxGeometry args={[.68, .012, .012]} /><meshStandardMaterial color={palette.metal} /></mesh>)}
      <mesh position={[0, 0, .07]}><sphereGeometry args={[.065, 12, 8]} /><meshStandardMaterial color={palette.surface} /></mesh>
    </group>
  </group>;
}
export function PlugModel({ device, palette }: DeviceModelProps) {
  return <group><RoundedBox args={[.2, .28, .1]} radius={.035} smoothness={2} castShadow><meshStandardMaterial color={device.online ? palette.surface : palette.off} /></RoundedBox>{[-.04, .04].map((x) => <mesh key={x} position={[x, .035, .055]}><circleGeometry args={[.015, 12]} /><meshStandardMaterial color={palette.dark} /></mesh>)}<mesh position={[0, -.075, .055]}><circleGeometry args={[.012, 12]} /><meshStandardMaterial color={device.powered ? palette.success : palette.off} emissive={palette.success} emissiveIntensity={device.powered ? .5 : 0} /></mesh></group>;
}
export function RemoteModel({ device, palette }: DeviceModelProps) {
  return <group><RoundedBox args={[.17, .08, .24]} radius={.035} smoothness={2} castShadow><meshStandardMaterial color={device.online ? palette.dark : palette.off} /></RoundedBox><mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .042, -.04]}><circleGeometry args={[.025, 16]} /><meshStandardMaterial color={palette.surface} /></mesh></group>;
}
export function SensorModel({ device, palette, appearance }: DeviceModelProps) {
  const color = device.online ? palette.surface : palette.off;
  if (appearance?.kind === 'smoke-sensor') return <group><mesh><cylinderGeometry args={[.12, .14, .07, 24]} /><meshStandardMaterial color={color} /></mesh>{[-.07, 0, .07].map((x) => <mesh key={x} position={[x, -.04, 0]}><boxGeometry args={[.016, .008, .08]} /><meshStandardMaterial color={palette.metal} /></mesh>)}</group>;
  return <group><RoundedBox args={[.18, .23, .08]} radius={.035} smoothness={2} castShadow><meshStandardMaterial color={color} /></RoundedBox>{appearance?.kind === 'motion-sensor' ? <mesh position={[0, .02, .05]}><sphereGeometry args={[.06, 12, 8]} /><meshStandardMaterial color={palette.glass} roughness={.3} /></mesh> : <mesh position={[0, .025, .045]}><planeGeometry args={[.13, .1]} /><meshStandardMaterial color={palette.glass} /></mesh>}<mesh position={[0, -.075, .046]}><circleGeometry args={[.01, 12]} /><meshStandardMaterial color={device.online ? palette.success : palette.off} /></mesh></group>;
}
