import type { GeometrySource, TwinLayout, TwinLayoutGeometry } from '../types/twinLayout';
import type { TwinHomeSnapshotResponse } from '../types/twin';

/** Deterministic view geometry for existing room IDs; never creates a domain Room. */
export function inferTwinGeometry(roomIds: readonly string[], nodeRooms: readonly { nodeType: 'DEVICE' | 'SENSOR'; nodeId: string; roomId: string | null }[]): TwinLayoutGeometry {
  const cols = Math.max(1, Math.ceil(Math.sqrt(roomIds.length))), rows = Math.max(1, Math.ceil(roomIds.length / cols));
  const width = Math.floor((.94 - (cols - 1) * .02) / cols * 1000) / 1000, height = Math.floor((.94 - (rows - 1) * .02) / rows * 1000) / 1000;
  const round = (v: number) => Math.round(v * 1000) / 1000;
  const rooms = roomIds.map((roomId, i) => ({ roomId, floor: 1, x: round(.03 + i % cols * (width + .02)), y: round(.03 + Math.floor(i / cols) * (height + .02)), width, height }));
  const counts = new Map<string, number>();
  const nodes = nodeRooms.flatMap((node) => {
    const room = rooms.find((r) => r.roomId === node.roomId); if (!room) return [];
    const i = counts.get(room.roomId) ?? 0; counts.set(room.roomId, i + 1);
    return [{ ...node, x: round(room.x + room.width * (.2 + i % 4 * .2)), y: round(room.y + room.height * (.2 + Math.floor(i / 4) % 4 * .2)) }];
  });
  return { rooms, nodes };
}
export function twinGeometrySource(layout: TwinLayout | null, roomCount: number): GeometrySource {
  if (!roomCount) return 'DEFAULT';
  if (layout?.revision && layout.rooms.length && layout.architecture && layout.rooms.every((r) => !!layout.architecture?.rooms[r.roomId] && layout.architecture.rooms[r.roomId].autoFurniture === false)) return 'PERSISTED';
  return 'INFERRED';
}
// Snapshot type stays on the HESTA side of the adapter boundary.
export type TwinRoomIdentity = TwinHomeSnapshotResponse['rooms'][number]['roomId'];
