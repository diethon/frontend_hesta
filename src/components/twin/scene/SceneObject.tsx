import type { TwinSceneObject } from '../twinDrafting';
import type { Twin3DRoomGeometry } from '../twin3dGeometry';
import { TWIN_FLOOR_HEIGHT } from '../twin3dGeometry';
import type { Twin3DPalette } from '../twin3dPalette';

interface ObjectProps { object: TwinSceneObject; palette: Twin3DPalette }
export function Door({ object, palette }: ObjectProps) {
  return <group><mesh position={[0, object.height / 2, 0]}><boxGeometry args={[object.width, object.height, object.depth]} /><meshStandardMaterial color={palette.fabric} /></mesh><mesh position={[object.width * .35, object.height / 2, object.depth / 2 + .03]}><sphereGeometry args={[.04, 10, 8]} /><meshStandardMaterial color={palette.metal} /></mesh></group>;
}
export function Window({ object, palette }: ObjectProps) {
  const sill = .8;
  return <group position={[0, sill, 0]}><mesh position={[0, object.height / 2, 0]}><boxGeometry args={[object.width, object.height, object.depth]} /><meshStandardMaterial color={palette.glass} transparent opacity={.45} /></mesh>{[-1, 1].map((side) => <mesh key={side} position={[side * object.width / 2, object.height / 2, 0]}><boxGeometry args={[.06, object.height, object.depth + .04]} /><meshStandardMaterial color={palette.surface} /></mesh>)}<mesh position={[0, object.height, 0]}><boxGeometry args={[object.width, .06, object.depth + .04]} /><meshStandardMaterial color={palette.surface} /></mesh></group>;
}
export function Furniture({ object, palette }: ObjectProps) {
  return <group><mesh castShadow receiveShadow position={[0, object.height / 2, 0]}><boxGeometry args={[object.width, object.height, object.depth]} /><meshStandardMaterial color={palette.fabric} roughness={.85} /></mesh>{object.kind === 'SOFA' || object.kind === 'BED' ? <mesh castShadow position={[0, object.height * .9, -object.depth * .4]}><boxGeometry args={[object.width, object.height * .6, object.depth * .15]} /><meshStandardMaterial color={palette.fabricAccent} /></mesh> : null}</group>;
}
const renderers: Partial<Record<TwinSceneObject['kind'], typeof Furniture>> = { DOOR: Door, WINDOW: Window };
export function SceneObject({ object, room, palette }: ObjectProps & { room: Twin3DRoomGeometry }) {
  const Model = renderers[object.kind] ?? Furniture;
  return <group position={[object.x - room.width / 2, TWIN_FLOOR_HEIGHT, object.z - room.depth / 2]} rotation={[0, object.rotation * Math.PI / 180, 0]}><Model object={object} palette={palette} /></group>;
}
