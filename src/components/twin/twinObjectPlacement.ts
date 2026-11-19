import { pointInPolygon, snapMeters, type TwinRoomDrafting, type TwinSceneObject, type TwinSceneObjectKind } from './twinDrafting';

export const sceneObjectLabels: Record<TwinSceneObjectKind, string> = { WALL: 'Vách', DOOR: 'Cửa', WINDOW: 'Cửa sổ', TABLE: 'Bàn', SOFA: 'Sofa', BED: 'Giường', CABINET: 'Tủ', CHAIR: 'Ghế', DESK: 'Bàn làm việc', TV_STAND: 'Kệ TV', WARDROBE: 'Tủ áo', KITCHEN_COUNTER: 'Tủ bếp', SINK: 'Chậu rửa', TOILET: 'Bồn cầu', SHOWER: 'Vòi sen', BATHTUB: 'Bồn tắm', PLANT: 'Cây', LAMP: 'Đèn đứng', REFRIGERATOR: 'Tủ lạnh' };

/** Openings remain attached to their nearest wall, including diagonal walls. */
export function attachOpening(object: TwinSceneObject, room: TwinRoomDrafting, width: number, depth: number): TwinSceneObject {
  if (object.kind !== 'DOOR' && object.kind !== 'WINDOW') return object;
  const edges = room.points.map((point, index) => {
    const end = room.points[(index + 1) % room.points.length];
    const x = point.x * width, z = point.y * depth;
    const dx = (end.x - point.x) * width, dz = (end.y - point.y) * depth;
    const length = Math.hypot(dx, dz);
    const margin = Math.min(.49, object.width / Math.max(length, .001) / 2);
    const t = Math.max(margin, Math.min(1 - margin, ((object.x - x) * dx + (object.z - z) * dz) / Math.max(length * length, .001)));
    const projectedX = x + t * dx, projectedZ = z + t * dz;
    return { x: projectedX, z: projectedZ, length, rotation: -Math.atan2(dz, dx) * 180 / Math.PI, distance: Math.hypot(projectedX - object.x, projectedZ - object.z) };
  }).filter(edge => edge.length > .001).sort((a, b) => a.distance - b.distance);
  const edge = edges[0];
  return edge ? { ...object, x: edge.x, z: edge.z, rotation: edge.rotation, width: Math.min(object.width, edge.length) } : object;
}

/** Keep a furniture anchor inside its own room. Snap is applied only on commit. */
export function positionSceneObject(object: TwinSceneObject, x: number, z: number, room: TwinRoomDrafting, width: number, depth: number, step?: number): TwinSceneObject {
  const round = (value: number) => Math.round(value * 1000) / 1000;
  let next = { ...object, x: round(Math.max(0, Math.min(width, step ? snapMeters(x, step) : x))), z: round(Math.max(0, Math.min(depth, step ? snapMeters(z, step) : z))) };
  if (object.kind === 'DOOR' || object.kind === 'WINDOW') return attachOpening(next, room, width, depth);
  const inside = (candidateX: number, candidateZ: number) => pointInPolygon({ x: candidateX / width, y: candidateZ / depth }, room.points);
  if (inside(next.x, next.z)) return next;
  let distance = Infinity;
  const targetX = next.x, targetZ = next.z;
  // Project into the nearest interior sample for concave shapes and boundary drops.
  for (let row = 1; row < 80; row++) for (let col = 1; col < 80; col++) {
    const candidateX = width * col / 80, candidateZ = depth * row / 80;
    const d = (candidateX - targetX) ** 2 + (candidateZ - targetZ) ** 2;
    if (d < distance && inside(candidateX, candidateZ)) {
      distance = d;
      next = { ...next, x: round(candidateX), z: round(candidateZ) };
    }
  }
  return next;
}
