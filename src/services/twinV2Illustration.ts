import type { TwinLayoutGeometry, TwinRoomLayout } from '../types/twinLayout';
import { twinRoomCategory } from './twinArchitectureAdapter';
import { reconcileTwinGeometry, type TwinNodeRoom } from './twinGeometrySource';

export function roomNameFloorHint(name: string): number {
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const level = Number(normalized.match(/\b(?:tang|floor)\s*(\d{1,3})\b/)?.[1]);
  return Number.isInteger(level) && level >= 1 && level <= 100 ? level : 1;
}

function composeV2Floor(roomIds: readonly string[], nodes: readonly TwinNodeRoom[], names: Readonly<Record<string, string>>): TwinLayoutGeometry {
  const exterior = roomIds.filter(id => twinRoomCategory(names[id] ?? '') === 'garden');
  const interior = roomIds.filter(id => !exterior.includes(id));
  // Larger/atypical houses retain the ordinary deterministic arrangement.
  if (interior.length < 2 || interior.length > 24 || exterior.length > 1) return reconcileTwinGeometry(null, roomIds, nodes);
  const columns = interior.length <= 4 ? 2 : interior.length <= 9 ? 3 : 4;
  const rowCount = Math.ceil(interior.length / columns);
  const coreWidth = exterior.length ? .67 : .88;
  const width = coreWidth / columns, depth = .84 / rowCount;
  const slots = Array.from({ length: columns * rowCount }, (_, index) => ({ x: .06 + index % columns * width, y: .08 + Math.floor(index / columns) * depth, width, height: depth }));
  const occupied = new Set<number>();
  const ordered = [...interior].sort((a, b) => {
    const priority = { bedroom: 0, bathroom: 1, workspace: 2, garage: 3, hallway: 4, living: 5, kitchen: 6, garden: 7 };
    return priority[twinRoomCategory(names[a] ?? '')] - priority[twinRoomCategory(names[b] ?? '')];
  });
  const rooms = new Map<string, TwinRoomLayout>();
  for (const id of ordered) {
    const category = twinRoomCategory(names[id] ?? '');
    const preferred = category === 'living' ? columns * (rowCount - 1) : category === 'kitchen' ? slots.length - 1 : category === 'garage' ? columns - 1 : 0;
    const slot = occupied.has(preferred) ? slots.findIndex((_, index) => !occupied.has(index)) : preferred;
    occupied.add(slot);
    rooms.set(id, { roomId: id, floor: 1, ...slots[slot] });
  }
  if (interior.length >= 4) for (const y of [...new Set(slots.map(slot => slot.y))]) {
    const row = [...rooms.values()].filter(room => room.y === y).sort((a, b) => a.x - b.x);
    if (row.length && row.length < columns) row.forEach((room, index) => {
      room.x = .06 + index * coreWidth / row.length;
      room.width = coreWidth / row.length;
    });
  }
  exterior.forEach(id => rooms.set(id, { roomId: id, floor: 1, x: .73, y: .08, width: .21, height: .84 }));
  return reconcileTwinGeometry({ rooms: roomIds.map(id => rooms.get(id)!), nodes: [] }, roomIds, nodes);
}

/** Unsaved preview only. Explicit floor hints come from API room names, not invented floors. */
export function createV2Illustration(roomIds: readonly string[], nodes: readonly TwinNodeRoom[], names: Readonly<Record<string, string>>): TwinLayoutGeometry {
  const groups = new Map<number, string[]>();
  roomIds.forEach(id => { const level = roomNameFloorHint(names[id] ?? ''); groups.set(level, [...(groups.get(level) ?? []), id]); });
  const floors = [...groups].map(([level, ids]) => {
    let geometry = composeV2Floor(ids, nodes.filter(node => node.roomId !== null && ids.includes(node.roomId)), names);
    if (ids.length === 1) {
      const kind = twinRoomCategory(names[ids[0]] ?? '');
      const room = { roomId: ids[0], floor: level, x: kind === 'garden' ? .73 : .06, y: .08, width: kind === 'garden' ? .21 : .67, height: kind === 'hallway' ? .18 : .84 };
      geometry = reconcileTwinGeometry({ rooms: [room], nodes: [] }, ids, nodes.filter(node => node.roomId === ids[0]));
    }
    return { ...geometry, rooms: geometry.rooms.map(room => ({ ...room, floor: level })) };
  });
  const positions = new Map(floors.flatMap(floor => floor.rooms).map(room => [room.roomId, room]));
  return { rooms: roomIds.map(id => positions.get(id)!), nodes: floors.flatMap(floor => floor.nodes) };
}
