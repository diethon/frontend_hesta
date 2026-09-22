import type { TwinLayoutGeometry, TwinLayoutSaveRequest, TwinNodeLayout, TwinRoomLayout } from '../../types/twinLayout';
import { pointInPolygon, type TwinDraftPoint } from './twinDrafting';

export const nodeKey = (node: Pick<TwinNodeLayout, 'nodeType' | 'nodeId'>) => `${node.nodeType}:${node.nodeId}`;
const round = (value: number) => Math.round(value * 1000) / 1000;
export const clampCoordinate = (value: number, max = 1) => round(Math.max(0, Math.min(max, Number.isFinite(value) ? value : 0)));
export const TWIN_GRID_STEP = 0.025;
export const TWIN_EDGE_SNAP_DISTANCE = 0.012;

export interface TwinSnapOptions {
  grid: boolean;
  edges: boolean;
}

export interface TwinSnapGuides {
  x: number[];
  y: number[];
}

export function clampRoom(room: TwinRoomLayout): TwinRoomLayout {
  const width = Math.max(0.001, clampCoordinate(room.width));
  const height = Math.max(0.001, clampCoordinate(room.height));
  return { roomId: room.roomId, width, height, x: clampCoordinate(room.x, 1 - width), y: clampCoordinate(room.y, 1 - height), ...(room.floor ? { floor: room.floor } : {}) };
}

export function resizeRoom(room: TwinRoomLayout, width: number, height: number) {
  return { ...room, width: Math.max(0.001, clampCoordinate(width, 1 - room.x)), height: Math.max(0.001, clampCoordinate(height, 1 - room.y)) };
}

export function defaultRoom(roomId: string, count: number, floor?: number): TwinRoomLayout {
  return { roomId, x: round(0.04 + (count % 2) * 0.48), y: round(0.04 + (Math.floor(count / 2) % 2) * 0.46), width: 0.44, height: 0.4, ...(floor ? { floor } : {}) };
}

const snapToGrid = (value: number) => round(Math.round(value / TWIN_GRID_STEP) * TWIN_GRID_STEP);

function nearestSnap(value: number, candidates: readonly number[]) {
  let nearest = value;
  let distance = TWIN_EDGE_SNAP_DISTANCE + Number.EPSILON;
  for (const candidate of candidates) {
    const nextDistance = Math.abs(candidate - value);
    if (nextDistance < distance) {
      nearest = candidate;
      distance = nextDistance;
    }
  }
  return distance <= TWIN_EDGE_SNAP_DISTANCE ? nearest : value;
}

export function snapRoom(room: TwinRoomLayout, others: readonly TwinRoomLayout[], options: TwinSnapOptions, resize = false) {
  let next = clampRoom(room);
  const guides: TwinSnapGuides = { x: [], y: [] };
  if (options.grid) {
    if (resize) next = resizeRoom(next, snapToGrid(next.width), snapToGrid(next.height));
    else next = clampRoom({ ...next, x: snapToGrid(next.x), y: snapToGrid(next.y) });
  }
  if (!options.edges) return { room: next, guides };
  const sameFloor = others.filter((other) => (other.floor ?? 1) === (next.floor ?? 1) && other.roomId !== next.roomId);
  const xEdges = sameFloor.flatMap((other) => [other.x, other.x + other.width]);
  const yEdges = sameFloor.flatMap((other) => [other.y, other.y + other.height]);
  if (resize) {
    const right = nearestSnap(next.x + next.width, xEdges);
    const bottom = nearestSnap(next.y + next.height, yEdges);
    if (right !== next.x + next.width) guides.x.push(right);
    if (bottom !== next.y + next.height) guides.y.push(bottom);
    next = resizeRoom(next, right - next.x, bottom - next.y);
  } else {
    const left = nearestSnap(next.x, xEdges);
    const right = nearestSnap(next.x + next.width, xEdges);
    const top = nearestSnap(next.y, yEdges);
    const bottom = nearestSnap(next.y + next.height, yEdges);
    const snappedX = left !== next.x ? left : right !== next.x + next.width ? right - next.width : next.x;
    const snappedY = top !== next.y ? top : bottom !== next.y + next.height ? bottom - next.height : next.y;
    if (snappedX !== next.x) guides.x.push(left !== next.x ? left : right);
    if (snappedY !== next.y) guides.y.push(top !== next.y ? top : bottom);
    next = clampRoom({ ...next, x: snappedX, y: snappedY });
  }
  return { room: next, guides };
}

