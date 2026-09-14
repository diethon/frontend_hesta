import { apiRequest } from './apiClient';
import type { DeviceResponse } from '../types/scene';

export const listHomeDevices = (homeId: string) =>
  apiRequest<DeviceResponse[]>(`/homes/${homeId}/devices`);
