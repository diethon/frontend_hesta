import { apiClient } from './apiClient';
import type {
  EnergyAnalyticsResponse,
  EnergySummary,
  DeviceEnergyBreakdown,
  DemandResponseSettings,
  DemandResponseEvaluationResult,
} from '../types/energy';
import { cachedFetch, setCacheValue } from './queryCache';

// Cache key builders for SWR caching
export const energyAnalyticsKey = (homeId: string, period = '30D'): string =>
  `energy:home:${homeId}:${period}`;

export const deviceEnergyKey = (deviceId: string, period = '30D'): string =>
  `energy:device:${deviceId}:${period}`;

export const drSettingsKey = (homeId: string): string =>
  `dr:settings:${homeId}`;

export const getHomeEnergyAnalytics = async (
  homeId: string,
  period = '30D',
  forceRefresh = false
): Promise<EnergyAnalyticsResponse> => {
  return cachedFetch(
    energyAnalyticsKey(homeId, period),
    async () => {
      const response = await apiClient.get(`/homes/${homeId}/energy?period=${period}`);
      return response.data.result;
    },
    { ttlMs: 45_000, forceRefresh }
  );
};

export const getHomeEnergySummary = async (
  homeId: string,
  period = '30D'
): Promise<EnergySummary> => {
  // Reuses getHomeEnergyAnalytics so it deduplicates in-flight requests and never double-computes
  return getHomeEnergyAnalytics(homeId, period).then((r) => r.summary);
};

export const getDeviceEnergy = async (
  deviceId: string,
  period = '30D',
  forceRefresh = false
): Promise<DeviceEnergyBreakdown> => {
  return cachedFetch(
    deviceEnergyKey(deviceId, period),
    async () => {
      const response = await apiClient.get(`/devices/${deviceId}/energy?period=${period}`);
      return response.data.result;
    },
    { ttlMs: 45_000, forceRefresh }
  );
};

// Demand Response & Peak Shaving Endpoints
export const getDemandResponseSettings = async (homeId: string): Promise<DemandResponseSettings> => {
  return cachedFetch(
    drSettingsKey(homeId),
    async () => {
      const response = await apiClient.get(`/homes/${homeId}/dr/settings`);
      return response.data.result;
    },
    { ttlMs: 60_000 }
  );
};

export const updateDemandResponseSettings = async (
  homeId: string,
  settings: Partial<DemandResponseSettings>
): Promise<DemandResponseSettings> => {
  const response = await apiClient.put(`/homes/${homeId}/dr/settings`, settings);
  const result = response.data.result;
  setCacheValue(drSettingsKey(homeId), result);
  return result;
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
