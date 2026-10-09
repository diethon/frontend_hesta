import { Box3, Spherical, Vector3 } from 'three';
import type { Twin3DShapedRoomGeometry } from '../twin3dGeometry';

export const CAMERA_FILL = .95;
export const EXPLODE_GAP = 2.6;
/** Architectural points only: scenery and labels never affect camera fit. */
export function roomBounds(rooms: readonly Twin3DShapedRoomGeometry[]) {
  const box = new Box3();
  rooms.forEach((room) => room.outline.forEach((p) => {
    box.expandByPoint(new Vector3(room.x + p.x - room.wallThickness, room.y - .2, room.z + p.z - room.wallThickness));
    box.expandByPoint(new Vector3(room.x + p.x + room.wallThickness, room.y + room.wallHeight, room.z + p.z + room.wallThickness));
  }));
  return box;
}
/** Fit the eight bounds corners; calibrated for visible geometry to fill 70–85% of the limiting axis. */
export function fitDistance(box: Box3, target: Vector3, theta: number, phi: number, fov: number, aspect: number) {
  const direction = new Vector3().setFromSpherical(new Spherical(1, phi, theta));
  const right = new Vector3().crossVectors(new Vector3(0, 1, 0), direction).normalize();
  const up = new Vector3().crossVectors(direction, right).normalize();
  const tanY = Math.tan(fov * Math.PI / 360), tanX = tanY * aspect;
  let distance = 0;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const point = new Vector3(x, y, z).sub(target), depth = point.dot(direction);
    distance = Math.max(distance, depth + Math.abs(point.dot(right)) / (tanX * CAMERA_FILL), depth + Math.abs(point.dot(up)) / (tanY * CAMERA_FILL));
  }
  return Math.max(3, distance);
}
