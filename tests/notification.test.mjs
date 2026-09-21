import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, beforeEach, test } from 'node:test';
import { runInThisContext } from 'node:vm';
import React from 'react';
import { renderToString } from 'react-dom/server';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const modules = new Map();
globalThis.__viteEnv = { VITE_API_BASE_URL: 'http://backend.test/api/v1' };

function loadSource(path) {
  const filename = resolve(root, path);
  if (modules.has(filename)) return modules.get(filename).exports;
  const module = { exports: {} };
  modules.set(filename, module);
  const source = readFileSync(filename, 'utf8').replaceAll('import.meta.env', 'globalThis.__viteEnv');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    fileName: filename,
  });
  const sourceRequire = (name) => {
    if (!name.startsWith('.')) return require(name);
    const base = resolve(dirname(filename), name);
    const dependencyPath = ['.ts', '.tsx'].map((extension) => base + extension).find(existsSync);
    assert.ok(dependencyPath, `Cannot resolve ${name} from ${path}`);
    return loadSource(dependencyPath);
  };
  runInThisContext(`(function(require, module, exports) { ${outputText}\n})`, { filename })(sourceRequire, module, module.exports);
  return module.exports;
}

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const storage = new Map([
  ['accessToken', 'notification-token'],
  ['refreshToken', 'notification-refresh'],
  ['userInfo', JSON.stringify({
    id: 'user-1', fullName: 'Notification Test', email: 'notify@example.test',
    platformRole: 'USER', provider: 'LOCAL', status: 'ACTIVE', createdAt: '',
  })],
]);
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key) => storage.get(key) ?? null,
  removeItem: (key) => storage.delete(key),
} });

const { apiClient } = loadSource('src/services/apiClient.ts');
const notificationApi = loadSource('src/services/notificationApi.ts');
const notificationStore = loadSource('src/store/notificationSlice.ts');
const { currentHomeChanged } = loadSource('src/store/homeSlice.ts');
const { sessionEnded } = loadSource('src/store/authSlice.ts');
const { createAppStore } = loadSource('src/store/store.ts');
const { NotificationPanelView } = loadSource('src/components/notification/NotificationBell.tsx');
const originalAdapter = apiClient.defaults.adapter;
let requests = [];

const firstNotification = {
  id: 'notification-1',
  userId: 'user-1',
  homeId: 'home-1',
  type: 'SECURITY',
  title: 'Cửa vừa mở',
  message: 'Cửa chính được mở lúc 08:30.',
  priority: 'HIGH',
  isRead: false,
  createdAt: '2026-09-16T08:30:00+07:00',
};

const secondNotification = {
  ...firstNotification,
  id: 'notification-2',
  type: 'DEVICE',
  title: 'Thiết bị ngoại tuyến',
  priority: 'MEDIUM',
  createdAt: '2026-09-16T09:00:00+07:00',
};

function response(config, result) {
  return {
    data: { code: 1000, result },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
    request: {},
  };
}

beforeEach(() => {
  requests = [];
  apiClient.defaults.adapter = async (config) => {
    requests.push(config);
    if (config.url === '/notifications' && config.params?.isRead === false) {
      return response(config, {
        content: [], page: 0, size: 1, totalElements: 3, totalPages: 3, last: false,
      });
    }
    if (config.url === '/notifications') {
      return response(config, {
        content: [firstNotification], page: 0, size: 20, totalElements: 1, totalPages: 1, last: true,
      });
    }
    if (config.url === '/notifications/notification-2') return response(config, secondNotification);
    if (config.url === '/notifications/notification-1/read') {
      return response(config, { ...firstNotification, isRead: true });
    }
    if (config.url === '/notifications/read-all') return response(config, { updatedCount: 2 });
    if (config.url === '/notifications/notification-1') return response(config, firstNotification);
    throw new Error(`Unexpected request: ${config.method} ${config.url}`);
  };
});

after(() => {
  apiClient.defaults.adapter = originalAdapter;
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else delete globalThis.localStorage;
});

test('notification service matches list, detail, mark-read, and read-all backend contracts', async () => {
  await notificationApi.listNotifications({
    homeId: 'home-1', isRead: false, type: 'SECURITY', priority: 'HIGH', page: 2, size: 20,
  });
  await notificationApi.getNotification('notification-1');
  await notificationApi.markNotificationRead('notification-1');
  await notificationApi.markAllNotificationsRead('home-1');

  assert.deepEqual(requests.map(({ method }) => method.toUpperCase()), ['GET', 'GET', 'PATCH', 'PATCH']);
  assert.deepEqual(requests.map(({ baseURL, url }) => new URL(`${baseURL}${url}`).pathname), [
    '/api/v1/notifications',
    '/api/v1/notifications/notification-1',
    '/api/v1/notifications/notification-1/read',
    '/api/v1/notifications/read-all',
  ]);
  assert.deepEqual(requests[0].params, {
    homeId: 'home-1', isRead: false, type: 'SECURITY', priority: 'HIGH', page: 2, size: 20,
  });
  assert.deepEqual(requests[3].params, { homeId: 'home-1' });
  assert.ok(requests.every(({ headers }) => headers.get('Authorization') === 'Bearer notification-token'));
});

test('initial loading stores persisted read state, pagination, and the exact unread total', async () => {
  const store = createAppStore();
  store.dispatch(currentHomeChanged('home-1'));
  await store.dispatch(notificationStore.loadNotifications({ userId: 'user-1', homeId: 'home-1' }));

  const state = store.getState().notification;
  assert.equal(state.status, 'succeeded');
  assert.equal(state.items[0].id, 'notification-1');
  assert.equal(state.items[0].isRead, false);
  assert.equal(state.unreadCount, 3);
  assert.equal(state.totalElements, 1);
  assert.equal(requests.filter(({ url }) => url === '/notifications').length, 2);
});

