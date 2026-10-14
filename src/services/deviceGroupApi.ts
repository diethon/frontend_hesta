import { apiClient } from './apiClient';
import type {
  DeviceGroupResponse,
  DeviceGroupRequest,
  GroupCommandResponse
} from '../types/deviceGroup';

export const getHomeDeviceGroups = async (homeId: string): Promise<DeviceGroupResponse[]> => {
  const response = await apiClient.get(`/homes/${homeId}/device-groups`);
  return response.data.result;
};

export const createDeviceGroup = async (
  homeId: string,
  request: DeviceGroupRequest
): Promise<DeviceGroupResponse> => {
  const response = await apiClient.post(`/homes/${homeId}/device-groups`, request);
  return response.data.result;
};

export const updateDeviceGroup = async (
  groupId: string,
  request: DeviceGroupRequest
): Promise<DeviceGroupResponse> => {
  const response = await apiClient.put(`/device-groups/${groupId}`, request);
  return response.data.result;
};

export const deleteDeviceGroup = async (groupId: string): Promise<void> => {
  await apiClient.delete(`/device-groups/${groupId}`);
};

export const sendGroupCommand = async (
  groupId: string,
  action: string,
  parameters?: Record<string, unknown>
): Promise<GroupCommandResponse> => {
  const response = await apiClient.post(`/device-groups/${groupId}/command`, {
    action,
    parameters: parameters || {},
  });
  return response.data.result;
};
