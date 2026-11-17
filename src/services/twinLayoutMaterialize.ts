import type { TwinArchitecture, TwinLayoutGeometry } from '../types/twinLayout';
import { architectureFromDrafting, roomDrafting, type TwinDraftingMetadata, type TwinSceneObject } from '../components/twin/twinDrafting';
import { adaptTwinHouse } from './twinAdapter';
import { adaptTwinArchitecture } from './twinArchitectureAdapter';
import { locateOnWalls, generateWalls } from '../components/twin/neonplan/geometry/walls';

const kinds: Record<string, TwinSceneObject['kind']> = { table:'TABLE',coffee_table:'TABLE',sofa:'SOFA',armchair:'CHAIR',bed:'BED',nightstand:'CABINET',wardrobe:'WARDROBE',chair:'CHAIR',office_chair:'CHAIR',desk:'DESK',shelf:'CABINET',tv_board:'TV_STAND',kitchen:'KITCHEN_COUNTER',sink:'SINK',washbasin:'SINK',wc:'TOILET',shower:'SHOWER',bathtub:'BATHTUB',plant:'PLANT',fridge:'REFRIGERATOR',lamp_floor:'LAMP',car:'CABINET',stove:'KITCHEN_COUNTER',table_round:'TABLE',sideboard:'CABINET' };
const variants = new Set(['armchair','coffee_table','nightstand','office_chair','shelf','washbasin']);

const isIllustration = (id: string) => id.includes(':illustration:');

/**
 * Frozen illustration furniture keeps metre positions from the old room size. For rooms whose size
 * or outline changed, drop those generated items so Save re-furnishes them for the new shape.
 * Hand-placed objects are kept, and rooms the owner left without generated furniture stay as they are.
 */
export function refreshResizedFurniture(metadata: TwinDraftingMetadata, saved: TwinDraftingMetadata, geometry: TwinLayoutGeometry, savedGeometry: TwinLayoutGeometry): TwinDraftingMetadata {
  const rooms = { ...metadata.rooms };
  let changed = false;
  for (const room of geometry.rooms) {
    const before = savedGeometry.rooms.find((item) => item.roomId === room.roomId);
    const current = roomDrafting(metadata, room.roomId);
    if (!before || current.autoFurniture !== false || !current.objects?.some((item) => isIllustration(item.id))) continue;
    const reshaped = before.width !== room.width || before.height !== room.height
      || JSON.stringify(current.points) !== JSON.stringify(roomDrafting(saved, room.roomId).points);
    if (!reshaped) continue;
    rooms[room.roomId] = { ...current, autoFurniture: true, objects: current.objects.filter((item) => !isIllustration(item.id)) };
    changed = true;
  }
  return changed ? { ...metadata, rooms } : metadata;
}

/** Freeze inferred furniture/openings into the same revisioned backend document on explicit Save. */
export function materializeTwinArchitecture(homeId: string, geometry: TwinLayoutGeometry, metadata: TwinDraftingMetadata, names: Record<string,string>): TwinArchitecture {
  const result = architectureFromDrafting(metadata, geometry);
  const house = adaptTwinHouse(homeId, geometry, metadata, [], [], 'all', false);
  for (const floor of house.floors) {
    const architecture = adaptTwinArchitecture(floor, metadata, names);
    result.floors ??= {};
    result.floors[String(floor.level)] ??= { elevation: floor.rooms[0]?.y ?? 0, height: architecture.floor.height, slabThickness: .2 };
    const walls = generateWalls(architecture.floor.rooms, { exterior: architecture.exteriorThickness, interior: architecture.interiorThickness }, architecture.floor.walls).walls;
    for (const world of floor.rooms) {
      const current = roomDrafting(metadata, world.roomId), objects = [...current.objects ?? []];
      const left=world.x-world.width/2, top=world.z-world.depth/2;
      for (const item of architecture.floor.furniture.filter(f=>architecture.furnitureRooms.get(f.id)===world.roomId&&!objects.some(o=>o.id===f.id))) {
        objects.push({id:item.id,kind:kinds[item.type]??'CABINET',x:Math.max(0,item.x-left),z:Math.max(0,item.z-top),width:item.w,depth:item.d,height:item.h,rotation:item.rotation,...(variants.has(item.type)?{model:item.type as TwinSceneObject['model']}: {})});
      }
      for (const opening of architecture.floor.openings.filter(o=>o.room_id===world.roomId&&!objects.some(item=>item.id===o.id))) {
        const room=architecture.floor.rooms.find(r=>r.id===world.roomId)!;
        const located=locateOnWalls(walls,room,opening.edge,opening.offset);
        if(!located)continue;
        const p=room.points[opening.edge],q=room.points[(opening.edge+1)%room.points.length],length=Math.hypot(q[0]-p[0],q[1]-p[1]);
        objects.push({id:opening.id,kind:opening.type==='door'?'DOOR':'WINDOW',x:Math.max(0,p[0]+(q[0]-p[0])*opening.offset/length-left),z:Math.max(0,p[1]+(q[1]-p[1])*opening.offset/length-top),width:opening.width,depth:architecture.interiorThickness,height:opening.height??2.05,rotation:0,sill:opening.sill??0});
      }
      result.rooms[world.roomId]={...current,objects,autoFurniture:false,floorHeightMeters:world.wallHeight,wallThicknessMeters:world.wallThickness};
    }
  }
  return architectureFromDrafting({ ...metadata, rooms: result.rooms, nodeRotations: result.nodeRotations, floors: result.floors }, geometry);
}
