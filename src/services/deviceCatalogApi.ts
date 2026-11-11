import { apiClient } from './apiClient';
import type {
  DeviceCatalog,
  DeviceCatalogRequest,
  DeviceBatchGenerateQrRequest,
  DeviceBatchGenerateQrResponse,
  DeviceAdminStats,
} from '../types/deviceCatalog';

export const getDeviceCatalogs = async (params?: {
  keyword?: string;
  deviceType?: string;
}): Promise<DeviceCatalog[]> => {
  const response = await apiClient.get('/admin/device-catalogs', { params });
  return response.data.result;
};

export const getDeviceAdminStats = async (): Promise<DeviceAdminStats> => {
  const response = await apiClient.get('/admin/device-catalogs/stats');
  return response.data.result;
};

export const getDeviceCatalogById = async (id: string): Promise<DeviceCatalog> => {
  const response = await apiClient.get(`/admin/device-catalogs/${id}`);
  return response.data.result;
};

export const createDeviceCatalog = async (
  payload: DeviceCatalogRequest
): Promise<DeviceCatalog> => {
  const response = await apiClient.post('/admin/device-catalogs', payload);
  return response.data.result;
};

export const updateDeviceCatalog = async (
  id: string,
  payload: DeviceCatalogRequest
): Promise<DeviceCatalog> => {
  const response = await apiClient.put(`/admin/device-catalogs/${id}`, payload);
  return response.data.result;
};

export const deleteDeviceCatalog = async (id: string): Promise<void> => {
  await apiClient.delete(`/admin/device-catalogs/${id}`);
};

export const batchGenerateDeviceQr = async (
  payload: DeviceBatchGenerateQrRequest
): Promise<DeviceBatchGenerateQrResponse> => {
  const response = await apiClient.post('/admin/device-catalogs/batch-generate', payload);
  return response.data.result;
};

export const uploadDeviceCatalogImage = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post('/admin/device-catalogs/upload-image', formData, {
    headers: { 'Content-Type': undefined },
  });
  return response.data.result;
};