test('mark-one and mark-all update read state only after backend confirmation', async () => {
  const store = createAppStore();
  store.dispatch(currentHomeChanged('home-1'));
  await store.dispatch(notificationStore.loadNotifications({ userId: 'user-1', homeId: 'home-1' }));
  await store.dispatch(notificationStore.markNotificationAsRead('notification-1'));
  assert.equal(store.getState().notification.items[0].isRead, true);
  assert.equal(store.getState().notification.unreadCount, 2);

  await store.dispatch(notificationStore.markAllNotificationsAsRead('home-1'));
  assert.equal(store.getState().notification.unreadCount, 0);
  assert.ok(store.getState().notification.items.every(({ isRead }) => isRead));
  assert.match(store.getState().notification.lastActionMessage, /2 thông báo/);
});

test('NOTIFICATION_CREATED fetches its private DTO and duplicate notifications remain idempotent', async () => {
  const store = createAppStore();
  store.dispatch(currentHomeChanged('home-1'));
  store.dispatch(notificationStore.notificationScopeChanged({ userId: 'user-1', homeId: 'home-1' }));
  const event = {
    eventId: 'event-1',
    type: 'NOTIFICATION_CREATED',
    homeId: 'home-1',
    data: {
      notificationId: 'notification-2',
      recipientId: 'user-1',
      homeId: 'home-1',
      isRead: false,
      createdAt: secondNotification.createdAt,
    },
    timestamp: secondNotification.createdAt,
  };

  await store.dispatch(notificationStore.receiveNotificationFromRealtime(event));
  await store.dispatch(notificationStore.receiveNotificationFromRealtime({ ...event, eventId: 'event-2' }));

  assert.deepEqual(store.getState().notification.items.map(({ id }) => id), ['notification-2']);
  assert.equal(store.getState().notification.unreadCount, 1);
  assert.equal(requests.filter(({ url }) => url === '/notifications/notification-2').length, 2);
});

test('realtime events and stored items are isolated across homes and users', async () => {
  const store = createAppStore();
  store.dispatch(currentHomeChanged('home-1'));
  store.dispatch(notificationStore.notificationScopeChanged({ userId: 'user-1', homeId: 'home-1' }));
  const event = {
    eventId: 'event-other-user',
    type: 'NOTIFICATION_CREATED',
    homeId: 'home-1',
    data: {
      notificationId: 'notification-2', recipientId: 'user-2', homeId: 'home-1',
      isRead: false, createdAt: secondNotification.createdAt,
    },
    timestamp: secondNotification.createdAt,
  };
  await store.dispatch(notificationStore.receiveNotificationFromRealtime(event));
  assert.equal(requests.length, 0);
  assert.equal(store.getState().notification.items.length, 0);

  store.dispatch(notificationStore.notificationScopeChanged({ userId: 'user-1', homeId: 'home-2' }));
  assert.equal(store.getState().notification.currentHomeId, 'home-2');
  assert.equal(store.getState().notification.items.length, 0);
  assert.equal(store.getState().notification.unreadCount, 0);
});

test('logout clears all user-specific notification state', async () => {
  const store = createAppStore();
  store.dispatch(currentHomeChanged('home-1'));
  await store.dispatch(notificationStore.loadNotifications({ userId: 'user-1', homeId: 'home-1' }));
  assert.equal(store.getState().notification.items.length, 1);
  store.dispatch(sessionEnded());
  assert.equal(store.getState().notification.items.length, 0);
  assert.equal(store.getState().notification.currentUserId, null);
  assert.equal(store.getState().notification.unreadCount, 0);
});

const basePanelProps = {
  items: [], unreadCount: 0, status: 'succeeded', error: null, mutationError: null,
  lastActionMessage: null, isLoadingMore: false, isLastPage: true, markingAll: false,
  markingReadIds: [], onMarkRead() {}, onMarkAllRead() {}, onLoadMore() {}, onRetry() {},
};

test('notification panel renders loading, error, empty, unread, and read states accessibly', () => {
  const loading = renderToString(React.createElement(NotificationPanelView, {
    ...basePanelProps, status: 'loading',
  }));
  assert.match(loading, /Đang tải thông báo/);

  const error = renderToString(React.createElement(NotificationPanelView, {
    ...basePanelProps, status: 'failed', error: 'Mất kết nối',
  }));
  assert.match(error, /role="alert"/);
  assert.match(error, /Thử lại/);

  const empty = renderToString(React.createElement(NotificationPanelView, basePanelProps));
  assert.match(empty, /Chưa có thông báo/);

  const list = renderToString(React.createElement(NotificationPanelView, {
    ...basePanelProps,
    items: [firstNotification, { ...secondNotification, isRead: true }],
    unreadCount: 1,
  }));
  assert.match(list, /Cửa vừa mở, đánh dấu là đã đọc/);
  assert.match(list, /Thiết bị ngoại tuyến, đã đọc/);
  assert.match(list, /Ưu tiên cao/);
  assert.match(list, /Ưu tiên vừa/);
});

test('realtime payload validation rejects unsupported shapes', () => {
  assert.throws(() => notificationStore.parseNotificationRealtimePayload({ notificationId: 'only-id' }), /không hợp lệ/);
  assert.equal(notificationStore.parseNotificationRealtimePayload({
    notificationId: 'notification-1', recipientId: 'user-1', homeId: 'home-1',
    isRead: false, createdAt: firstNotification.createdAt,
  }).recipientId, 'user-1');
});
