import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RealtimeEvent } from '../realtime/realtimeTypes';
import {
  getNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notificationApi';
import type {
  NotificationRealtimePayload,
  NotificationResponse,
  PageResponse,
} from '../types/notification';
import { getErrorMessage } from '../utils/errors';
import { sessionEnded } from './authSlice';

const NOTIFICATION_PAGE_SIZE = 20;

interface NotificationScope {
  userId: string;
  homeId: string | null;
}

interface NotificationStateShape {
  auth: { user: { id: string } | null };
  home: { currentHomeId: string | null };
  notification: NotificationState;
}

export interface NotificationState {
  items: NotificationResponse[];
  unreadCount: number;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  isLoadingMore: boolean;
  error: string | null;
  mutationError: string | null;
  lastActionMessage: string | null;
  currentUserId: string | null;
  currentHomeId: string | null;
  initialized: boolean;
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
  markingReadIds: string[];
  markingAll: boolean;
}

function createInitialState(): NotificationState {
  return {
    items: [],
    unreadCount: 0,
    status: 'idle',
    isLoadingMore: false,
    error: null,
    mutationError: null,
    lastActionMessage: null,
    currentUserId: null,
    currentHomeId: null,
    initialized: false,
    page: 0,
    size: NOTIFICATION_PAGE_SIZE,
    totalElements: 0,
    totalPages: 0,
    last: true,
    markingReadIds: [],
    markingAll: false,
  };
}

function isSameScope(state: NotificationState, scope: NotificationScope) {
  return state.currentUserId === scope.userId && state.currentHomeId === scope.homeId;
}

function mergeUniqueNotifications(
  current: NotificationResponse[],
  incoming: NotificationResponse[],
) {
  const byId = new Map(current.map((notification) => [notification.id, notification]));
  incoming.forEach((notification) => byId.set(notification.id, notification));
  return [...byId.values()].sort((left, right) => {
    const timeDifference = Date.parse(right.createdAt) - Date.parse(left.createdAt);
    return timeDifference || right.id.localeCompare(left.id);
  });
}

export function parseNotificationRealtimePayload(value: unknown): NotificationRealtimePayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Dữ liệu thông báo thời gian thực không hợp lệ.');
  }
  const payload = value as Record<string, unknown>;
  if (
    typeof payload.notificationId !== 'string'
    || !payload.notificationId.trim()
    || typeof payload.recipientId !== 'string'
    || !payload.recipientId.trim()
    || typeof payload.homeId !== 'string'
    || !payload.homeId.trim()
    || typeof payload.isRead !== 'boolean'
    || typeof payload.createdAt !== 'string'
    || Number.isNaN(Date.parse(payload.createdAt))
  ) {
    throw new Error('Dữ liệu thông báo thời gian thực không hợp lệ.');
  }
  return payload as unknown as NotificationRealtimePayload;
}

interface LoadNotificationsArgs extends NotificationScope {
  page?: number;
}

interface LoadNotificationsResult extends NotificationScope {
  pageResponse: PageResponse<NotificationResponse>;
  unreadCount?: number;
}

export const loadNotifications = createAsyncThunk<
  LoadNotificationsResult,
  LoadNotificationsArgs,
  { rejectValue: string }
>('notification/load', async ({ userId, homeId, page = 0 }, { rejectWithValue }) => {
  try {
    const params = {
      homeId: homeId ?? undefined,
      page,
      size: NOTIFICATION_PAGE_SIZE,
    };
    if (page > 0) {
      return { userId, homeId, pageResponse: await listNotifications(params) };
    }

    const [pageResponse, unreadPage] = await Promise.all([
      listNotifications(params),
      listNotifications({ ...params, isRead: false, size: 1 }),
    ]);
    return { userId, homeId, pageResponse, unreadCount: unreadPage.totalElements };
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, 'Không thể tải thông báo.'));
  }
});

export const receiveNotificationFromRealtime = createAsyncThunk<
  NotificationResponse | null,
  RealtimeEvent,
  { state: NotificationStateShape; rejectValue: string }
>('notification/realtimeReceived', async (event, { getState, rejectWithValue }) => {
  try {
    const payload = parseNotificationRealtimePayload(event.data);
    const state = getState();
    if (
      event.type !== 'NOTIFICATION_CREATED'
      || state.auth.user?.id !== payload.recipientId
      || state.home.currentHomeId !== payload.homeId
      || event.homeId !== payload.homeId
    ) {
      return null;
    }

    const notification = await getNotification(payload.notificationId);
    if (
      notification.id !== payload.notificationId
      || notification.userId !== payload.recipientId
      || notification.homeId !== payload.homeId
    ) {
      throw new Error('Thông báo nhận được không khớp với sự kiện thời gian thực.');
    }
    return notification;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, 'Không thể đồng bộ thông báo mới.'));
  }
});

export const markNotificationAsRead = createAsyncThunk<
  NotificationResponse,
  string,
  { rejectValue: string }
>('notification/markRead', async (notificationId, { rejectWithValue }) => {
  try {
    return await markNotificationRead(notificationId);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, 'Không thể đánh dấu thông báo đã đọc.'));
  }
});

export const markAllNotificationsAsRead = createAsyncThunk<
  { homeId: string | null; updatedCount: number },
  string | null,
  { rejectValue: string }
>('notification/markAllRead', async (homeId, { rejectWithValue }) => {
  try {
    const result = await markAllNotificationsRead(homeId ?? undefined);
    return { homeId, updatedCount: result.updatedCount };
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, 'Không thể đánh dấu tất cả thông báo đã đọc.'));
  }
});

