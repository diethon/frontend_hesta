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
// The existing backend accepts six model variants. Extra renderer-only visuals
// retain a typed local object ID, with an ordinary editable base kind in the API.
const v2VisualKinds: Record<string, TwinSceneObjectKind> = { car: 'CABINET', stove: 'KITCHEN_COUNTER', table_round: 'TABLE', sideboard: 'CABINET' };

type Furnishing = [type: string, x: number, z: number, width: number, depth: number, height: number, rotation?: number];
const furnishingPlans: Record<string, Furnishing[]> = {
  living: [['sofa', .72, .52, 2.85, 1.12, 1.08, 90], ['coffee_table', .43, .52, 1.4, .8, .44, 90], ['tv_board', .12, .52, 2.5, .5, .52, -90], ['plant', .14, .14, .62, .62, 1.55], ['plant', .14, .87, .48, .48, 1.15], ['sideboard', .78, .86, .8, .45, .65]],
  bedroom: [['bed', .4, .4, 1.95, 2.55, 1.18], ['nightstand', .16, .2, .5, .45, .64], ['nightstand', .64, .2, .5, .45, .64], ['wardrobe', .84, .28, 1.4, .62, 2.05], ['desk', .8, .8, 1.3, .62, .76], ['office_chair', .8, .63, .58, .6, .95], ['plant', .13, .84, .52, .52, 1.35]],
  kitchen: [['kitchen', .22, .1, 2.2, .62, .9], ['stove', .48, .1, .8, .63, .92], ['sink', .66, .1, .95, .62, .9], ['fridge', .88, .13, .78, .75, 1.92], ['table', .43, .59, 1.9, .95, .79], ['chair', .28, .8, .56, .58, 1.05, 180], ['chair', .57, .8, .56, .58, 1.05, 180], ['chair', .28, .37, .56, .58, 1.05], ['chair', .57, .37, .56, .58, 1.05]],
  bathroom: [['shower', .18, .2, .95, .95, 1.95], ['wc', .71, .2, .4, .7, .78], ['washbasin', .8, .68, .85, .5, .85], ['bathtub', .29, .74, 1.55, .7, .58]],
  workspace: [['desk', .35, .2, 1.5, .7, .75], ['office_chair', .35, .47, .6, .6, .9], ['shelf', .83, .25, 1, .35, 1.8], ['plant', .8, .8, .4, .4, 1]],
  garage: [['car', .36, .5, 1.8, 3.9, 1.4], ['desk', .84, .23, 1.1, .55, .85], ['shelf', .82, .79, 1.2, .4, 1.7]],
  garden: [['plant', .14, .17, .65, .65, 1.8], ['plant', .86, .18, .65, .65, 1.65], ['plant', .16, .83, .75, .75, 1.5], ['plant', .86, .84, .6, .6, 1.3], ['table_round', .5, .46, 1.1, 1.1, .72], ['chair', .5, .73, .48, .5, .85, 180]],
  hallway: [['plant', .12, .5, .5, .5, 1.4], ['sideboard', .72, .18, 1.1, .35, .75], ['plant', .9, .5, .45, .45, 1.2]],
};

export function twinRoomCategory(name: string) {
  const key = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
  if (/garage|gara|nha xe/.test(key)) return 'garage';
  if (/garden|vuon|terrace|balcony|ban cong/.test(key)) return 'garden';
  if (/hall|hanh lang|loi di|cau thang/.test(key)) return 'hallway';
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
  const category = twinRoomCategory(room.name);
  const items: Furniture[] = furnishingPlans[category].map(([type, x, z, w, d, h, rotation = 0], index) => ({
    id: `${room.id}:illustration:${index}${v2VisualKinds[type] ? `:v2-${type}` : ''}`, type,
    x: x0 + x * width, z: z0 + z * depth, w: w * scale, d: d * scale, h: h * scale, rotation,
  }));
  if (category === 'bedroom') {
    const bed = items.find(item => item.type === 'bed')!;
    items.filter(item => item.type === 'nightstand').forEach((item, index) => {
      item.x = bed.x + (index ? 1 : -1) * (bed.w / 2 + item.w / 2 + .08 * scale);
      item.z = bed.z - bed.d * .35;
    });
  }
  if (category === 'kitchen') {
    const fridge = items.find(item => item.type === 'fridge')!, sink = items.find(item => item.type === 'sink')!;
    const stove = items.find(item => item.type === 'stove')!, counter = items.find(item => item.type === 'kitchen')!;
    fridge.x = x0 + width - .18 * scale - fridge.w / 2;
    sink.x = fridge.x - fridge.w / 2 - .05 * scale - sink.w / 2;
    stove.x = sink.x - sink.w / 2 - .05 * scale - stove.w / 2;
    counter.w = Math.max(.4 * scale, stove.x - stove.w / 2 - .05 * scale - (x0 + .2 * scale));
    counter.x = x0 + .2 * scale + counter.w / 2;
    [counter, stove, sink, fridge].forEach(item => { item.z = z0 + .2 * scale + item.d / 2; });
  }
  return items.filter(item => furnitureFootprint(item).every(point => pointInPolygon(point, room.points)));
}

