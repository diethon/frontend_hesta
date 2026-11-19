import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getDeviceEnergy,
  getDeviceUptime,
  getDeviceHistory,
  getDeviceHealth,
  deviceUptimeKey,
  deviceHistoryKey,
  deviceHealthKey,
} from '../../../services/deviceApi';
import { deviceEnergyKey } from '../../../services/energyApi';
import { peekCache } from '../../../services/queryCache';
import type { DeviceEnergyBreakdown } from '../../../types/energy';
import type {
  DeviceUptimeResponse,
  DeviceHealthResponse,
  DeviceStateHistoryResponse,
} from '../../../types/device';

export interface DeviceInsights {
  energyData: DeviceEnergyBreakdown | null;
  uptimeData: DeviceUptimeResponse | null;
  historyData: DeviceStateHistoryResponse[];
  healthData: DeviceHealthResponse | null;
  isLoading: boolean;
  refreshEnergy: () => Promise<void>;
  refreshAll: () => Promise<void>;
  setEnergyData: React.Dispatch<React.SetStateAction<DeviceEnergyBreakdown | null>>;
}

/**
 * Hook to fetch device insights (energy, uptime, history, health) once per device
 * with Promise.allSettled and unmount/device-change cancellation.
 * Uses peekCache for instant 0ms tab switching.
 */
export function useDeviceInsights(deviceId?: string): DeviceInsights {
  const [energyData, setEnergyData] = useState<DeviceEnergyBreakdown | null>(() =>
    deviceId ? peekCache<DeviceEnergyBreakdown>(deviceEnergyKey(deviceId, '30D')) ?? null : null
  );
  const [uptimeData, setUptimeData] = useState<DeviceUptimeResponse | null>(() =>
    deviceId ? peekCache<DeviceUptimeResponse>(deviceUptimeKey(deviceId, 7)) ?? null : null
  );
  const [historyData, setHistoryData] = useState<DeviceStateHistoryResponse[]>(() =>
    deviceId ? peekCache<DeviceStateHistoryResponse[]>(deviceHistoryKey(deviceId)) ?? [] : []
  );
  const [healthData, setHealthData] = useState<DeviceHealthResponse | null>(() =>
    deviceId ? peekCache<DeviceHealthResponse>(deviceHealthKey(deviceId)) ?? null : null
  );
  const [isLoading, setIsLoading] = useState(false);

  // React pattern: adjusting state when prop changes during render with cache fast-path
  const [prevId, setPrevId] = useState(deviceId);
  if (deviceId !== prevId) {
    setPrevId(deviceId);
    setEnergyData(deviceId ? peekCache<DeviceEnergyBreakdown>(deviceEnergyKey(deviceId, '30D')) ?? null : null);
    setUptimeData(deviceId ? peekCache<DeviceUptimeResponse>(deviceUptimeKey(deviceId, 7)) ?? null : null);
    setHistoryData(deviceId ? peekCache<DeviceStateHistoryResponse[]>(deviceHistoryKey(deviceId)) ?? [] : []);
    setHealthData(deviceId ? peekCache<DeviceHealthResponse>(deviceHealthKey(deviceId)) ?? null : null);
  }

  const activeIdRef = useRef<string | undefined>(deviceId);
  useEffect(() => {
    activeIdRef.current = deviceId;
  }, [deviceId]);

  const refreshEnergy = useCallback(async () => {
    if (!deviceId) return;
    try {
      const res = await getDeviceEnergy(deviceId);
      if (activeIdRef.current === deviceId) {
        setEnergyData(res);
      }
    } catch (err) {
      console.warn('Failed to refresh device energy:', err);
    }
  }, [deviceId]);

  const refreshAll = useCallback(async () => {
    if (!deviceId) return;
    setIsLoading(true);

    try {
      const [energyRes, uptimeRes, historyRes, healthRes] = await Promise.allSettled([
        getDeviceEnergy(deviceId),
        getDeviceUptime(deviceId),
        getDeviceHistory(deviceId),
        getDeviceHealth(deviceId),
      ]);

      if (activeIdRef.current !== deviceId) return;

      if (energyRes.status === 'fulfilled' && energyRes.value) {
        setEnergyData(energyRes.value);
      }
      if (uptimeRes.status === 'fulfilled' && uptimeRes.value) {
        setUptimeData(uptimeRes.value);
      }
      if (historyRes.status === 'fulfilled' && historyRes.value) {
        setHistoryData(historyRes.value);
      }
      if (healthRes.status === 'fulfilled' && healthRes.value) {
        setHealthData(healthRes.value);
      }
    } finally {
      if (activeIdRef.current === deviceId) {
        setIsLoading(false);
      }
    }
  }, [deviceId]);

  useEffect(() => {
    if (!deviceId) return;

    let isCancelled = false;

    // Fast-path: populate immediately from peekCache if available
    const cachedEnergy = peekCache<DeviceEnergyBreakdown>(deviceEnergyKey(deviceId, '30D'));
    if (cachedEnergy) setEnergyData(cachedEnergy);

    const cachedUptime = peekCache<DeviceUptimeResponse>(deviceUptimeKey(deviceId, 7));
    if (cachedUptime) setUptimeData(cachedUptime);

    const cachedHistory = peekCache<DeviceStateHistoryResponse[]>(deviceHistoryKey(deviceId));
    if (cachedHistory) setHistoryData(cachedHistory);

    const cachedHealth = peekCache<DeviceHealthResponse>(deviceHealthKey(deviceId));
    if (cachedHealth) setHealthData(cachedHealth);

    Promise.allSettled([
      getDeviceEnergy(deviceId),
      getDeviceUptime(deviceId),
      getDeviceHistory(deviceId),
      getDeviceHealth(deviceId),
    ]).then(([energyRes, uptimeRes, historyRes, healthRes]) => {
      if (isCancelled) return;
      if (energyRes.status === 'fulfilled' && energyRes.value) {
        setEnergyData(energyRes.value);
      }
      if (uptimeRes.status === 'fulfilled' && uptimeRes.value) {
        setUptimeData(uptimeRes.value);
      }
      if (historyRes.status === 'fulfilled' && historyRes.value) {
        setHistoryData(historyRes.value);
      }
      if (healthRes.status === 'fulfilled' && healthRes.value) {
        setHealthData(healthRes.value);
      }
      setIsLoading(false);

      // Silently prefetch 7D energy so toggling '7 ngày' in EnergyTab is instant (0ms)
      setTimeout(() => {
        if (!isCancelled && deviceId) {
          getDeviceEnergy(deviceId, '7D').catch(() => null);
        }
      }, 150);
    });

    return () => {
      isCancelled = true;
    };
  }, [deviceId]);

  return {
    energyData,
    uptimeData,
    historyData,
    healthData,
    isLoading,
    refreshEnergy,
    refreshAll,
    setEnergyData,
  };
}
