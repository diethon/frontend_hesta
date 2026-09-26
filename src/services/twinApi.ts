import { apiClient } from './apiClient';
import type { TwinHomeSnapshotResponse } from '../types/twin';

export async function getTwinSnapshot(homeId: string, signal?: AbortSignal) {
  const { data } = await apiClient.get<{ code: number; result: TwinHomeSnapshotResponse }>(
    `/homes/${encodeURIComponent(homeId)}/twin`, { signal },
  );
  if (data.code !== 1000 || !data.result || data.result.homeId !== homeId) {
    throw new Error('Không thể tải Digital Twin của nhà này.');
  }
  return data.result;
}
