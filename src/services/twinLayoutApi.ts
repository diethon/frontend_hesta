import { apiClient, ApiError } from './apiClient';
import type { TwinLayout, TwinLayoutSaveRequest } from '../types/twinLayout';

interface LayoutResponse { code: number; message?: string; result: TwinLayout }

function unwrap(data: LayoutResponse, homeId: string) {
  if (data.code !== 1000) throw new ApiError(data.message ?? 'Không thể tải sơ đồ.', undefined, data.code);
  if (!data.result || data.result.homeId !== homeId || !Number.isSafeInteger(data.result.revision)
    || data.result.revision < 0 || !Array.isArray(data.result.rooms) || !Array.isArray(data.result.nodes)) {
    throw new Error('Phản hồi sơ đồ không hợp lệ.');
  }
  return data.result;
}

export async function getTwinLayout(homeId: string, signal?: AbortSignal) {
  const { data } = await apiClient.get<LayoutResponse>(`/homes/${encodeURIComponent(homeId)}/twin-layout`, { signal });
  return unwrap(data, homeId);
}

export async function putTwinLayout(homeId: string, request: TwinLayoutSaveRequest, signal?: AbortSignal) {
  const { data } = await apiClient.put<LayoutResponse>(`/homes/${encodeURIComponent(homeId)}/twin-layout`, request, { signal });
  return unwrap(data, homeId);
}
