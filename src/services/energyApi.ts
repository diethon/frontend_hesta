import { apiClient } from './apiClient';
import type { EnergyAnalyticsResponse, EnergySummary, DeviceEnergyBreakdown } from '../types/energy';

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
