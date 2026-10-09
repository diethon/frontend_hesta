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

// ===== Air Conditioner API =====
export const setAcPower = async (deviceId: string, power: boolean): Promise<DeviceCommandResult> => {
  const response = await apiClient.post(`/devices/${deviceId}/air-conditioner/power?power=${power}`);
  return response.data.result;
};

export const setAcTemperature = async (deviceId: string, temperature: number): Promise<DeviceCommandResult> => {
  const response = await apiClient.post(`/devices/${deviceId}/air-conditioner/temperature?temperature=${temperature}`);
  return response.data.result;
};

export const adjustAcTempUp = async (deviceId: string): Promise<DeviceCommandResult> => {
  const response = await apiClient.post(`/devices/${deviceId}/air-conditioner/temperature-plus`);
  return response.data.result;
};

export const adjustAcTempDown = async (deviceId: string): Promise<DeviceCommandResult> => {
  const response = await apiClient.post(`/devices/${deviceId}/air-conditioner/temperature-minus`);
  return response.data.result;
};

export const setAcFan = async (deviceId: string, fan: string): Promise<DeviceCommandResult> => {
  const response = await apiClient.post(`/devices/${deviceId}/air-conditioner/fan?fan=${fan}`);
  return response.data.result;
};

export const setAcMode = async (deviceId: string, mode: string): Promise<DeviceCommandResult> => {
  const response = await apiClient.post(`/devices/${deviceId}/air-conditioner/mode?mode=${mode}`);
  return response.data.result;
};

export const setAcSwing = async (deviceId: string, enabled: boolean): Promise<DeviceCommandResult> => {
  const response = await apiClient.post(`/devices/${deviceId}/air-conditioner/swing?enabled=${enabled}`);
  return response.data.result;
};

export const getAcState = async (deviceId: string): Promise<DeviceCommandResult> => {
  const response = await apiClient.get(`/devices/${deviceId}/air-conditioner/state`);
  return response.data.result;
};

// ===== Gate API =====
export const openGate = async (deviceId: string, nodeId?: string): Promise<DeviceCommandResult> => {
  const params = nodeId ? `?nodeId=${nodeId}` : '';
  const response = await apiClient.post(`/devices/${deviceId}/gate/open${params}`);
  return response.data.result;
};

export const closeGate = async (deviceId: string, nodeId?: string): Promise<DeviceCommandResult> => {
  const params = nodeId ? `?nodeId=${nodeId}` : '';
  const response = await apiClient.post(`/devices/${deviceId}/gate/close${params}`);
  return response.data.result;
};

export const stopGate = async (deviceId: string, nodeId?: string): Promise<DeviceCommandResult> => {
  const params = nodeId ? `?nodeId=${nodeId}` : '';
  const response = await apiClient.post(`/devices/${deviceId}/gate/stop${params}`);
  return response.data.result;
};

export const getGateState = async (deviceId: string): Promise<{ deviceId: string; state: string; currentState: Record<string, unknown> }> => {
  const response = await apiClient.get(`/devices/${deviceId}/gate/state`);
  return response.data.result;
};
