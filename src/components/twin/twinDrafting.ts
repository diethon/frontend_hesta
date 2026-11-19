export type TwinRoomShape = 'RECTANGLE' | 'L_SHAPE' | 'U_SHAPE' | 'CUSTOM';

export interface TwinDraftPoint {
  x: number;
  y: number;
}

export interface TwinRoomDrafting {
  shape: TwinRoomShape;
  points: TwinDraftPoint[];
  widthMeters?: number;
  depthMeters?: number;
  floorHeightMeters?: number;
  wallThicknessMeters?: number;
  objects?: TwinSceneObject[];
  autoFurniture?: boolean;
}

export type TwinSceneObjectKind = 'WALL' | 'DOOR' | 'WINDOW' | 'TABLE' | 'SOFA' | 'BED' | 'CABINET' | 'CHAIR' | 'DESK' | 'TV_STAND' | 'WARDROBE' | 'KITCHEN_COUNTER' | 'SINK' | 'TOILET' | 'SHOWER' | 'BATHTUB' | 'PLANT' | 'LAMP' | 'REFRIGERATOR';
export interface TwinSceneObject {
  id: string;
  kind: TwinSceneObjectKind;
  /** Metres from the room's top-left bounding corner, yaw in degrees. */
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  rotation: number;
  model?: 'armchair' | 'coffee_table' | 'nightstand' | 'office_chair' | 'shelf' | 'washbasin';
  sill?: number;
}
export const sceneObjectKinds: readonly TwinSceneObjectKind[] = ['WALL', 'DOOR', 'WINDOW', 'TABLE', 'SOFA', 'BED', 'CABINET', 'CHAIR', 'DESK', 'TV_STAND', 'WARDROBE', 'KITCHEN_COUNTER', 'SINK', 'TOILET', 'SHOWER', 'BATHTUB', 'PLANT', 'LAMP', 'REFRIGERATOR'];
export const snapMeters = (value: number, step: number) => Math.round(Math.round(value / step) * step * 1000) / 1000;

export interface TwinBlueprintUnderlay {
  name: string;
  dataUrl: string;
  opacity: number;
}

export interface TwinDraftingMetadata {
  version: 1;
  settings: {
    gridSnap: boolean;
    edgeSnap: boolean;
    gridMeters?: number;
  };
  rooms: Record<string, TwinRoomDrafting>;
  blueprints: Record<string, TwinBlueprintUnderlay>;
  nodeRotations?: Record<string, number>;
  floors?: Record<string, { elevation: number; height: number; slabThickness: number }>;
}

const PRECISION = 1000;

const templatePoints: Record<TwinRoomShape, TwinDraftPoint[]> = {
  RECTANGLE: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ],
  L_SHAPE: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 0.52 },
    { x: 0.56, y: 0.52 },
    { x: 0.56, y: 1 },
    { x: 0, y: 1 },
  ],
  U_SHAPE: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0.7, y: 1 },
    { x: 0.7, y: 0.43 },
    { x: 0.3, y: 0.43 },
    { x: 0.3, y: 1 },
    { x: 0, y: 1 },
  ],
  CUSTOM: [
    { x: 0.08, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 0.72 },
    { x: 0.72, y: 1 },
    { x: 0, y: 1 },
    { x: 0, y: 0.2 },
  ],
};

const round = (value: number) => Math.round(value * PRECISION) / PRECISION;
const clamp = (value: number) => round(Math.max(0, Math.min(1, value)));

export function createTwinDraftingMetadata(): TwinDraftingMetadata {
  return {
    version: 1,
    settings: { gridSnap: true, edgeSnap: true, gridMeters: 0.5 },
    rooms: {},
    blueprints: {},
  };
}

export function roomShapePoints(shape: TwinRoomShape) {
  return templatePoints[shape].map((point) => ({ ...point }));
}

export function roomDrafting(metadata: TwinDraftingMetadata, roomId: string): TwinRoomDrafting {
  return metadata.rooms[roomId] ?? { shape: 'RECTANGLE', points: roomShapePoints('RECTANGLE') };
}

export function changeRoomShape(metadata: TwinDraftingMetadata, roomId: string, shape: TwinRoomShape): TwinDraftingMetadata {
  const current = roomDrafting(metadata, roomId);
  return {
    ...metadata,
    rooms: {
      ...metadata.rooms,
      [roomId]: { ...current, shape, points: roomShapePoints(shape) },
    },
  };
}

export type TwinRoomTransform = 'ROTATE_LEFT' | 'ROTATE_RIGHT' | 'FLIP_HORIZONTAL' | 'FLIP_VERTICAL';

