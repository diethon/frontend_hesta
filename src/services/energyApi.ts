import { apiClient } from './apiClient';
import type {
  EnergyAnalyticsResponse,
  EnergySummary,
  DeviceEnergyBreakdown,
  DemandResponseSettings,
  DemandResponseEvaluationResult,
} from '../types/energy';

export const getHomeEnergyAnalytics = async (homeId: string, period = '30D'): Promise<EnergyAnalyticsResponse> => {
  const response = await apiClient.get(`/homes/${homeId}/energy?period=${period}`);
  return response.data.result;
};

export const getHomeEnergySummary = async (homeId: string, period = '30D'): Promise<EnergySummary> => {
  const response = await apiClient.get(`/homes/${homeId}/energy/summary?period=${period}`);
  return response.data.result;
};

export const getDeviceEnergy = async (deviceId: string, period = '30D'): Promise<DeviceEnergyBreakdown> => {
  const response = await apiClient.get(`/devices/${deviceId}/energy?period=${period}`);
  return response.data.result;
};

// Demand Response & Peak Shaving Endpoints
export const getDemandResponseSettings = async (homeId: string): Promise<DemandResponseSettings> => {
  const response = await apiClient.get(`/homes/${homeId}/dr/settings`);
  return response.data.result;
};

export const updateDemandResponseSettings = async (
  homeId: string,
  settings: Partial<DemandResponseSettings>
): Promise<DemandResponseSettings> => {
  const response = await apiClient.put(`/homes/${homeId}/dr/settings`, settings);
  return response.data.result;
};

export const evaluateDemandResponse = async (
  homeId: string,
  simulatedWatts?: number
): Promise<DemandResponseEvaluationResult> => {
  const response = await apiClient.post(`/homes/${homeId}/dr/evaluate`, null, {
    params: simulatedWatts !== undefined ? { simulatedWatts } : {},
  });
  return response.data.result;
};
