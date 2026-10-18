import type { DeviceCapabilityInfo, DeviceSummary, HomeCapabilitiesResponse } from "../types/automation";
import { featureRequest } from "./featureApi";

import { apiClient } from "./apiClient";
import type {
  CreateSceneRequest,
  SceneActionRequest,
  SceneActionType,
  SceneActionResponse,
  SceneResponse,
  SceneExecutionResponse,
  UpdateSceneRequest,
} from "../types/scene";

// In-memory cache for scenes & deduplication map
const scenesCache = new Map<string, { data: SceneResponse[]; timestamp: number }>();
const devicesCache = new Map<string, { data: DeviceSummary[]; timestamp: number }>();
const actionTypesCache = new Map<string, { data: SceneActionType[]; timestamp: number }>();
const inFlightRequests = new Map<string, Promise<any>>();
const CACHE_TTL_MS = 120_000; // 2 minutes

export const getCachedScenes = (homeId: string): SceneResponse[] | null => {
  const cached = scenesCache.get(homeId);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    scenesCache.delete(homeId);
    return null;
  }
  return cached.data;
};

export const setCachedScenes = (homeId: string, data: SceneResponse[]) => {
  if (Array.isArray(data)) {
    scenesCache.set(homeId, { data, timestamp: Date.now() });
  }
};

export const getCachedDevices = (homeId: string): DeviceSummary[] | null => {
  const cached = devicesCache.get(homeId);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    devicesCache.delete(homeId);
    return null;
  }
  return cached.data;
};

export const invalidateScenesCache = (homeId: string) => {
  scenesCache.delete(homeId);
  devicesCache.delete(homeId);
  actionTypesCache.delete(homeId);
};

export const getDevices = (homeId: string): Promise<DeviceSummary[]> => {
  const cached = getCachedDevices(homeId);
  if (cached) return Promise.resolve(cached);

  const key = `devices_${homeId}`;
  if (inFlightRequests.has(key)) return inFlightRequests.get(key)!;
  const promise = featureRequest<DeviceSummary[]>(`/homes/${homeId}/devices`)
    .then((data) => {
      devicesCache.set(homeId, { data, timestamp: Date.now() });
      return data;
    })
    .finally(() => {
      inFlightRequests.delete(key);
    });
  inFlightRequests.set(key, promise);
  return promise;
};

export const getHomeDeviceCapabilities = (homeId: string): Promise<HomeCapabilitiesResponse> => {
  const key = `caps_${homeId}`;
  if (inFlightRequests.has(key)) return inFlightRequests.get(key)!;
  const promise = featureRequest<HomeCapabilitiesResponse>(`/homes/${homeId}/device-capabilities`).finally(() => {
    inFlightRequests.delete(key);
  });
  inFlightRequests.set(key, promise);
  return promise;
};

export const getDeviceCapabilities = (deviceId: string) =>
  featureRequest<DeviceCapabilityInfo>(`/devices/${deviceId}/capabilities`);

const scenePath = (homeId: string) => `/homes/${homeId}/scenes`;

export const listScenes = async (homeId: string): Promise<SceneResponse[]> => {
  const response = await apiClient.get(scenePath(homeId));
  const data = response.data.result;
  setCachedScenes(homeId, data);
  return data;
};

export const getScenes = (homeId: string): Promise<SceneResponse[]> => {
  const cached = getCachedScenes(homeId);
  if (cached) return Promise.resolve(cached);

  const key = `scenes_${homeId}`;
  if (inFlightRequests.has(key)) return inFlightRequests.get(key)!;

  const promise = listScenes(homeId).finally(() => {
    inFlightRequests.delete(key);
  });

  inFlightRequests.set(key, promise);
  return promise;
};

export const getSceneActionTypes = async (homeId: string): Promise<SceneActionType[]> => {
  const cached = actionTypesCache.get(homeId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const key = `actionTypes_${homeId}`;
  if (inFlightRequests.has(key)) return inFlightRequests.get(key)!;

  const promise = apiClient
    .get(`${scenePath(homeId)}/action-types`)
    .then((response) => {
      const data = response.data.result;
      actionTypesCache.set(homeId, { data, timestamp: Date.now() });
      return data;
    })
    .finally(() => {
      inFlightRequests.delete(key);
    });

  inFlightRequests.set(key, promise);
  return promise;
};

export const getScene = async (
  homeId: string,
  sceneId: string,
): Promise<SceneResponse> => {
  const response = await apiClient.get(`${scenePath(homeId)}/${sceneId}`);
  const scene: SceneResponse = response.data.result;
  const cachedList = getCachedScenes(homeId);
  if (cachedList && Array.isArray(cachedList)) {
    setCachedScenes(homeId, cachedList.map((s) => (s.id === scene.id ? scene : s)));
  }
  return scene;
};

export const executeScene = (homeId: string, sceneId: string) =>
  featureRequest<SceneExecutionResponse>(`${scenePath(homeId)}/${sceneId}/execute`, { method: 'POST' });

export const getSceneExecutions = (homeId: string, sceneId: string) =>
  featureRequest<SceneExecutionResponse[]>(`${scenePath(homeId)}/${sceneId}/executions`);

export const createScene = async (
  homeId: string,
  request: CreateSceneRequest,
): Promise<SceneResponse> => {
  const response = await apiClient.post(scenePath(homeId), request);
  const newScene: SceneResponse = response.data.result;
  const current = getCachedScenes(homeId);
  if (Array.isArray(current)) {
    setCachedScenes(homeId, [...current, newScene].sort((a, b) => a.name.localeCompare(b.name)));
  }
  return newScene;
};

export const updateScene = async (
  homeId: string,
  sceneId: string,
  request: UpdateSceneRequest,
): Promise<SceneResponse> => {
  const response = await apiClient.put(
    `${scenePath(homeId)}/${sceneId}`,
    request,
  );
  const updatedScene: SceneResponse = response.data.result;
  const current = getCachedScenes(homeId);
  if (Array.isArray(current)) {
    setCachedScenes(homeId, current.map((s) => (s.id === updatedScene.id ? updatedScene : s)));
  }
  return updatedScene;
};

export const deleteScene = async (
  homeId: string,
  sceneId: string,
): Promise<void> => {
  await apiClient.delete(`${scenePath(homeId)}/${sceneId}`);
  const current = getCachedScenes(homeId);
  if (Array.isArray(current)) {
    setCachedScenes(homeId, current.filter((s) => s.id !== sceneId));
  }
};

export const addSceneAction = async (
  homeId: string,
  sceneId: string,
  request: SceneActionRequest,
): Promise<SceneActionResponse> => {
  const response = await apiClient.post(
    `${scenePath(homeId)}/${sceneId}/actions`,
    request,
  );
  invalidateScenesCache(homeId);
  return response.data.result;
};

export const removeSceneAction = async (
  homeId: string,
  sceneId: string,
  actionId: string,
): Promise<void> => {
  await apiClient.delete(`${scenePath(homeId)}/${sceneId}/actions/${actionId}`);
  invalidateScenesCache(homeId);
};

export const reorderSceneActions = async (
  homeId: string,
  sceneId: string,
  actionIds: string[],
): Promise<SceneResponse> => {
  const response = await apiClient.put(
    `${scenePath(homeId)}/${sceneId}/actions/reorder`,
    { actionIds },
  );
  invalidateScenesCache(homeId);
  return response.data.result;
};