const notificationSlice = createSlice({
  name: 'notification',
  initialState: createInitialState(),
  reducers: {
    notificationScopeChanged(state, action: PayloadAction<NotificationScope>) {
      if (isSameScope(state, action.payload)) return;
      const nextState = createInitialState();
      nextState.currentUserId = action.payload.userId;
      nextState.currentHomeId = action.payload.homeId;
      return nextState;
    },
    notificationsCleared() {
      return createInitialState();
    },
    notificationFeedbackCleared(state) {
      state.mutationError = null;
      state.lastActionMessage = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadNotifications.pending, (state, action) => {
        const scope = action.meta.arg;
        if (!isSameScope(state, scope)) {
          const nextState = createInitialState();
          nextState.currentUserId = scope.userId;
          nextState.currentHomeId = scope.homeId;
          state = nextState;
        }
        state.error = null;
        if ((scope.page ?? 0) === 0) state.status = 'loading';
        else state.isLoadingMore = true;
        return state;
      })
      .addCase(loadNotifications.fulfilled, (state, action) => {
        if (!isSameScope(state, action.payload)) return;
        const { pageResponse, unreadCount } = action.payload;
        state.items = mergeUniqueNotifications(state.items, pageResponse.content);
        state.page = pageResponse.page;
        state.size = pageResponse.size;
        state.totalElements = Math.max(pageResponse.totalElements, state.items.length);
        state.totalPages = Math.max(
          pageResponse.totalPages,
          Math.ceil(state.totalElements / pageResponse.size),
        );
        state.last = pageResponse.last && state.items.length >= state.totalElements;
        if (unreadCount !== undefined) {
          const loadedUnreadCount = state.items.filter((notification) => !notification.isRead).length;
          state.unreadCount = Math.max(unreadCount, loadedUnreadCount);
        }
        state.status = 'succeeded';
        state.isLoadingMore = false;
        state.initialized = true;
        state.error = null;
      })
      .addCase(loadNotifications.rejected, (state, action) => {
        if (!isSameScope(state, action.meta.arg)) return;
        state.status = state.initialized ? 'succeeded' : 'failed';
        state.isLoadingMore = false;
        state.initialized = true;
        state.error = action.payload ?? 'Không thể tải thông báo.';
      })
      .addCase(receiveNotificationFromRealtime.fulfilled, (state, action) => {
        const notification = action.payload;
        if (
          !notification
          || state.currentUserId !== notification.userId
          || state.currentHomeId !== notification.homeId
          || state.items.some((item) => item.id === notification.id)
        ) {
          return;
        }
        state.items = mergeUniqueNotifications(state.items, [notification]);
        state.totalElements += 1;
        state.totalPages = Math.ceil(state.totalElements / state.size);
        state.last = state.items.length >= state.totalElements;
        if (!notification.isRead) state.unreadCount += 1;
      })
      .addCase(receiveNotificationFromRealtime.rejected, (state, action) => {
        const data = action.meta.arg.data;
        if (
          action.meta.arg.homeId !== state.currentHomeId
          || !data
          || typeof data !== 'object'
          || Array.isArray(data)
          || (data as Record<string, unknown>).recipientId !== state.currentUserId
        ) {
          return;
        }
        state.error = action.payload ?? 'Không thể đồng bộ thông báo mới.';
      })
      .addCase(markNotificationAsRead.pending, (state, action) => {
        if (!state.markingReadIds.includes(action.meta.arg)) {
          state.markingReadIds.push(action.meta.arg);
        }
        state.mutationError = null;
        state.lastActionMessage = null;
      })
      .addCase(markNotificationAsRead.fulfilled, (state, action) => {
        state.markingReadIds = state.markingReadIds.filter((id) => id !== action.meta.arg);
        const index = state.items.findIndex((item) => item.id === action.payload.id);
        if (index < 0) return;
        const wasUnread = !state.items[index].isRead;
        state.items[index] = action.payload;
        if (wasUnread && action.payload.isRead) state.unreadCount = Math.max(0, state.unreadCount - 1);
        state.lastActionMessage = 'Đã đánh dấu thông báo là đã đọc.';
      })
      .addCase(markNotificationAsRead.rejected, (state, action) => {
        state.markingReadIds = state.markingReadIds.filter((id) => id !== action.meta.arg);
        state.mutationError = action.payload ?? 'Không thể đánh dấu thông báo đã đọc.';
      })
      .addCase(markAllNotificationsAsRead.pending, (state) => {
        state.markingAll = true;
        state.mutationError = null;
        state.lastActionMessage = null;
      })
      .addCase(markAllNotificationsAsRead.fulfilled, (state, action) => {
        state.markingAll = false;
        if (state.currentHomeId !== action.payload.homeId) return;
        state.items.forEach((notification) => {
          notification.isRead = true;
        });
        state.unreadCount = 0;
        state.lastActionMessage = action.payload.updatedCount > 0
          ? `Đã đánh dấu ${action.payload.updatedCount} thông báo là đã đọc.`
          : 'Tất cả thông báo đã được đọc.';
      })
      .addCase(markAllNotificationsAsRead.rejected, (state, action) => {
        state.markingAll = false;
        state.mutationError = action.payload ?? 'Không thể đánh dấu tất cả thông báo đã đọc.';
      })
      .addCase(sessionEnded, () => createInitialState());
  },
});

export const {
  notificationFeedbackCleared,
  notificationScopeChanged,
  notificationsCleared,
} = notificationSlice.actions;
export const notificationReducer = notificationSlice.reducer;