export function snapPoint(value: number, enabled: boolean) {
  return clampCoordinate(enabled ? snapToGrid(value) : value);
}

export function overlappingRoomIds(rooms: readonly TwinRoomLayout[]) {
  const overlaps = new Set<string>();
  for (let index = 0; index < rooms.length; index += 1) {
    const first = rooms[index];
    for (let next = index + 1; next < rooms.length; next += 1) {
      const second = rooms[next];
      if ((first.floor ?? 1) !== (second.floor ?? 1)) continue;
      const intersects = first.x < second.x + second.width && first.x + first.width > second.x
        && first.y < second.y + second.height && first.y + first.height > second.y;
      if (intersects) {
        overlaps.add(first.roomId);
        overlaps.add(second.roomId);
      }
    }
  }
  return overlaps;
}

export function roomContainsPoint(room: TwinRoomLayout, x: number, y: number, points?: readonly TwinDraftPoint[]) {
  if (x < room.x || y < room.y || x > room.x + room.width || y > room.y + room.height) return false;
  if (!points?.length) return true;
  return pointInPolygon({ x: (x - room.x) / room.width, y: (y - room.y) / room.height }, points);
}

// All nodes use full-canvas coordinates. Last rendered room wins an overlapping drop.
export function moveLayoutNode(node: TwinNodeLayout, x: number, y: number, rooms: TwinRoomLayout[], roomPoints?: (roomId: string) => readonly TwinDraftPoint[]): TwinNodeLayout {
  const point = { x: clampCoordinate(x), y: clampCoordinate(y) };
  const target = [...rooms].reverse().find((room) => roomContainsPoint(room, point.x, point.y, roomPoints?.(room.roomId)));
  return { ...node, ...point, roomId: target?.roomId ?? null };
}

export function geometryError(geometry: TwinLayoutGeometry): string | null {
  const coordinate = (value: number) => Number.isFinite(value) && value >= 0 && value <= 1 && round(value) === value;
  if (new Set(geometry.rooms.map((room) => room.roomId)).size !== geometry.rooms.length
    || new Set(geometry.nodes.map(nodeKey)).size !== geometry.nodes.length) return 'Sơ đồ có vị trí trùng lặp.';
  for (const room of geometry.rooms) {
    if (!Number.isInteger(room.floor ?? 1) || (room.floor ?? 1) < 1 || (room.floor ?? 1) > 100
      || ![room.x, room.y, room.width, room.height].every(coordinate) || room.width <= 0 || room.height <= 0
      || Math.round(room.x * 1000) + Math.round(room.width * 1000) > 1000
      || Math.round(room.y * 1000) + Math.round(room.height * 1000) > 1000) return 'Phòng phải thuộc tầng 1–100, nằm trong sơ đồ và có kích thước lớn hơn 0.';
  }
  if (geometry.nodes.some((node) => !coordinate(node.x) || !coordinate(node.y))) return 'Vị trí phải nằm trong sơ đồ (0–100%).';
  return null;
}

// Explicit whitelist: runtime state and viewport pixels can never enter the PUT body.
export function layoutRequest(geometry: TwinLayoutGeometry, expectedRevision: number): TwinLayoutSaveRequest {
  return {
    expectedRevision,
    rooms: geometry.rooms.map(({ roomId, floor, x, y, width, height }) => ({ roomId, floor: floor ?? 1, x, y, width, height })),
    nodes: geometry.nodes.map(({ nodeType, nodeId, roomId, x, y }) => ({ nodeType, nodeId, roomId, x, y })),
  };
}

export function sameGeometry(a: TwinLayoutGeometry, b: TwinLayoutGeometry) {
  const canonical = (value: TwinLayoutGeometry) => layoutRequest({
    rooms: [...value.rooms].sort((x, y) => x.roomId.localeCompare(y.roomId)),
    nodes: [...value.nodes].sort((x, y) => nodeKey(x).localeCompare(nodeKey(y))),
  }, 0);
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
