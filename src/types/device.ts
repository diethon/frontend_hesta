export interface DeviceState {
  [key: string]: any;
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
  capabilities?: string[];
  icon?: string;
  digitalTwinX?: number;
  digitalTwinY?: number;
  digitalTwinZ?: number;
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
