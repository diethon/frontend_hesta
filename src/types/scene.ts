import type { DeviceAction } from './deviceVocabulary';

export type SceneActionType = DeviceAction;

export interface SceneActionRequest {
  targetDeviceId: string;
  action: SceneActionType;
  value: unknown | null;
  order: number;
}

export interface CreateSceneRequest {
  name: string;
  description?: string | null;
  enabled: boolean;
  actions: SceneActionRequest[];
}

export interface UpdateSceneRequest {
  name: string;
  description?: string | null;
  enabled: boolean;
  actions?: SceneActionRequest[];
}

export interface SceneActionResponse {
  id: string;
  targetDeviceId: string;
  targetDeviceName: string;
  action: SceneActionType;
  value: unknown | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface SceneResponse {
  id: string;
  homeId: string;
  name: string;
  description: string | null;
  enabled: boolean;
  actions: SceneActionResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface DeviceResponse {
  id: string;
  homeId: string;
  name: string;
  deviceType: string;
  status: 'ONLINE' | 'OFFLINE' | 'ERROR' | 'UNKNOWN';
}
