import type { TwinHouseView } from '../types/twinView';

/** A room detail view keeps API IDs and world coordinates; it never creates rooms. */
export function scopeTwinHouse(house: TwinHouseView, roomId: string | null): TwinHouseView {
  if (!roomId || !house.floors.some((floor) => floor.rooms.some((room) => room.roomId === roomId))) return house;
  return { ...house, floors: house.floors.filter((floor) => floor.rooms.some((room) => room.roomId === roomId)).map((floor) => ({
    ...floor, rooms: floor.rooms.filter((room) => room.roomId === roomId), nodes: floor.nodes.filter((node) => node.roomId === roomId),
  })) };
}
