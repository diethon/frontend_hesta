import type { TwinLayoutGeometry, TwinNodeLayout, TwinRoomLayout } from '../../types/twinLayout';

export const TWIN_WORLD_WIDTH = 18;
export const TWIN_WORLD_DEPTH = 12;
export const TWIN_ROOM_WALL_HEIGHT = 2.25;
export const TWIN_FLOOR_HEIGHT = 0.16;
export const TWIN_WALL_THICKNESS = 0.12;
export const TWIN_MARKER_ELEVATION = 1.62;
export const TWIN_STOREY_HEIGHT = 2.5;
export const TWIN_EXPLODED_STOREY_HEIGHT = 3.75;

export interface Twin3DPoint {
  x: number;
  y: number;
  z: number;
}

export interface Twin3DRoomGeometry extends Twin3DPoint {
  roomId: string;
  width: number;
  depth: number;
}

export interface Twin3DNodeGeometry extends Twin3DPoint {
  nodeType: TwinNodeLayout['nodeType'];
  nodeId: string;
  roomId: string | null;
}

export interface Twin3DBounds {
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
}

// Backend x/y remain normalized full-canvas coordinates. The subtraction only
// centers the presentation around the Three.js origin: x -> world X, y -> world Z.
// Three.js Y is reserved exclusively for presentation elevation.
export function normalizedToWorld(x: number, y: number, elevation = 0): Twin3DPoint {
  return {
    x: x * TWIN_WORLD_WIDTH - TWIN_WORLD_WIDTH / 2,
    y: elevation,
    z: y * TWIN_WORLD_DEPTH - TWIN_WORLD_DEPTH / 2,
  };
}

export function roomFloorLevel(room: TwinRoomLayout) {
  return Number.isFinite(room.floor) ? Math.max(1, Math.round(room.floor ?? 1)) : 1;
}

export function layoutFloors(rooms: readonly TwinRoomLayout[]) {
  return [...new Set(rooms.map(roomFloorLevel))].sort((a, b) => a - b);
}

export function floorElevation(floor: number, exploded: boolean) {
  return (Math.max(1, floor) - 1) * (exploded ? TWIN_EXPLODED_STOREY_HEIGHT : TWIN_STOREY_HEIGHT);
}

export function geometryForFloor(geometry: TwinLayoutGeometry, floor: number | 'all'): TwinLayoutGeometry {
  if (floor === 'all') return geometry;
  const rooms = geometry.rooms.filter((room) => roomFloorLevel(room) === floor);
  const roomIds = new Set(rooms.map((room) => room.roomId));
  return { rooms, nodes: geometry.nodes.filter((node) => node.roomId === null ? floor === 1 : roomIds.has(node.roomId)) };
}

export function roomToWorld(room: TwinRoomLayout, elevation = 0): Twin3DRoomGeometry {
  const center = normalizedToWorld(room.x + room.width / 2, room.y + room.height / 2, elevation);
  return {
    roomId: room.roomId,
    ...center,
    width: room.width * TWIN_WORLD_WIDTH,
    depth: room.height * TWIN_WORLD_DEPTH,
  };
}

export function nodeToWorld(node: TwinNodeLayout, baseElevation = 0): Twin3DNodeGeometry {
  return {
    nodeType: node.nodeType,
    nodeId: node.nodeId,
    roomId: node.roomId,
    ...normalizedToWorld(node.x, node.y, baseElevation + TWIN_MARKER_ELEVATION),
  };
}

export function resolvePlacedNodes(geometry: TwinLayoutGeometry, deviceIds: readonly string[], sensorIds: readonly string[], roomElevations: ReadonlyMap<string, number> = new Map()) {
  const devices = new Set(deviceIds);
  const sensors = new Set(sensorIds);
  return geometry.nodes
    .filter((node) => node.nodeType === 'DEVICE' ? devices.has(node.nodeId) : sensors.has(node.nodeId))
    .map((node) => nodeToWorld(node, node.roomId ? roomElevations.get(node.roomId) ?? 0 : 0));
}

export function resolveUnplacedNodes(geometry: TwinLayoutGeometry, deviceIds: readonly string[], sensorIds: readonly string[]) {
  const placed = new Set(geometry.nodes.map((node) => `${node.nodeType}:${node.nodeId}`));
  return {
    deviceIds: deviceIds.filter((id) => !placed.has(`DEVICE:${id}`)),
    sensorIds: sensorIds.filter((id) => !placed.has(`SENSOR:${id}`)),
  };
}

export function homeBounds(rooms: readonly TwinRoomLayout[]): Twin3DBounds {
  if (!rooms.length) return { centerX: 0, centerZ: 0, width: TWIN_WORLD_WIDTH, depth: TWIN_WORLD_DEPTH };
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const room of rooms) {
    const world = roomToWorld(room);
    minX = Math.min(minX, world.x - world.width / 2);
    maxX = Math.max(maxX, world.x + world.width / 2);
    minZ = Math.min(minZ, world.z - world.depth / 2);
    maxZ = Math.max(maxZ, world.z + world.depth / 2);
  }
  return {
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    width: maxX - minX,
    depth: maxZ - minZ,
  };
}

export function cameraPoseForBounds(bounds: Twin3DBounds) {
  const span = Math.max(bounds.width, bounds.depth, 5);
  return {
    position: [bounds.centerX + span * 0.82, span * 0.72 + 4.5, bounds.centerZ + span * 0.92] as const,
    target: [bounds.centerX, 0, bounds.centerZ] as const,
    minDistance: Math.max(4, span * 0.45),
    maxDistance: Math.max(24, span * 2.8),
  };
}
