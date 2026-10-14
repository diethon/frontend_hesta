import { apiClient } from './apiClient';
import type {
  DeviceCommandResult,
  DeviceResponse,
  DeviceStateHistoryResponse,
  DeviceUpdateRequest,
  ManualCommandResponse,
  ManualOverrideRecord,
  DeviceUptimeResponse,
  DeviceHealthResponse,
} from '../types/device';

export interface DevicePublicPreviewResponse {
  deviceId: string;
  name: string;
  deviceType: string;
  model?: string;
  serialNumber?: string;
  status: string;
}

export interface DeviceClaimRequest {
  token: string;
  homeId: string;
  roomId: string;
  name?: string;
  nodeCode?: string;
}

export const resolveQrToken = async (token: string): Promise<DevicePublicPreviewResponse> => {
  const prefix = 'syna://device/register?token=';
  const cleanToken = token.startsWith(prefix) ? token.slice(prefix.length) : token.trim();
  const response = await apiClient.get(`/devices/qr/${cleanToken}`);
  return response.data.result;
};

export const claimDevice = async (deviceId: string, request: DeviceClaimRequest): Promise<DeviceResponse> => {
  const response = await apiClient.post(`/devices/${deviceId}/claim`, request);
  return response.data.result;
};



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

export const resumeDeviceAutomation = async (deviceId: string): Promise<void> => {
  await apiClient.post(`/devices/${deviceId}/automation/resume`);
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

export const exportDeviceHistoryCsv = async (deviceId: string, filename?: string): Promise<void> => {
  const response = await apiClient.get(`/devices/${deviceId}/history/export`, {
    responseType: 'blob',
  });
  const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename || `device_audit_${deviceId}.csv`);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const exportHomeDeviceHistoryCsv = async (homeId: string, filename?: string): Promise<void> => {
  const response = await apiClient.get(`/homes/${homeId}/devices/history/export`, {
    responseType: 'blob',
  });
  const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename || `home_audit_${homeId}.csv`);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const getDeviceUptime = async (deviceId: string, days = 7): Promise<DeviceUptimeResponse> => {
  const response = await apiClient.get(`/devices/${deviceId}/analytics/uptime`, {
    params: { days },
  });
  return response.data.result;
};

export const getDeviceHealth = async (deviceId: string): Promise<DeviceHealthResponse> => {
  const response = await apiClient.get(`/devices/${deviceId}/health`);
  return response.data.result;
};

export const exportDeviceHistoryExcel = async (deviceId: string, filename?: string): Promise<void> => {
  const response = await apiClient.get(`/devices/${deviceId}/history/export/excel`, {
    responseType: 'blob',
  });
  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename || `device_history_${deviceId}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const extendDeviceAutomation = async (deviceId: string, hours = 1): Promise<void> => {
  await apiClient.post(`/devices/${deviceId}/automation/extend`, { hours });
};
