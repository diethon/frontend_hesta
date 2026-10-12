import { apiClient } from './apiClient';
import type { DiagnosticsSummary, NodeDiagnostics } from '../types/diagnostics';

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

export const pingNode = async (nodeId: string): Promise<NodeDiagnostics> => {
  const response = await apiClient.post(`/admin/diagnostics/nodes/${nodeId}/ping`);
  return response.data.result;
};
