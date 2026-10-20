import { DoubleSide } from 'three';
import type { DeviceModelProps } from './models';
import { boundedPercent, lightColor } from './deviceVisualState';

/** The diffuser and physical light share one confirmed HESTA colour/brightness. */
export function LampEmitter({ device, palette, radius = .19, intensity = 16, upward = false }: DeviceModelProps & {
  radius?: number; intensity?: number; upward?: boolean;
}) {
  const brightness = boundedPercent(device.state.brightness ?? device.state.level, 100) / 100;
  const color = lightColor(device, palette.lightOn);
  const active = device.powered && brightness > 0;
  return <group>
    <mesh name="light-diffuser" rotation={[upward ? Math.PI / 2 : -Math.PI / 2, 0, 0]} raycast={() => undefined}>
      <circleGeometry args={[radius, 32]} />
      <meshStandardMaterial color={active ? color : palette.off} emissive={color} emissiveIntensity={active ? brightness * .75 : 0} side={DoubleSide} roughness={.5} toneMapped={false} />
    </mesh>
    {active ? <pointLight name="device-illumination" position={[0, -.14, 0]} color={color} intensity={brightness * intensity} distance={6} decay={2} /> : null}
  </group>;
}
