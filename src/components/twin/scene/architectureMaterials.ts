import { DoubleSide, LineBasicMaterial, Mesh, MeshBasicMaterial, MeshDepthMaterial, MeshStandardMaterial, RGBADepthPacking, type Intersection, type Raycaster, type BufferGeometry } from 'three';
import { makeFoldable, type FoldMasks } from '../neonplan/viewer/fold';
import type { Vec2 } from '../neonplan/model';
export type TwinWallMode = 'auto' | 'cut';
export type TwinMarkerMode = 'important' | 'all' | 'none';
export type TwinFloorMode = 'house' | 'single' | 'exploded';

/** NeonPlan viewer3d.updateWalls: direction buckets face the orbit camera at dot >= .25. */
export function updateWallMasks(masks: FoldMasks, buckets: readonly (Vec2 | null)[], dx: number, dz: number, mode: TwinWallMode) {
  const length = Math.hypot(dx, dz) || 1;
  masks.standing.value = mode === 'cut' ? 0 : 0xffff;
  masks.glass.value = mode === 'cut' ? 0 : buckets.reduce((bits, n, index) => n && (n[0] * dx + n[1] * dz) / length >= .25 ? bits | (1 << index) : bits, 0);
}
export function foldVisible(value: number, masks: FoldMasks, solid = true) {
  if (value < 0) return true;
  const kind = Math.floor(value / 16), bucket = value % 16;
  const standing = (masks.standing.value & (1 << bucket)) !== 0, glass = (masks.glass.value & (1 << bucket)) !== 0;
  return (kind === 0 ? standing : kind === 1 || kind === 3 ? !standing : true) && !(solid && glass && (kind === 0 || kind === 2));
}
/** GPU-hidden walls must also be absent from picking. */
export function architecturalRaycast(this: Mesh, raycaster: Raycaster, intersects: Intersection[], masks: FoldMasks, solid = true) {
  const hits: Intersection[] = [];
  Mesh.prototype.raycast.call(this, raycaster, hits);
  const fold = this.geometry.getAttribute('fold');
  for (const hit of hits) if (!fold || foldVisible(fold.getX((hit.faceIndex ?? 0) * 3), masks, solid)) intersects.push(hit);
}
export function architectureMaterials(masks: FoldMasks) {
  return {
    floor: new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.86}),
    walls: makeFoldable(new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .85 }), masks, 'solid'),
    glassWalls: makeFoldable(new MeshBasicMaterial({ vertexColors: true, side: DoubleSide, transparent: true, opacity: .35, depthWrite: false }), masks, 'glass'),
    depth: makeFoldable(new MeshDepthMaterial({ depthPacking: RGBADepthPacking, side: DoubleSide }), masks, 'solid'),
    lines: makeFoldable(new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .48 }), masks),
    frames: makeFoldable(new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .65 }), masks),
    windowGlass: makeFoldable(new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, transparent: true, opacity: .23, depthWrite: false, roughness: .18 }), masks),
    blinds: makeFoldable(new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .8 }), masks),
  };
}
export function disposeGeometries(items: object) {
  for (const value of Object.values(items)) if (value && typeof value === 'object' && 'isBufferGeometry' in value) (value as BufferGeometry).dispose();
}
