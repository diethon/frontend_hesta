import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2 } from 'three';
import { bounds, pointInPolygon, signedArea, type Room, type Vec2 } from '../neonplan/model';
import { architecturalDetailPalette } from './detailPalette';

export const OAK_FLOOR_TOP = .012;
const BOARD_LENGTH = 2.05;
const BOARD_WIDTH = .28;
const BOARD_JOINT = .01;
const EPSILON = 1e-8;

export interface OakBoard {
  x: number;
  z: number;
  width: number;
  depth: number;
  color: string;
}

interface Rectangle { x0: number; x1: number; z0: number; z1: number }
interface VertexBuffer { positions: number[]; normals: number[]; uvs: number[] }

/** Convex clipping is applied to triangulated room faces, never a room's bounding box. */
function clipToRectangle(polygon: readonly Vec2[], rectangle: Rectangle): Vec2[] {
  let result = [...polygon];
  for (const [axis, boundary, keepGreater] of [
    [0, rectangle.x0, true], [0, rectangle.x1, false],
    [1, rectangle.z0, true], [1, rectangle.z1, false],
  ] as const) {
    if (!result.length) break;
    const input = result;
    result = [];
    for (let index = 0; index < input.length; index++) {
      const current = input[index], previous = input[(index + input.length - 1) % input.length];
      const currentInside = keepGreater ? current[axis] >= boundary : current[axis] <= boundary;
      const previousInside = keepGreater ? previous[axis] >= boundary : previous[axis] <= boundary;
      if (currentInside !== previousInside) {
        const t = (boundary - previous[axis]) / (current[axis] - previous[axis]);
        const crossing: Vec2 = [previous[0] + (current[0] - previous[0]) * t, previous[1] + (current[1] - previous[1]) * t];
        crossing[axis] = boundary;
        result.push(crossing);
      }
      if (currentInside) result.push(current);
    }
  }
  return result;
}

function containsOrTouches(point: Vec2, polygon: readonly Vec2[]) {
  return pointInPolygon(point, polygon) || polygon.some((a, index) => {
    const b = polygon[(index + 1) % polygon.length];
    const dx = b[0] - a[0], dz = b[1] - a[1], length2 = dx * dx + dz * dz;
    const t = length2 ? ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / length2 : 0;
    return t >= -EPSILON && t <= 1 + EPSILON
      && Math.hypot(point[0] - a[0] - dx * t, point[1] - a[1] - dz * t) <= EPSILON;
  });
}

function appendTop(buffer: VertexBuffer, polygon: readonly Vec2[], rectangle: Rectangle) {
  const points = signedArea(polygon) < 0 ? [...polygon].reverse() : polygon;
  for (let index = 1; index < points.length - 1; index++) {
    // Clockwise in x/z faces upward in Three's x/y/z coordinate system.
    for (const point of [points[0], points[index + 1], points[index]]) {
      buffer.positions.push(point[0], OAK_FLOOR_TOP, point[1]);
      buffer.normals.push(0, 1, 0);
      buffer.uvs.push((point[0] - rectangle.x0) / (rectangle.x1 - rectangle.x0),
        (point[1] - rectangle.z0) / (rectangle.z1 - rectangle.z0));
    }
  }
}

function toGeometry(buffer: VertexBuffer) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(buffer.positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(buffer.normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(buffer.uvs, 2));
  if (buffer.positions.length) { geometry.computeBoundingBox(); geometry.computeBoundingSphere(); }
  return geometry;
}

/**
 * Full boards share one instanced box. Boundary boards are clipped to the exact
 * triangulated polygon, preserving concave corners and existing stair openings.
 * No new room positions or geometry are inferred here.
 */
export function createOakFloorData(rooms: readonly Room[], holes: readonly (readonly Vec2[])[] = []) {
  const boards: OakBoard[] = [];
  const edgeBuffers = architecturalDetailPalette.oakBoards.map<VertexBuffer>(() => ({ positions: [], normals: [], uvs: [] }));
  for (const room of rooms) {
    if (!['wood', 'oak'].includes(room.floor_material.toLowerCase()) || room.points.length < 3) continue;
    const contour = room.points;
    const insideHoles = holes.filter(hole => hole.length >= 3 && hole.every(point => containsOrTouches(point, contour)));
    const allPoints = [...contour, ...insideHoles.flat()];
    const faces = ShapeUtils.triangulateShape(contour.map(point => new Vector2(...point)),
      insideHoles.map(hole => hole.map(point => new Vector2(...point))));
    const triangles = faces.map(face => face.map(index => allPoints[index]));
    const extent = bounds(contour);
    // Keep board dimensions architectural even for exceptionally large layouts.
    const step = Math.max(1, Math.sqrt((extent.x1 - extent.x0) * (extent.z1 - extent.z0) / 2500));
    const rowWidth = BOARD_WIDTH * step, boardLength = BOARD_LENGTH * step;
    const rowCount = Math.ceil((extent.z1 - extent.z0) / rowWidth);
    for (let row = 0; row < rowCount; row++) {
      const z0 = extent.z0 + row * rowWidth + BOARD_JOINT / 2;
      const z1 = Math.min(extent.z1 - BOARD_JOINT / 2, z0 + rowWidth - BOARD_JOINT);
      const stagger = row % 3 * boardLength / 3;
      const columnCount = Math.ceil((extent.x1 - extent.x0 + stagger) / boardLength);
      for (let column = 0; column < columnCount; column++) {
        const x0 = Math.max(extent.x0 + BOARD_JOINT / 2, extent.x0 + column * boardLength - stagger + BOARD_JOINT / 2);
        const x1 = Math.min(extent.x1 - BOARD_JOINT / 2, extent.x0 + (column + 1) * boardLength - stagger - BOARD_JOINT / 2);
        if (x1 - x0 <= BOARD_JOINT || z1 - z0 <= BOARD_JOINT) continue;
        const rectangle = { x0, x1, z0, z1 };
        const fragments = triangles.map(triangle => clipToRectangle(triangle, rectangle))
          .filter(fragment => fragment.length >= 3 && Math.abs(signedArea(fragment)) > EPSILON);
        const coveredArea = fragments.reduce((sum, fragment) => sum + Math.abs(signedArea(fragment)), 0);
        const fullArea = (x1 - x0) * (z1 - z0);
        if (coveredArea < EPSILON) continue;
        const colorIndex = (row * 7 + column * 3) % architecturalDetailPalette.oakBoards.length;
        if (Math.abs(coveredArea - fullArea) <= fullArea * 1e-7) {
          boards.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2,
            width: x1 - x0, depth: z1 - z0, color: architecturalDetailPalette.oakBoards[colorIndex] });
        } else fragments.forEach(fragment => appendTop(edgeBuffers[colorIndex], fragment, rectangle));
      }
    }
  }
  return { boards, edges: edgeBuffers.map(toGeometry) };
}
