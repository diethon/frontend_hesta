import type { Twin3DNodeGeometry, Twin3DShapedRoomGeometry } from '../twin3dGeometry';
/** Architectural mounting is renderer-only; persisted normalized device coordinates are never mutated. */
export function devicePlacement(node: Twin3DNodeGeometry, room: Twin3DShapedRoomGeometry | undefined, type: string, rotation: number) {
  const height = room?.wallHeight ?? 2.25;
  const y = ['LIGHT', 'LED_RGB', 'FAN'].includes(type) ? height - .05 : ['AC', 'AIR_CONDITIONER', 'CAMERA', 'CAMERA_AI'].includes(type) ? height - .45 : type === 'TV' ? 1.25 : ['DOOR', 'WINDOW', 'CURTAIN', 'BLIND'].includes(type) ? 0 : .12;
  if (!room || !['AC', 'AIR_CONDITIONER', 'TV', 'CAMERA', 'CAMERA_AI', 'DOOR', 'WINDOW', 'CURTAIN', 'BLIND'].includes(type)) return { x: node.x, y, z: node.z, rotation: rotation * Math.PI / 180 };
  let best = { x: node.x, y, z: node.z, rotation: rotation * Math.PI / 180, distance: Infinity };
  room.outline.forEach((p, index) => {
    const q = room.outline[(index + 1) % room.outline.length], dx = q.x - p.x, dz = q.z - p.z, length = Math.hypot(dx, dz);
    if (length < .01) return;
    const t = Math.max(.1, Math.min(.9, ((node.x - room.x - p.x) * dx + (node.z - room.z - p.z) * dz) / (length * length)));
    const x = room.x + p.x + dx * t - dz / length * .14, z = room.z + p.z + dz * t + dx / length * .14;
    const distance = Math.hypot(x - node.x, z - node.z);
    if (distance < best.distance) best = { x, y, z, rotation: rotation ? rotation * Math.PI / 180 : Math.atan2(-dz, dx), distance };
  });
  return best;
}
