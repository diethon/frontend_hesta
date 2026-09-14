import { apiClient } from './apiClient';
import type {
  CreateSceneRequest,
  SceneActionRequest,
  SceneActionResponse,
  SceneResponse,
  UpdateSceneRequest,
} from '../types/scene';

const scenePath = (homeId: string) => `/homes/${homeId}/scenes`;

export const listScenes = async (homeId: string): Promise<SceneResponse[]> => {
  const response = await apiClient.get(scenePath(homeId));
  return response.data.result;
};

export const getScene = async (homeId: string, sceneId: string): Promise<SceneResponse> => {
  const response = await apiClient.get(`${scenePath(homeId)}/${sceneId}`);
  return response.data.result;
};

export const createScene = async (homeId: string, request: CreateSceneRequest): Promise<SceneResponse> => {
  const response = await apiClient.post(scenePath(homeId), request);
  return response.data.result;
};

export const updateScene = async (
  homeId: string,
  sceneId: string,
  request: UpdateSceneRequest,
): Promise<SceneResponse> => {
  const response = await apiClient.put(`${scenePath(homeId)}/${sceneId}`, request);
  return response.data.result;
};

export const deleteScene = async (homeId: string, sceneId: string): Promise<void> => {
  await apiClient.delete(`${scenePath(homeId)}/${sceneId}`);
};

export const addSceneAction = async (
  homeId: string,
  sceneId: string,
  request: SceneActionRequest,
): Promise<SceneActionResponse> => {
  const response = await apiClient.post(`${scenePath(homeId)}/${sceneId}/actions`, request);
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
  const response = await apiClient.put(`${scenePath(homeId)}/${sceneId}/actions/reorder`, { actionIds });
  return response.data.result;
};
