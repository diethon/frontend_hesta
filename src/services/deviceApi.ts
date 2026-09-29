import { apiClient } from './apiClient';
import type {
  DeviceCommandResult,
  DeviceResponse,
  DeviceStateHistoryResponse,
  DeviceUpdateRequest,
  ManualCommandResponse,
  ManualOverrideRecord,
} from '../types/device';

export const getDevicesByHome = async (homeId: string): Promise<DeviceResponse[]> => {
  const response = await apiClient.get(`/homes/${homeId}/devices`);
  return response.data.result;
};

export const getDevicesByRoom = async (roomId: string): Promise<DeviceResponse[]> => {
  const response = await apiClient.get(`/rooms/${roomId}/devices`);
  return response.data.result;
};

export const getDeviceDetail = async (deviceId: string): Promise<DeviceResponse> => {
  const response = await apiClient.get(`/devices/${deviceId}`);
  return response.data.result;
};

export const updateDeviceConfig = async (deviceId: string, request: DeviceUpdateRequest): Promise<DeviceResponse> => {
  const response = await apiClient.put(`/devices/${deviceId}`, request);
  return response.data.result;
};

export const removeDevice = async (deviceId: string): Promise<void> => {
  await apiClient.delete(`/devices/${deviceId}`);
};

export const getDeviceHistory = async (deviceId: string): Promise<DeviceStateHistoryResponse[]> => {
  const response = await apiClient.get(`/devices/${deviceId}/history`);
  return response.data.result;
};

export const sendDeviceCommand = async (
  deviceId: string,
  action: string,
  parameters?: Record<string, unknown>,
): Promise<DeviceCommandResult> => {
  const response = await apiClient.post(`/devices/${deviceId}/command`, {
    action,
    parameters: parameters || {}
  });
  return response.data.result;
};

export const sendRoomCommand = async (
  roomId: string,
  action: string,
  parameters?: Record<string, unknown>,
): Promise<DeviceCommandResult[]> => {
  const response = await apiClient.post(`/rooms/${roomId}/command`, {
    action,
    parameters: parameters || {}
  });
  return response.data.result;
};

export const sendManualPowerCommand = async (deviceId: string, action: 'TURN_ON' | 'TURN_OFF'): Promise<ManualCommandResponse> => {
  const response = await apiClient.post(`/devices/${deviceId}/commands`, { action });
  return response.data.result;
};

export const cancelDeviceAutomation = async (deviceId: string): Promise<string> => {
  const response = await apiClient.post(`/devices/${deviceId}/automation/cancel`);
  return response.data.result;
};

export const getDeviceOverrideHistory = async (deviceId: string): Promise<ManualOverrideRecord[]> => {
  const response = await apiClient.get(`/devices/${deviceId}/automation/overrides`);
  return response.data.result;
};
