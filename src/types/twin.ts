import { DEVICE_TYPES, type DeviceType } from './deviceVocabulary';

// Keep existing layouts compatible with devices registered before the IoT refactor.
export type TwinDeviceType = DeviceType | 'FAN' | 'AC' | 'SOCKET' | 'SENSOR' | 'LOCK' | 'CAMERA' | 'MICROPHONE';
export const TWIN_DEVICE_TYPES: readonly TwinDeviceType[] = [
  ...Object.values(DEVICE_TYPES), 'FAN', 'AC', 'SOCKET', 'SENSOR', 'LOCK', 'CAMERA', 'MICROPHONE',
];

export type TwinHealthStatus = 'ACTIVE' | 'STALE' | 'OFFLINE';
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface TwinDeviceSnapshotResponse {
  deviceId: string;
  roomId: string | null;
  name: string;
  deviceType: TwinDeviceType;
  icon: string | null;
  status: 'ONLINE' | 'OFFLINE' | 'ERROR' | 'UNKNOWN';
  currentState: JsonValue;
  lastSeen: string | null;
  healthStatus: TwinHealthStatus;
}

export interface TwinSensorSnapshotResponse {
  sensorId: string;
  roomId: string | null;
  deviceId: string;
  metricType: string;
  latestValue: number | null;
  unit: string | null;
  observedAt: string | null;
  healthStatus: TwinHealthStatus;
}

export interface TwinRoomSnapshotResponse {
  roomId: string;
  homeId: string;
  name: string;
  icon: string | null;
  devices: TwinDeviceSnapshotResponse[];
  sensors: TwinSensorSnapshotResponse[];
}

export interface TwinHomeSnapshotResponse {
  homeId: string;
  name: string;
  rooms: TwinRoomSnapshotResponse[];
  unassignedDevices: TwinDeviceSnapshotResponse[];
  unassignedSensors: TwinSensorSnapshotResponse[];
}

export interface TwinHealthStatusChangedPayload {
  nodeType: 'DEVICE' | 'SENSOR';
  nodeId: string;
  deviceId: string;
  roomId: string | null;
  previousStatus: TwinHealthStatus;
  healthStatus: TwinHealthStatus;
  referenceTime: string | null;
  evaluatedAt: string;
}
