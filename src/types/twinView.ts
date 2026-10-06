import type { JsonValue, TwinDeviceSnapshotResponse } from './twin';
import type { Twin3DNodeGeometry, Twin3DShapedRoomGeometry } from '../components/twin/twin3dGeometry';

/** Renderer contracts only; backend domain and persisted layout remain unchanged. */
export interface TwinDeviceView {
  id: string;
  name: string;
  type: string;
  roomId: string | null;
  state: Record<string, JsonValue>;
  powered: boolean;
  online: boolean;
  status: TwinDeviceSnapshotResponse['status'];
}

export interface TwinFloorView {
  id: string;
  name: string;
  level: number;
  rooms: Twin3DShapedRoomGeometry[];
  nodes: Twin3DNodeGeometry[];
}

export interface TwinHouseView {
  id: string;
  floors: TwinFloorView[];
}

export type TwinHeatmapMode = 'normal' | 'temperature' | 'humidity' | 'air-quality' | 'co2';
