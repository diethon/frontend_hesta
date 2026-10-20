import { memo, useEffect, useMemo } from 'react';
import { ExtrudeGeometry, Path, Shape } from 'three';
import { pointInPolygon, type Room, type Vec2 } from '../neonplan/model';

/** Follow the real footprint, including concave rooms and stair holes, instead of filling its bounding box. */
export const ApartmentFoundation = memo(function ApartmentFoundation({ rooms, holes, color }: { rooms: readonly Room[]; holes: readonly Vec2[][]; color: string }) {
  const geometry = useMemo(() => {
    const shapes = rooms.filter((room) => room.points.length >= 3).map((room) => {
      const shape = new Shape();
      room.points.forEach(([x, z], index) => { if (!index) shape.moveTo(x, -z); else shape.lineTo(x, -z); });
      shape.closePath();
      holes.filter((hole) => hole.length >= 3 && pointInPolygon(hole[0], room.points)).forEach((hole) => {
        const path = new Path();
        hole.forEach(([x, z], index) => { if (!index) path.moveTo(x, -z); else path.lineTo(x, -z); });
        path.closePath(); shape.holes.push(path);
      });
      return shape;
    });
    return new ExtrudeGeometry(shapes, { depth: .22, bevelEnabled: true, bevelThickness: .025, bevelSize: .035, bevelSegments: 2, steps: 1, curveSegments: 1 });
  }, [rooms, holes]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh name="apartment-foundation" geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, -.28, 0]} castShadow receiveShadow><meshStandardMaterial color={color} roughness={.82} /></mesh>;
});
