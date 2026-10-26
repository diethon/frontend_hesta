import { apiClient } from './apiClient';
import type { DiagnosticsSummary, NodeDiagnostics, MqttPacket, MqttDeadLetter, FirmwarePackage, OtaCampaign } from '../types/diagnostics';

export const getDiagnosticsSummary = async (): Promise<DiagnosticsSummary> => {
  const response = await apiClient.get('/admin/diagnostics/summary');
  return response.data.result;
};

export const getNodeDiagnostics = async (): Promise<NodeDiagnostics[]> => {
  const response = await apiClient.get('/admin/diagnostics/nodes');
  return response.data.result;
};

export const resetNodeCircuitBreaker = async (nodeId: string): Promise<NodeDiagnostics> => {
  const response = await apiClient.post(`/admin/diagnostics/nodes/${nodeId}/circuit-breaker/reset`);
  return response.data.result;
};

export const tripNodeCircuitBreaker = async (nodeId: string): Promise<NodeDiagnostics> => {
  const response = await apiClient.post(`/admin/diagnostics/nodes/${nodeId}/circuit-breaker/trip`);
  return response.data.result;
};

export const pingNode = async (nodeId: string): Promise<NodeDiagnostics> => {
  const response = await apiClient.post(`/admin/diagnostics/nodes/${nodeId}/ping`);
  return response.data.result;
};

export const getMqttPackets = async (): Promise<MqttPacket[]> => {
  const response = await apiClient.get('/admin/diagnostics/mqtt-sniffer');
  return response.data.result;
};

// DLQ (Dead-Letter Queue) Endpoints
export const getDeadLetters = async (limit = 50, unhandledOnly = false): Promise<MqttDeadLetter[]> => {
  const response = await apiClient.get('/admin/diagnostics/dlq', {
    params: { limit, unhandledOnly },
  });
  return response.data.result || [];
};

export const replayDeadLetter = async (id: string): Promise<MqttDeadLetter> => {
  const response = await apiClient.post(`/admin/diagnostics/dlq/${id}/replay`);
  return response.data.result;
};

export const replayAllDeadLetters = async (): Promise<number> => {
  const response = await apiClient.post('/admin/diagnostics/dlq/replay-all');
  return response.data.result || 0;
};

export const clearDeadLetters = async (): Promise<void> => {
  await apiClient.delete('/admin/diagnostics/dlq');
};

// OTA Firmware Endpoints
export const getOtaPackages = async (): Promise<FirmwarePackage[]> => {
  const response = await apiClient.get('/admin/ota/packages');
  return response.data.result || [];
};

export const registerOtaPackage = async (data: Partial<FirmwarePackage>): Promise<FirmwarePackage> => {
  const response = await apiClient.post('/admin/ota/packages', data);
  return response.data.result;
};

export const getOtaCampaigns = async (): Promise<OtaCampaign[]> => {
  const response = await apiClient.get('/admin/ota/campaigns');
  return response.data.result || [];
};

export const createOtaCampaign = async (data: {
  name: string;
  firmwarePackageId: string;
  failureThresholdPercent?: number;
  rolloutStrategy?: string;
}): Promise<OtaCampaign> => {
  const response = await apiClient.post('/admin/ota/campaigns', data);
  return response.data.result;
};

export const abortOtaCampaign = async (campaignId: string, reason?: string): Promise<OtaCampaign> => {
  const response = await apiClient.post(`/admin/ota/campaigns/${campaignId}/abort`, null, {
    params: { reason },
  });
  return response.data.result;
};
