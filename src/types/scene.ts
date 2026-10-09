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
  icon?: string | null;
  description?: string | null;
  enabled: boolean;
  actions: SceneActionRequest[];
}

export interface UpdateSceneRequest {
  name: string;
  icon?: string | null;
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
  icon?: string | null;
  description: string | null;
  enabled: boolean;
  actions: SceneActionResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface SceneExecutionResponse {
  id: string;
  sceneId: string;
  triggerSource: 'MANUAL' | 'SCHEDULE' | 'AUTOMATION';
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'SKIPPED';
  startedAt: string;
  completedAt: string;
  resultDetail: Array<{ deviceId: string; action: string; success: boolean; status: string; message?: string }>;
}

export interface DeviceResponse {
  id: string;
  homeId: string;
  name: string;
  deviceType: string;
  status: 'ONLINE' | 'OFFLINE' | 'ERROR' | 'UNKNOWN';
}
