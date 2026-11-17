import { memo, useMemo } from 'react';
import type { Room, Vec2 } from '../neonplan/model';
import { pointInPolygon } from '../neonplan/model';
import { twinRoomCategory } from '../../../services/twinArchitectureAdapter';
import { Block } from './FurniturePrimitives';
import { gardenFinish } from './materials';

/** Supplemental landscaping stays inside the existing outdoor room footprint. */
export const GardenFinish = memo(function GardenFinish({ rooms }: { rooms: readonly Room[] }) {
  const pieces = useMemo(() => rooms.filter(room => twinRoomCategory(room.name) === 'garden').flatMap(room => {
    const xs = room.points.map(point => point[0]), zs = room.points.map(point => point[1]);
    const minX = Math.min(...xs), minZ = Math.min(...zs), w = Math.max(...xs) - minX, d = Math.max(...zs) - minZ;
    const items = [{ x: minX + w * .19, z: minZ + d / 2, w: w * .26, d: d - .35, grass: true },
      { x: minX + w * .88, z: minZ + d / 2, w: w * .13, d: d - .35, grass: true }];
    for (let index = 0; index < Math.floor(d / .8); index++) items.push({ x: minX + w * .68, z: minZ + .5 + index * .8, w: Math.min(.75, w * .22), d: .5, grass: false });
    return items.filter(item => ([-1, 1] as const).every(dx => ([-1, 1] as const).every(dz => pointInPolygon([item.x + dx * item.w / 2, item.z + dz * item.d / 2] as Vec2, room.points)))).map((item, index) => ({ ...item, id: `${room.id}:${index}` }));
  }), [rooms]);
  return <group raycast={() => undefined}>{pieces.map(item => <Block key={item.id} position={[item.x, item.grass ? .018 : .045, item.z]} size={[item.w, item.grass ? .028 : .07, item.d]} color={item.grass ? gardenFinish.grass : gardenFinish.stone} surface="matte" rounded={!item.grass} />)}</group>;
});
