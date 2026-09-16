export const NOTIFICATION_TYPES = [
  'SECURITY',
  'AUTOMATION',
  'ANOMALY',
  'SYSTEM',
  'DEVICE',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'] as const;

export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];

export interface NotificationResponse {
  id: string;
  userId: string;
  homeId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationRealtimePayload {
  notificationId: string;
  recipientId: string;
  homeId: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationReadAllResponse {
  updatedCount: number;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface NotificationListParams {
  homeId?: string;
  isRead?: boolean;
  type?: NotificationType;
  priority?: NotificationPriority;
  page?: number;
  size?: number;
}
