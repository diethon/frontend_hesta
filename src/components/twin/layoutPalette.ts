import type { TwinLayoutGeometry } from '../../types/twinLayout';
import { clampRoom, defaultRoom, moveLayoutNode, nodeKey } from './layoutGeometry';

export const PALETTE_MIME = 'application/x-hesta-twin-item';
export type PaletteItem = { kind: 'room' | 'DEVICE' | 'SENSOR'; id: string };

export function placePaletteItem(geometry: TwinLayoutGeometry, item: PaletteItem, x: number, y: number): TwinLayoutGeometry {
  if (item.kind === 'room') {
    if (geometry.rooms.some((room) => room.roomId === item.id)) return geometry;
    const room = defaultRoom(item.id, geometry.rooms.length);
    return { ...geometry, rooms: [...geometry.rooms, clampRoom({ ...room, x, y })] };
  }
  const node = { nodeType: item.kind, nodeId: item.id, roomId: null, x, y };
  if (geometry.nodes.some((placed) => nodeKey(placed) === nodeKey(node))) return geometry;
  return { ...geometry, nodes: [...geometry.nodes, moveLayoutNode(node, x, y, geometry.rooms)] };
}

export function removeSelection(geometry: TwinLayoutGeometry, selection: { kind: 'room' | 'node'; id: string }): TwinLayoutGeometry {
  return selection.kind === 'room' ? {
    rooms: geometry.rooms.filter((room) => room.roomId !== selection.id),
    nodes: geometry.nodes.map((node) => node.roomId === selection.id ? { ...node, roomId: null } : node),
  } : { ...geometry, nodes: geometry.nodes.filter((node) => nodeKey(node) !== selection.id) };
}
