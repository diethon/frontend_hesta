import type { TwinFloorView } from '../types/twinView';
import type { TwinDraftingMetadata, TwinSceneObjectKind } from '../components/twin/twinDrafting';
import { roomDrafting } from '../components/twin/twinDrafting';
import type { Floor, Furniture, Opening, Room, Vec2 } from '../components/twin/neonplan/model';
import { furnitureFootprint, pointInPolygon, signedArea } from '../components/twin/neonplan/model';
import { generateWalls, locateOnWalls } from '../components/twin/neonplan/geometry/walls';

/** Geometry-only boundary. IDs always refer to HESTA rooms or local layout objects. */
export interface TwinArchitecture {
  floor: Floor;
  exteriorThickness: number;
  interiorThickness: number;
  furnitureRooms: ReadonlyMap<string, string>;
}

const furnitureKinds: Partial<Record<TwinSceneObjectKind, string>> = {
  TABLE: 'table', SOFA: 'sofa', BED: 'bed', CABINET: 'wardrobe', CHAIR: 'chair', DESK: 'desk',
  TV_STAND: 'tv_board', WARDROBE: 'wardrobe', KITCHEN_COUNTER: 'kitchen', SINK: 'sink',
  TOILET: 'wc', SHOWER: 'shower', BATHTUB: 'bathtub', PLANT: 'plant', LAMP: 'lamp_floor', REFRIGERATOR: 'fridge',
};

type Furnishing = [type: string, x: number, z: number, width: number, depth: number, height: number, rotation?: number];
const furnishingPlans: Record<string, Furnishing[]> = {
  living: [['sofa', .26, .24, 2.5, .95, .85], ['coffee_table', .3, .51, 1.15, .6, .4], ['tv_board', .76, .25, 1.8, .45, .5], ['armchair', .67, .65, .85, .85, .8, -30], ['plant', .88, .83, .5, .5, 1.1]],
  bedroom: [['bed', .37, .28, 1.65, 2.1, .85], ['nightstand', .16, .2, .45, .4, .5], ['wardrobe', .83, .25, 1.35, .6, 1.95], ['desk', .77, .76, 1.1, .6, .75], ['office_chair', .77, .56, .5, .5, .9]],
  kitchen: [['kitchen', .29, .12, 2.2, .6, .9], ['sink', .64, .12, .9, .6, .9], ['fridge', .88, .18, .65, .65, 1.8], ['table', .42, .59, 1.25, .8, .75], ['chair', .28, .8, .45, .5, .9, 180], ['chair', .56, .8, .45, .5, .9, 180]],
  bathroom: [['shower', .18, .2, .95, .95, 1.95], ['wc', .71, .2, .4, .7, .78], ['washbasin', .8, .68, .85, .5, .85], ['bathtub', .29, .74, 1.55, .7, .58]],
  workspace: [['desk', .35, .2, 1.5, .7, .75], ['office_chair', .35, .47, .6, .6, .9], ['shelf', .83, .25, 1, .35, 1.8], ['plant', .8, .8, .4, .4, 1]],
};

function roomCategory(name: string) {
  const key = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/ngu|bed/.test(key)) return 'bedroom';
  if (/bep|kitchen/.test(key)) return 'kitchen';
  if (/tam|bath|wc|toilet/.test(key)) return 'bathroom';
  if (/work|lam viec|study|office/.test(key)) return 'workspace';
  return 'living';
}

/** Fixed illustration, never random rooms or device placements. Omit items that do not fit the polygon. */
function furnish(room: Room): Furniture[] {
  const xs = room.points.map((p) => p[0]), zs = room.points.map((p) => p[1]);
  const x0 = Math.min(...xs), z0 = Math.min(...zs), width = Math.max(...xs) - x0, depth = Math.max(...zs) - z0;
  const scale = Math.min(1, width / 4.5, depth / 3.5);
  return furnishingPlans[roomCategory(room.name)].flatMap(([type, x, z, w, d, h, rotation = 0], index) => {
    const item: Furniture = { id: `${room.id}:illustration:${index}`, type, x: x0 + x * width, z: z0 + z * depth, w: w * scale, d: d * scale, h: h * scale, rotation };
    return furnitureFootprint(item).every((p) => pointInPolygon(p, room.points)) ? [item] : [];
  });
}

