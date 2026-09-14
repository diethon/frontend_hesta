import { apiRequest } from './apiClient';
import type {
  CreateSceneRequest,
  SceneActionRequest,
  SceneActionResponse,
  SceneResponse,
  UpdateSceneRequest,
} from '../types/scene';

const scenePath = (homeId: string) => `/homes/${homeId}/scenes`;

export const listScenes = (homeId: string) =>
  apiRequest<SceneResponse[]>(scenePath(homeId));

export const getScene = (homeId: string, sceneId: string) =>
  apiRequest<SceneResponse>(`${scenePath(homeId)}/${sceneId}`);

export const createScene = (homeId: string, request: CreateSceneRequest) =>
  apiRequest<SceneResponse>(scenePath(homeId), {
    method: 'POST',
    body: JSON.stringify(request),
  });

export const updateScene = (homeId: string, sceneId: string, request: UpdateSceneRequest) =>
  apiRequest<SceneResponse>(`${scenePath(homeId)}/${sceneId}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  });

export const deleteScene = (homeId: string, sceneId: string) =>
  apiRequest<void>(`${scenePath(homeId)}/${sceneId}`, { method: 'DELETE' });

export const addSceneAction = (homeId: string, sceneId: string, request: SceneActionRequest) =>
  apiRequest<SceneActionResponse>(`${scenePath(homeId)}/${sceneId}/actions`, {
    method: 'POST',
    body: JSON.stringify(request),
  });

export const removeSceneAction = (homeId: string, sceneId: string, actionId: string) =>
  apiRequest<void>(`${scenePath(homeId)}/${sceneId}/actions/${actionId}`, { method: 'DELETE' });

export const reorderSceneActions = (homeId: string, sceneId: string, actionIds: string[]) =>
  apiRequest<SceneResponse>(`${scenePath(homeId)}/${sceneId}/actions/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ actionIds }),
  });
