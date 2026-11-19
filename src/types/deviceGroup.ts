import type { DeviceResponse, DeviceCommandResult } from './device';

export interface DeviceGroupResponse {
  id: string;
  homeId: string;
  name: string;
  icon?: string;
  deviceCount: number;
  deviceIds: string[];
  devices: DeviceResponse[];
  createdAt: string;
}

export interface DeviceGroupRequest {
  name: string;
  icon?: string;
  deviceIds: string[];
}

export interface GroupCommandRequest {
  action: string;
  parameters?: Record<string, unknown>;
}

export interface GroupCommandResponse {
  groupId: string;
  action: string;
  totalDevices: number;
  successCount: number;
  failureCount: number;
  results: DeviceCommandResult[];
}
