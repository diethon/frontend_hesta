export interface DeviceState {
  [key: string]: unknown;
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
  gpioPin?: number;
  status: 'ONLINE' | 'OFFLINE' | 'ERROR' | 'UNKNOWN';
  currentState: DeviceState;
  capabilities?: Record<string, string[]>;
  icon?: string;
  digitalTwinX?: number;
  digitalTwinY?: number;
  digitalTwinZ?: number;
  manualOverrideUntil?: string | null;
  manualOverrideActive?: boolean;
  lastSeen?: string;
}

export interface DeviceUpdateRequest {
  name?: string;
  roomId?: string;
  icon?: string;
  digitalTwinX?: number;
  digitalTwinY?: number;
  digitalTwinZ?: number;
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
  command: { success: boolean; status: string; message?: string; acknowledgedState?: DeviceState };
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