export function adaptTwinArchitecture(view: TwinFloorView, metadata: TwinDraftingMetadata, names: Readonly<Record<string, string>>): TwinArchitecture {
  const rooms: Room[] = view.rooms.map((room) => ({
    id: room.roomId, name: names[room.roomId] ?? '',
    points: room.outline.map((p) => [room.x + p.x, room.z + p.z] as Vec2),
    floor_material: twinRoomCategory(names[room.roomId] ?? '') === 'garage' ? 'concrete' : twinRoomCategory(names[room.roomId] ?? '') === 'bathroom' ? 'tiles' : ['garden', 'kitchen'].includes(twinRoomCategory(names[room.roomId] ?? '')) ? 'stone' : 'wood',
    wall_heights: room.outline.map(() => twinRoomCategory(names[room.roomId] ?? '') === 'garden' && metadata.rooms[room.roomId]?.autoFurniture !== false ? .6 : room.wallHeight),
  }));
  const interiorThickness = Math.max(.08, ...view.rooms.map((room) => room.wallThickness));
  const exteriorThickness = interiorThickness * 1.65;
  const height = Math.max(2.25, ...view.rooms.map((room) => room.wallHeight));
  const floor: Floor = { id: view.id, name: view.name, elevation: view.rooms[0]?.y ?? 0, height, cut_height: .42, rooms, furniture: [], openings: [], walls: [] };
  floor.slabThickness = metadata.floors?.[String(view.level)]?.slabThickness ?? .2;
  const furnitureRooms = new Map<string, string>();
  for (const world of view.rooms) {
    const room = rooms.find((item) => item.id === world.roomId)!;
    const drafting = roomDrafting(metadata, room.id);
    const items = drafting.objects ?? [];
    const authored = items.flatMap((object) => {
      const visual = object.id.match(/:v2-(car|stove|table_round|sideboard)$/)?.[1];
      const type = object.model ?? (visual && v2VisualKinds[visual] === object.kind ? visual : furnitureKinds[object.kind]);
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
    if (twinRoomCategory(room.name) === 'garden') continue;
    const candidates = walls.filter((wall) => wall.sources.some((s) => s.room_id === room.id) && Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]) > 1.4);
    const doorWall = candidates.find((wall) => !wall.exterior && !occupied.has(wall.id)) ?? candidates.find((wall) => !occupied.has(wall.id));
    const windowWall = [...candidates].reverse().find((wall) => wall.exterior && !occupied.has(wall.id) && wall !== doorWall);
    // A garage's outside wall gets a floor-level vehicle opening (where a roller door binds) instead of a window.
    const garage = twinRoomCategory(room.name) === 'garage';
    for (const [wall, kind] of [[doorWall, 'door'], [windowWall, garage ? 'garage-door' : 'window']] as const) {
      if (!wall) continue;
      const src = wall.sources.find((s) => s.room_id === room.id)!;
      const type = kind === 'window' ? 'window' : 'door';
      const opening: Opening = { id: `${room.id}:illustration:${kind}`, room_id: room.id, edge: src.edge, offset: (src.t0 + src.t1) / 2, width: Math.min(kind === 'door' ? .9 : 3, src.t1 - src.t0 - .4), type, sill: type === 'door' ? 0 : .65, height: kind === 'door' ? 2.1 : kind === 'garage-door' ? 2.2 : 1.4, hinge: 'left', swing: 'in', leaves: kind === 'window' ? 2 : 1 };
      floor.openings.push(opening); occupied.add(wall.id);
    }
    // Keep stored point order: the MIT wall generator handles either winding.
    if (Math.abs(signedArea(room.points)) < 1e-6) room.points = [];
  }
  return { floor, exteriorThickness, interiorThickness, furnitureRooms };
}
