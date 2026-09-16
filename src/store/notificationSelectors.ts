import type { RootState } from './store';

export const selectNotificationState = (state: RootState) => state.notification;
export const selectNotifications = (state: RootState) => state.notification.items;
export const selectNotificationUnreadCount = (state: RootState) => state.notification.unreadCount;
export const selectNotificationStatus = (state: RootState) => state.notification.status;
