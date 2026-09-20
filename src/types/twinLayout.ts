export interface TwinRoomLayout {
  roomId: string;
  x: number;
  y: number;
  width: number;
  height: number;
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
}

export interface TwinLayout extends TwinLayoutGeometry {
  homeId: string;
  revision: number;
}

export interface TwinLayoutSaveRequest extends TwinLayoutGeometry {
  expectedRevision: number;
}
