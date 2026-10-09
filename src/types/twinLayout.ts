export interface TwinRoomLayout {
  roomId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Storey persisted by the Twin Layout API. One-based. */
  floor?: number;
}

export interface TwinNodeLayout {
  nodeType: 'DEVICE' | 'SENSOR';
  nodeId: string;
  roomId: string | null;
  x: number;
  y: number;
}

export interface TwinLayoutGeometry {
  rooms: TwinRoomLayout[];
  nodes: TwinNodeLayout[];
  architecture?: TwinArchitecture;
}

export type GeometrySource = 'PERSISTED' | 'INFERRED' | 'DEFAULT';
export interface TwinArchitecture {
  version: 1;
  rooms: Record<string, import('../components/twin/twinDrafting').TwinRoomDrafting>;
  nodeRotations?: Record<string, number>;
  floors?: Record<string, { elevation: number; height: number; slabThickness: number }>;
}

export interface TwinLayout extends TwinLayoutGeometry {
  homeId: string;
  revision: number;
}

export interface TwinLayoutSaveRequest extends TwinLayoutGeometry {
  expectedRevision: number;
}

export type TwinLayoutSelection = { kind: 'room'; id: string } | { kind: 'node'; id: string };
