import { Box3, Mesh, Spherical, Vector3, type Object3D } from 'three';
import type { Twin3DShapedRoomGeometry } from '../twin3dGeometry';

export const CAMERA_FILL = .84;
export const EXPLODE_GAP = 2.6;
export const DEVICE_FOCUS_MIN_DISTANCE = 6;

/** Keep the current side where possible; wall appliances must be seen from their front hemisphere. */
export function nodeFocusAngles(root: Object3D, theta: number, phi: number) {
  root.updateWorldMatrix(true, true);
  let visual: Object3D | undefined;
  root.traverse((object) => { if (object.name.startsWith('model:')) visual = object; });
  let nextTheta = theta;
  if (visual?.userData.modelMount === 'wall') {
    const front = new Vector3(0, 0, 1).transformDirection(visual.matrixWorld);
    const frontTheta = Math.atan2(front.x, front.z);
    const difference = Math.atan2(Math.sin(theta - frontTheta), Math.cos(theta - frontTheta));
    if (Math.abs(difference) > .5) {
      const desired = frontTheta + Math.sign(difference) * .5;
      nextTheta = theta + Math.atan2(Math.sin(desired - theta), Math.cos(desired - theta));
    }
  }
  return { theta: nextTheta, phi: Math.max(.9, Math.min(1.2, phi)) };
}

/** Fit the physical appliance, excluding mist, labels and invisible click targets. */
export function nodeFocusBounds(root: Object3D) {
  root.updateWorldMatrix(true, true);
  let visual: Object3D | undefined;
  root.traverse((object) => { if (object.name.startsWith('model:')) visual = object; });
  const box = new Box3();
  const visit = (object: Object3D) => {
    if (!object.visible || object.name === 'device-airflow') return;
    if (object instanceof Mesh) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (materials.some((material) => material.visible && material.opacity > 0)) {
        object.geometry.computeBoundingBox();
        if (object.geometry.boundingBox) box.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
      }
    }
    object.children.forEach(visit);
  };
  visit(visual ?? root);
  return box.isEmpty() ? new Box3().setFromCenterAndSize(root.getWorldPosition(new Vector3()), new Vector3(.6, .6, .6)) : box;
}
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
