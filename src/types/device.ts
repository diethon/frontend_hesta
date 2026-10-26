export interface DeviceState {
  [key: string]: unknown;
}

export interface DeviceShadowResponse {
  deviceId: string;
  deviceName: string;
  desiredState: Record<string, unknown>;
  reportedState: Record<string, unknown>;
  deltaState: Record<string, unknown>;
  desiredVersion: number;
  reportedVersion: number;
  desiredUpdatedAt: string;
  reportedUpdatedAt: string;
  inSync: boolean;
}

export interface DeviceCommandResult {
  commandId?: string;
  success: boolean;
  status: string;
  message?: string;
  errorCode?: string;
  acknowledgedState?: DeviceState;
  latencyMs?: number;
}

export interface DeviceResponse {
  id: string;
  homeId: string;
  roomId?: string;
  roomName?: string;
  nodeId?: string;
  nodeName?: string;
  name: string;
  deviceType: string;
  model?: string;
  serialNumber?: string;
  gpioPin?: number;
  status: 'ONLINE' | 'OFFLINE' | 'ERROR' | 'UNKNOWN' | 'UNCLAIMED';

  currentState: DeviceState;
  capabilities?: Record<string, string[]>;
  icon?: string;
  digitalTwinX?: number;
  digitalTwinY?: number;
  digitalTwinZ?: number;
  manualOverrideUntil?: string | null;
  manualOverrideActive?: boolean;
  lastSeen?: string;
  settings?: Record<string, any>;
}

export interface DeviceUpdateRequest {
  name?: string;
  roomId?: string;
  icon?: string;
  digitalTwinX?: number;
  digitalTwinY?: number;
  digitalTwinZ?: number;
  settings?: Record<string, any>;
}

export interface DeviceStateHistoryResponse {
  id: string;
  deviceId: string;
  previousState: DeviceState;
  newState: DeviceState;
  source: string;
  changedById?: string;
  isTest?: boolean;
  changedAt: string;
}

export interface ManualCommandResponse {
  command: { commandId?: string; success: boolean; status: string; errorCode?: string; message?: string; acknowledgedState?: DeviceState; latencyMs?: number };
  overrideUntil: string;
}

export interface ManualOverrideRecord {
  id: string;
  action: 'OVERRIDE' | 'CANCEL' | 'RESUME';
  userId: string;
  occurredAt: string;
  expiresAt: string;
}

export interface DeviceUptimeTimelinePoint {
  hour: number;
  state: 'ON' | 'OFF';
  timestamp?: string;
  durationSeconds?: number;
}

export interface DeviceUptimeResponse {
  uptimePercent: number;
  totalHours: number;
  onHours: number;
  offHours: number;
  timelinePoints: DeviceUptimeTimelinePoint[];
}

export interface DeviceHealthResponse {
  switchCycles: number;
  maxRatedCycles: number;
  healthPercent: number;
  chatteringWarning: boolean;
  safetyTripped: boolean;
  lastCycleAt: string;
}
