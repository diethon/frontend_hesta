import { useMemo, useRef } from 'react';
import { Group } from 'three';
import { AcExtras, AirConditionerModel, FanModel, TvModel, type DeviceModelProps } from './models';
import { StandingFanModel } from './ApplianceModels';
import { WithTwinModel } from './TwinGltfModel';
import { useTwinModel } from './twinGltf';
import { useAcFlap, useFanSpin, useRollerShutter } from './deviceMotion';

// Each device prefers its public/twin-models/*.glb (docs/TWIN_MODELS.md) and keeps the
// procedural model while loading or when the file is missing.

function GltfCeilingFan({ device, palette }: DeviceModelProps) {
  const root = useTwinModel('ceiling-fan', { body: device.online ? palette.surface : palette.off, blade: device.online ? palette.wood : palette.off, metal: palette.metal });
  const blades = useMemo(() => root.getObjectByName('blades'), [root]);
  useFanSpin(() => blades, device, 'y', (speed) => 1 + speed / 12);
  return <primitive object={root} />;
}
export function CeilingFanDevice(props: DeviceModelProps) {
  return <WithTwinModel fallback={<FanModel {...props} />}><GltfCeilingFan {...props} /></WithTwinModel>;
}

function GltfStandingFan({ device, palette }: DeviceModelProps) {
  const root = useTwinModel('standing-fan', { body: device.online ? palette.surface : palette.off, blade: device.online ? palette.fabricAccent : palette.off, metal: palette.metal });
  const blades = useMemo(() => root.getObjectByName('blades'), [root]);
  useFanSpin(() => blades, device, 'z', (speed) => 2 + speed / 8);
  return <primitive object={root} />;
}
export function StandingFanDevice(props: DeviceModelProps) {
  return <WithTwinModel fallback={<StandingFanModel {...props} />}><GltfStandingFan {...props} /></WithTwinModel>;
}

function GltfAirConditioner(props: DeviceModelProps) {
  const { device, palette } = props;
  const root = useTwinModel('ac', { body: device.online ? palette.surface : palette.off, dark: palette.dark });
  const flap = useMemo(() => root.getObjectByName('flap'), [root]);
  useAcFlap(() => flap, device);
  return <group><primitive object={root} /><AcExtras {...props} front={.172} /></group>;
}
export function AirConditionerDevice(props: DeviceModelProps) {
  return <WithTwinModel fallback={<AirConditionerModel {...props} />}><GltfAirConditioner {...props} /></WithTwinModel>;
}

function GltfTv({ device, palette }: DeviceModelProps) {
  const root = useTwinModel('tv', { dark: palette.dark });
  return <group><primitive object={root} />
    <mesh position={[0, 0, .022]}><planeGeometry args={[1.2, .69]} /><meshStandardMaterial color={device.powered ? palette.glass : palette.dark} emissive={palette.primary} emissiveIntensity={device.powered ? .35 : 0} roughness={.2} /></mesh></group>;
}
export function TvDevice(props: DeviceModelProps) {
  return <WithTwinModel fallback={<TvModel {...props} />}><GltfTv {...props} /></WithTwinModel>;
}

/** Fits the unit-sized roller door (1 × 1 m) to the bound wall opening, or a garage default. */
function rollerFit(opening: DeviceModelProps['opening']) {
  if (!opening) return { scale: [2.4, 2.1, 1] as const, y: 0, rotation: 0 };
  return { scale: [opening.width, opening.opening.height, 1] as const, y: opening.sill, rotation: -Math.atan2(opening.axis[1], opening.axis[0]) };
}
function GltfRollerDoor({ device, palette, opening }: DeviceModelProps) {
  const root = useTwinModel('roller-door', { body: device.online ? palette.surface : palette.off, metal: palette.metal });
  const shutter = useMemo(() => root.getObjectByName('shutter'), [root]);
  useRollerShutter(() => shutter, device);
  const fit = rollerFit(opening);
  return <group position={[0, fit.y, 0]} rotation={[0, fit.rotation, 0]} scale={fit.scale}><primitive object={root} /></group>;
}
function ProceduralRollerDoor({ device, palette, opening }: DeviceModelProps) {
  const shutter = useRef<Group>(null);
  useRollerShutter(() => shutter.current, device);
  const fit = rollerFit(opening);
  return <group position={[0, fit.y, 0]} rotation={[0, fit.rotation, 0]} scale={fit.scale}>
    <group ref={shutter}>{Array.from({ length: 20 }, (_, index) => <mesh key={index} position={[0, index * .05 + .025, 0]} castShadow><boxGeometry args={[.98, .046, .016]} /><meshStandardMaterial color={palette.metal} metalness={.5} roughness={.4} /></mesh>)}</group>
    <mesh position={[0, 1.06, -.03]} castShadow><boxGeometry args={[1.04, .12, .2]} /><meshStandardMaterial color={device.online ? palette.surface : palette.off} /></mesh>
  </group>;
}
export function RollerDoorDevice(props: DeviceModelProps) {
  return <WithTwinModel fallback={<ProceduralRollerDoor {...props} />}><GltfRollerDoor {...props} /></WithTwinModel>;
}
