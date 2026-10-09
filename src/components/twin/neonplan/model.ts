// Adapted from NeonPlan 3D, bb5261d29fc45ba0bb4a586bca2500f94ec9ea1d.
// Copyright (c) 2026 Mastershort. MIT; see THIRD_PARTY_NOTICES.md.
// HESTA renderer-only port: no integration or external asset packs.

export type Vec2 = [number, number];
export interface Room { id: string; name: string; points: Vec2[]; floor_material: string; wall_heights?: (number | null)[]; }
export interface Furniture { id: string; type: string; x: number; z: number; rotation: number; w: number; d: number; h: number; variant?: string | null; mount_y?: number; }
export interface FreeWall { id: string; a: Vec2; b: Vec2; thickness?: number; height?: number; }
export type OpeningStyle = "interior" | "front" | "front_glass" | "sidelight" | "sidelights" | "glass" | "sliding" | "passage" | "standard" | "bars";
const DOOR_STYLES: readonly string[] = ['interior', 'front', 'front_glass', 'sidelight', 'sidelights', 'glass', 'sliding', 'passage'];
const WINDOW_STYLES: readonly string[] = ['standard', 'bars'];
export interface Opening { id: string; room_id: string; edge: number; offset: number; wall?: string; width: number; type: "door" | "window" | "garage"; sill: number; height: number; hinge: "left" | "right"; leaves: 1 | 2; swing: "in" | "out"; style?: OpeningStyle; mark?: "open" | "closed"; }
export interface Floor { id: string; name: string; elevation: number; height: number; cut_height: number; rooms: Room[]; furniture: Furniture[]; openings: Opening[]; walls: FreeWall[]; slabThickness?: number; }
export type LampModel = "ceiling" | "downlight" | "spot" | "panel" | "pendant" | "floor" | "uplight" | "table" | "wall" | "strip" | "bollard" | "garden";
export const WALL_LAMP_Y = 1.75;
export const isLamp = (type: string) => type.startsWith("lamp_") || type === "led_strip";
export const mountBase = (_floor: Floor, f: Furniture) => f.mount_y ?? builtinBase(f);
export function builtinBase(f: Pick<Furniture, "type" | "h"> & { variant?: string | null }): number {
  switch (f.type) {
    case "home_battery":
      // a wall battery hangs at hip height
      return f.variant === "wall" ? 0.5 : 0;
    case "kitchen_wall":
      return 1.45;
    case "tv_wall":
      return Math.max(0, 1.3 - f.h / 2);
    case "radiator":
      return 0.12;
    case "inverter":
      return 1.1;
    case "wallbox":
      return 1.0;
    case "meter":
      return 0.4;
    default:
      return 0;
  }
}

export function openingStyle(o: Pick<Opening, "type" | "style">, exterior: boolean): OpeningStyle {
  if (o.type === "door") return o.style && (DOOR_STYLES as readonly string[]).includes(o.style) ? o.style : exterior ? "front" : "interior";
  return o.style && (WINDOW_STYLES as readonly string[]).includes(o.style) ? o.style : "standard";
}

/** A front door look (thick leaf, threshold, light above it). */
export function isFrontDoor(style: OpeningStyle): boolean {
  return style === "front" || style === "front_glass" || style === "sidelight" || style === "sidelights";
}

export function signedArea(points: readonly Vec2[]): number {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const [x0, z0] = points[i];
    const [x1, z1] = points[(i + 1) % points.length];
    a += x0 * z1 - x1 * z0;
  }
  return a / 2;
}

export function polygonArea(points: readonly Vec2[]): number {
  return Math.abs(signedArea(points));
}

/** Area-weighted centroid; falls back to the vertex average for degenerate polygons. */
export function centroid(points: readonly Vec2[]): Vec2 {
  const a = signedArea(points);
  if (Math.abs(a) < 1e-9) {
    const n = points.length || 1;
    return [points.reduce((s, p) => s + p[0], 0) / n, points.reduce((s, p) => s + p[1], 0) / n];
  }
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < points.length; i++) {
    const [x0, z0] = points[i];
    const [x1, z1] = points[(i + 1) % points.length];
    const f = x0 * z1 - x1 * z0;
    cx += (x0 + x1) * f;
    cz += (z0 + z1) * f;
  }
  return [cx / (6 * a), cz / (6 * a)];
}

/** True when the polygon is an axis-aligned rectangle (so the editor can offer x/z/width/depth fields). */
export function isAxisRect(points: readonly Vec2[]): boolean {
  if (points.length !== 4) return false;
  for (let i = 0; i < 4; i++) {
    const [x0, z0] = points[i];
    const [x1, z1] = points[(i + 1) % 4];
    if (Math.abs(x0 - x1) > 1e-6 && Math.abs(z0 - z1) > 1e-6) return false;
  }
  return true;
}

export function bounds(points: readonly Vec2[]): { x0: number; z0: number; x1: number; z1: number } {
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (const [x, z] of points) {
    x0 = Math.min(x0, x);
    z0 = Math.min(z0, z);
    x1 = Math.max(x1, x);
    z1 = Math.max(z1, z);
  }
  return { x0, z0, x1, z1 };
}

/** Corners of a furniture item in world x/z (rotated rectangle). */
export function furnitureFootprint(f: Furniture): Vec2[] {
  const a = (f.rotation * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const hw = f.w / 2;
  const hd = f.d / 2;
  return [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ].map(([x, z]) => [f.x + x * c - z * s, f.z + x * s + z * c] as Vec2);
}

export function pointInPolygon(p: Vec2, points: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, zi] = points[i];
    const [xj, zj] = points[j];
    if (zi > p[1] !== zj > p[1] && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

