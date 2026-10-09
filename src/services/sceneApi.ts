import type { DeviceSummary } from "../types/automation";
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

export const getDevices = (homeId: string) =>
  featureRequest<DeviceSummary[]>(`/homes/${homeId}/devices`);

export const getScenes = (homeId: string) =>
  featureRequest<SceneResponse[]>(`/homes/${homeId}/scenes`);
const scenePath = (homeId: string) => `/homes/${homeId}/scenes`;

export const getSceneActionTypes = async (homeId: string): Promise<SceneActionType[]> => {
  const response = await apiClient.get(`${scenePath(homeId)}/action-types`);
  return response.data.result;
};

export const listScenes = async (homeId: string): Promise<SceneResponse[]> => {
  const response = await apiClient.get(scenePath(homeId));
  return response.data.result;
};

export const getScene = async (
  homeId: string,
  sceneId: string,
): Promise<SceneResponse> => {
  const response = await apiClient.get(`${scenePath(homeId)}/${sceneId}`);
  return response.data.result;
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
  return response.data.result;
};

export const updateScene = async (
  homeId: string,
  sceneId: string,
  request: UpdateSceneRequest,)
  : Promise<SceneResponse> => {
  const response = await apiClient.put(
    `${scenePath(homeId)}/${sceneId}`,
    request,
  );
  return response.data.result;
};

export const deleteScene = async (
  homeId: string,
  sceneId: string,
): Promise<void> => {
  await apiClient.delete(`${scenePath(homeId)}/${sceneId}`);
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
  return response.data.result;
};

export const removeSceneAction = async (
  homeId: string,
  sceneId: string,
  actionId: string,
): Promise<void> => {
  await apiClient.delete(`${scenePath(homeId)}/${sceneId}/actions/${actionId}`);
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
  return response.data.result;
};