export function transformRoomPoints(points: readonly TwinDraftPoint[], transform: TwinRoomTransform) {
  const transformed = points.map((point) => {
    switch (transform) {
      case 'ROTATE_LEFT': return { x: point.y, y: 1 - point.x };
      case 'ROTATE_RIGHT': return { x: 1 - point.y, y: point.x };
      case 'FLIP_HORIZONTAL': return { x: 1 - point.x, y: point.y };
      case 'FLIP_VERTICAL': return { x: point.x, y: 1 - point.y };
    }
  });
  const ordered = transform === 'FLIP_HORIZONTAL' || transform === 'FLIP_VERTICAL'
    ? transformed.reverse()
    : transformed;
  return ordered.map((point) => ({ x: clamp(point.x), y: clamp(point.y) }));
}

export function transformRoomDrafting(metadata: TwinDraftingMetadata, roomId: string, transform: TwinRoomTransform): TwinDraftingMetadata {
  const current = roomDrafting(metadata, roomId);
  return changeRoomDrafting(metadata, roomId, {
    ...current,
    points: transformRoomPoints(current.points, transform),
  });
}

export function changeRoomDrafting(metadata: TwinDraftingMetadata, roomId: string, next: TwinRoomDrafting): TwinDraftingMetadata {
  return {
    ...metadata,
    rooms: {
      ...metadata.rooms,
      [roomId]: {
        ...next,
        points: next.points.map((point) => ({ x: clamp(point.x), y: clamp(point.y) })),
      },
    },
  };
}

export function polygonCss(points: readonly TwinDraftPoint[]) {
  return `polygon(${points.map((point) => `${point.x * 100}% ${point.y * 100}%`).join(', ')})`;
}

export function pointInPolygon(point: TwinDraftPoint, polygon: readonly TwinDraftPoint[]) {
  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
    const a = polygon[current];
    const b = polygon[previous];
    const crosses = (a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || Number.EPSILON) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function sameTwinDrafting(left: TwinDraftingMetadata, right: TwinDraftingMetadata) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function blueprintKey(floor: number) {
  return `floor-${Math.max(1, Math.round(floor))}`;
}

export function pruneTwinDrafting(metadata: TwinDraftingMetadata, roomIds: readonly string[]): TwinDraftingMetadata {
  const allowed = new Set(roomIds);
  return {
    ...metadata,
    rooms: Object.fromEntries(Object.entries(metadata.rooms).filter(([roomId]) => allowed.has(roomId))),
  };
}

/** Backend document is authoritative. Legacy browser values are never read here. */
export function draftingFromArchitecture(architecture?: import('../../types/twinLayout').TwinArchitecture): TwinDraftingMetadata {
  return { ...createTwinDraftingMetadata(), rooms: architecture?.rooms ?? {}, nodeRotations: architecture?.nodeRotations ?? {}, floors: architecture?.floors ?? {} };
}

/** Excludes browser settings, reference images and all runtime/viewport fields. */
export function architectureFromDrafting(metadata: TwinDraftingMetadata, geometry: import('../../types/twinLayout').TwinLayoutGeometry): import('../../types/twinLayout').TwinArchitecture {
  const roomIds = new Set(geometry.rooms.map((r) => r.roomId)), nodes = new Set(geometry.nodes.map((n) => `${n.nodeType}:${n.nodeId}`)), floors = new Set(geometry.rooms.map((r) => String(r.floor ?? 1)));
  return { version: 1, rooms: Object.fromEntries(Object.entries(metadata.rooms).filter(([id]) => roomIds.has(id)).map(([id, r]) => [id, {
    shape: r.shape, points: r.points.map(({ x, y }) => ({ x, y })),
    ...(r.widthMeters != null ? { widthMeters: r.widthMeters } : {}), ...(r.depthMeters != null ? { depthMeters: r.depthMeters } : {}),
    ...(r.floorHeightMeters != null ? { floorHeightMeters: r.floorHeightMeters } : {}), ...(r.wallThicknessMeters != null ? { wallThicknessMeters: r.wallThicknessMeters } : {}),
    ...(r.autoFurniture != null ? { autoFurniture: r.autoFurniture } : {}),
    ...(r.objects ? { objects: r.objects.map(({id,kind,x,z,width,depth,height,rotation,model,sill}) => ({id,kind,x,z,width,depth,height,rotation,...(model ? { model } : {}), ...(sill != null ? { sill } : {})})) } : {}),
  }])), nodeRotations: Object.fromEntries(Object.entries(metadata.nodeRotations ?? {}).filter(([id]) => nodes.has(id))), floors: Object.fromEntries(Object.entries(metadata.floors ?? {}).filter(([id]) => floors.has(id))) };
}
