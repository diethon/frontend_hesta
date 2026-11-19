import type { ApiResponse, UserResponse } from '../types/auth';
import type { UpdateProfileRequest, ChangePasswordRequest, NotificationPreferences } from '../types/user';
import { apiClient } from './apiClient';

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const response = await apiClient.get<ApiResponse<NotificationPreferences>>('/users/me/notification-preferences');
  return response.data.result as NotificationPreferences;
}

export async function updateNotificationPreferences(data: NotificationPreferences): Promise<NotificationPreferences> {
  const response = await apiClient.put<ApiResponse<NotificationPreferences>>('/users/me/notification-preferences', data);
  return response.data.result as NotificationPreferences;
}

export async function updateProfile(data: UpdateProfileRequest): Promise<ApiResponse<UserResponse>> {
  const response = await apiClient.put('/users/me/profile', data);
  return response.data;
}

export async function changePassword(data: ChangePasswordRequest): Promise<ApiResponse<void>> {
  const response = await apiClient.put('/users/me/password', data);
  return response.data;
}

export async function uploadAvatar(file: File): Promise<ApiResponse<UserResponse>> {
  const formData = new FormData();
  formData.append('file', file);

  // Let Axios/browser add the multipart boundary. Setting this header manually
  // can produce an invalid request body on some browser/adapter combinations.
  const response = await apiClient.post('/users/me/avatar', formData, {
    headers: { 'Content-Type': undefined },
  });

  return response.data;
}
