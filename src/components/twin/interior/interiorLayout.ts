import { builtinBase, furnitureFootprint, pointInPolygon, type Furniture, type Room } from '../neonplan/model';

type Vec3 = [number, number, number];
const assetSizes: Record<string, Vec3> = {
  sofa: [3.06, 1.45, 1.38], bed: [2.12, 1.3, 2.66], coffee_table: [1.65, .81, .85],
  kitchen: [3.8, 1.48, .8], plant: [.65, 1.5, .65],
  armchair: [.85, 1.3, .95], chair: [.6, 1.1, .55], table: [1.66, .9, 1.66],
  tv_board: [3.1, .55, .575], wardrobe: [1.3, 2.2, .7],
};

/** Preserve saved anchors, dimensions, rotation and mounting height across renderer changes. */
export function interiorTransform(item: Furniture): { position: Vec3; rotation: Vec3; scale: Vec3 } {
  const size = assetSizes[item.type] ?? [1, 1, 1];
  return { position: [item.x, item.mount_y ?? builtinBase(item), item.z], rotation: [0, -item.rotation * Math.PI / 180, 0], scale: [item.w / size[0], item.h / size[1], item.d / size[2]] };
}

/** Decoration is renderer-only and is omitted when it would cross a concave room boundary. */
export function interiorRugs(room: Room, furniture: readonly Furniture[]): Furniture[] {
  return furniture.filter((item) => item.type === 'sofa' || item.type === 'bed').flatMap((item) => {
    const a = item.rotation * Math.PI / 180, forward = item.type === 'sofa' ? item.d * .55 : 0;
    const rug = { ...item, id: `${item.id}:rug`, type: 'rug', x: item.x - Math.sin(a) * forward, z: item.z + Math.cos(a) * forward, w: item.w * 1.17, d: item.d * (item.type === 'sofa' ? 2.6 : 1.15), h: .025, mount_y: .008 };
    return furnitureFootprint(rug).every((p) => pointInPolygon(p, room.points)) ? [rug] : [];
  });
}

const supported = new Set(['sofa', 'bed', 'coffee_table', 'kitchen', 'plant', 'armchair', 'chair', 'office_chair', 'table', 'desk', 'tv_board', 'wardrobe', 'nightstand', 'shelf', 'fridge', 'sink', 'washbasin', 'wc', 'shower', 'bathtub', 'lamp_floor']);
export const hasApartmentModel = (type: string) => supported.has(type);
