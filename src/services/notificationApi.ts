import type {
  NotificationListParams,
  NotificationReadAllResponse,
  NotificationResponse,
  PageResponse,
} from '../types/notification';
import { apiClient } from './apiClient';

interface ApiEnvelope<T> {
  code: number;
  message?: string;
  result?: T;
}

function requireResult<T>(response: ApiEnvelope<T>): T {
  if (response.result === undefined) {
    throw new Error(response.message || 'Máy chủ không trả về dữ liệu thông báo.');
  }
  return response.result;
}

export async function listNotifications(
  params: NotificationListParams = {},
): Promise<PageResponse<NotificationResponse>> {
  const response = await apiClient.get<ApiEnvelope<PageResponse<NotificationResponse>>>('/notifications', {
    params,
  });
  return requireResult(response.data);
}

export async function getNotification(notificationId: string): Promise<NotificationResponse> {
  const response = await apiClient.get<ApiEnvelope<NotificationResponse>>(
    `/notifications/${encodeURIComponent(notificationId)}`,
  );
  return requireResult(response.data);
}

export async function markNotificationRead(notificationId: string): Promise<NotificationResponse> {
  const response = await apiClient.patch<ApiEnvelope<NotificationResponse>>(
    `/notifications/${encodeURIComponent(notificationId)}/read`,
  );
  return requireResult(response.data);
}

export async function markAllNotificationsRead(
  homeId?: string,
): Promise<NotificationReadAllResponse> {
  const response = await apiClient.patch<ApiEnvelope<NotificationReadAllResponse>>(
    '/notifications/read-all',
    undefined,
    { params: homeId ? { homeId } : undefined },
  );
  return requireResult(response.data);
}
