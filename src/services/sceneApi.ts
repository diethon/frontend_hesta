import type { DeviceSummary, Scene, SceneInput, SceneUpdateInput } from '../types/automation';
import { featureRequest } from './featureApi';

export const getDevices = (homeId: string) =>
  featureRequest<DeviceSummary[]>(`/homes/${homeId}/devices`);

export const getScenes = (homeId: string) =>
  featureRequest<Scene[]>(`/homes/${homeId}/scenes`);

export const getScene = (homeId: string, sceneId: string) =>
  featureRequest<Scene>(`/homes/${homeId}/scenes/${sceneId}`);

export const createScene = (homeId: string, input: SceneInput) =>
  featureRequest<Scene>(`/homes/${homeId}/scenes`, { method: 'POST', body: JSON.stringify(input) });

export const updateScene = (homeId: string, sceneId: string, input: SceneUpdateInput) =>
  featureRequest<Scene>(`/homes/${homeId}/scenes/${sceneId}`, { method: 'PUT', body: JSON.stringify(input) });

export const deleteScene = (homeId: string, sceneId: string) =>
  featureRequest<void>(`/homes/${homeId}/scenes/${sceneId}`, { method: 'DELETE' });