export function adaptTwinArchitecture(view: TwinFloorView, metadata: TwinDraftingMetadata, names: Readonly<Record<string, string>>): TwinArchitecture {
  const rooms: Room[] = view.rooms.map((room) => ({
    id: room.roomId, name: names[room.roomId] ?? '',
    points: room.outline.map((p) => [room.x + p.x, room.z + p.z] as Vec2),
    floor_material: roomCategory(names[room.roomId] ?? '') === 'bathroom' ? 'tiles' : roomCategory(names[room.roomId] ?? '') === 'kitchen' ? 'stone' : 'wood',
    wall_heights: room.outline.map(() => room.wallHeight),
  }));
  const interiorThickness = Math.max(.08, ...view.rooms.map((room) => room.wallThickness));
  const exteriorThickness = interiorThickness * 1.65;
  const height = Math.max(2.25, ...view.rooms.map((room) => room.wallHeight));
  const floor: Floor = { id: view.id, name: view.name, elevation: view.rooms[0]?.y ?? 0, height, cut_height: .85, rooms, furniture: [], openings: [], walls: [] };
  floor.slabThickness = metadata.floors?.[String(view.level)]?.slabThickness ?? .2;
  const furnitureRooms = new Map<string, string>();
  for (const world of view.rooms) {
    const room = rooms.find((item) => item.id === world.roomId)!;
    const drafting = roomDrafting(metadata, room.id);
    const items = drafting.objects ?? [];
    const authored = items.flatMap((object) => {
      const type = object.model ?? furnitureKinds[object.kind];
      return type ? [{ id: object.id, type, x: world.x - world.width / 2 + object.x, z: world.z - world.depth / 2 + object.z, w: object.width, d: object.depth, h: object.height, rotation: object.rotation }] : [];
    });
    const furniture = [...(drafting.autoFurniture !== false ? furnish(room) : []), ...authored];
    furniture.forEach((item) => furnitureRooms.set(item.id, room.id));
    floor.furniture.push(...furniture);
    for (const object of items.filter((item) => item.kind === 'WALL')) {
      const a = object.rotation * Math.PI / 180, x = world.x - world.width / 2 + object.x, z = world.z - world.depth / 2 + object.z;
      floor.walls.push({ id: object.id, a: [x - Math.cos(a) * object.width / 2, z + Math.sin(a) * object.width / 2], b: [x + Math.cos(a) * object.width / 2, z - Math.sin(a) * object.width / 2], thickness: object.depth, height: object.height });
    }
    for (const object of items.filter((item) => item.kind === 'DOOR' || item.kind === 'WINDOW')) {
      const point: Vec2 = [world.x - world.width / 2 + object.x, world.z - world.depth / 2 + object.z];
      let nearest = { edge: 0, offset: 0, distance: Infinity };
      room.points.forEach((p, edge) => {
        const q = room.points[(edge + 1) % room.points.length], dx = q[0] - p[0], dz = q[1] - p[1], length = Math.hypot(dx, dz);
        if (length < .01) return;
        const offset = Math.max(0, Math.min(length, ((point[0] - p[0]) * dx + (point[1] - p[1]) * dz) / length));
        const distance = Math.hypot(point[0] - p[0] - dx * offset / length, point[1] - p[1] - dz * offset / length);
        if (distance < nearest.distance) nearest = { edge, offset, distance };
      });
      floor.openings.push({ id: object.id, room_id: room.id, edge: nearest.edge, offset: nearest.offset, width: object.width, type: object.kind === 'DOOR' ? 'door' : 'window', sill: object.sill ?? (object.kind === 'DOOR' ? 0 : .9), height: object.height, hinge: 'left', swing: 'in', leaves: 1 });
    }
  }
  const { walls } = generateWalls(rooms, { exterior: exteriorThickness, interior: interiorThickness }, floor.walls);
  const occupied = new Set(floor.openings.flatMap((o) => {
    const room = rooms.find((r) => r.id === o.room_id);
    const wall = room && locateOnWalls(walls, room, o.edge, o.offset)?.wall;
    return wall ? [wall.id] : [];
  }));
  // Geometry is supplemental: absent authored openings use a visible architectural illustration.
  for (const room of rooms) {
    if (metadata.rooms[room.id]?.autoFurniture === false) continue; // Authored document explicitly supplies all openings.
    const candidates = walls.filter((wall) => wall.sources.some((s) => s.room_id === room.id) && Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]) > 1.4);
    const doorWall = candidates.find((wall) => !wall.exterior && !occupied.has(wall.id)) ?? candidates.find((wall) => !occupied.has(wall.id));
    const windowWall = [...candidates].reverse().find((wall) => wall.exterior && !occupied.has(wall.id) && wall !== doorWall);
    for (const [wall, type] of [[doorWall, 'door'], [windowWall, 'window']] as const) {
      if (!wall) continue;
      const src = wall.sources.find((s) => s.room_id === room.id)!;
      const opening: Opening = { id: `${room.id}:illustration:${type}`, room_id: room.id, edge: src.edge, offset: (src.t0 + src.t1) / 2, width: Math.min(type === 'door' ? .9 : 1.8, src.t1 - src.t0 - .4), type, sill: type === 'door' ? 0 : .85, height: type === 'door' ? 2.1 : 1.25, hinge: 'left', swing: 'in', leaves: type === 'door' ? 1 : 2 };
      floor.openings.push(opening); occupied.add(wall.id);
    }
    // Keep stored point order: the MIT wall generator handles either winding.
    if (Math.abs(signedArea(room.points)) < 1e-6) room.points = [];
  }
  return { floor, exteriorThickness, interiorThickness, furnitureRooms };
}
