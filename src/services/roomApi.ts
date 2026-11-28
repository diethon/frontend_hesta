import { apiClient } from './apiClient';
import type { RoomResponse, RoomCreateRequest, RoomUpdateRequest } from '../types/room';
import { cachedFetch, invalidateCache } from './queryCache';

export const homeRoomsKey = (homeId: string): string => `rooms:home:${homeId}`;

export const getRooms = async (homeId: string): Promise<RoomResponse[]> => {
  return cachedFetch(
    homeRoomsKey(homeId),
    async () => {
      const response = await apiClient.get(`/homes/${encodeURIComponent(homeId)}/rooms`);
      return response.data.result;
    },
    { ttlMs: 30_000 }
  );
};

export const getRoomDetail = async (homeId: string, roomId: string): Promise<RoomResponse> => {
  const response = await apiClient.get(`/homes/${encodeURIComponent(homeId)}/rooms/${encodeURIComponent(roomId)}`);
  return response.data.result;
};

export const createRoom = async (homeId: string, data: RoomCreateRequest): Promise<RoomResponse> => {
  const response = await apiClient.post(`/homes/${encodeURIComponent(homeId)}/rooms`, data);
  invalidateCache(homeRoomsKey(homeId));
  return response.data.result;
};

export const updateRoom = async (homeId: string, roomId: string, data: RoomUpdateRequest): Promise<RoomResponse> => {
  const response = await apiClient.put(`/homes/${encodeURIComponent(homeId)}/rooms/${encodeURIComponent(roomId)}`, data);
  invalidateCache(homeRoomsKey(homeId));
  invalidateCache(`devices:home:${homeId}`);
  return response.data.result;
};

export const deleteRoom = async (homeId: string, roomId: string): Promise<void> => {
  await apiClient.delete(`/homes/${encodeURIComponent(homeId)}/rooms/${encodeURIComponent(roomId)}`);
  invalidateCache(homeRoomsKey(homeId));
  invalidateCache(`devices:home:${homeId}`);
};
