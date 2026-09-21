import {
  Client,
  ReconnectionTimeMode,
  type IMessage,
  type StompConfig,
  type StompSubscription,
} from '@stomp/stompjs';
import { getRealtimeWebSocketUrl } from '../services/apiClient';
import type { RealtimeConnectionStatus } from '../store/realtimeSlice';
import { parseRealtimeEvent, type RealtimeEvent } from './realtimeTypes';

const HEARTBEAT_INTERVAL_MS = 20_000;
const MAX_RECENT_EVENT_IDS = 200;

interface StompClientAdapter {
  active: boolean;
  connected: boolean;
  activate(): void;
  deactivate(): Promise<void>;
  subscribe(destination: string, callback: (message: IMessage) => void): StompSubscription;
}

interface RealtimeClientCallbacks {
  onStatusChange?: (status: RealtimeConnectionStatus) => void;
  onHomeSubscriptionChange?: (homeId: string | null) => void;
  onEvent?: (event: RealtimeEvent) => void;
  onError?: (message: string) => void;
}

interface SharedRealtimeClientOptions {
  brokerUrl?: () => string;
  createStompClient?: (config: StompConfig) => StompClientAdapter;
  callbacks?: RealtimeClientCallbacks;
}

class RecentEventIds {
  private readonly values = new Set<string>();
  private readonly order: string[] = [];
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  addIfNew(eventId: string) {
    if (this.values.has(eventId)) return false;
    this.values.add(eventId);
    this.order.push(eventId);
    if (this.order.length > this.capacity) {
      const oldest = this.order.shift();
      if (oldest) this.values.delete(oldest);
    }
    return true;
  }

  clear() {
    this.values.clear();
    this.order.length = 0;
  }
}

export function homeEventsDestination(homeId: string) {
  const normalizedHomeId = homeId.trim();
  if (!normalizedHomeId || normalizedHomeId.includes('/')) {
    throw new Error('A valid homeId is required for a realtime subscription.');
  }
  return `/topic/homes/${normalizedHomeId}/events`;
}

export class SharedRealtimeClient {
  private readonly brokerUrl: () => string;
  private readonly createStompClient: (config: StompConfig) => StompClientAdapter;
  private callbacks: RealtimeClientCallbacks;
  private client: StompClientAdapter | null = null;
  private clientToken: string | null = null;
  private desiredToken: string | null = null;
  private desiredHomeId: string | null = null;
  private subscription: StompSubscription | null = null;
  private subscribedHomeId: string | null = null;
  private readonly recentEventIds = new RecentEventIds(MAX_RECENT_EVENT_IDS);
  private reconcileQueue: Promise<void> = Promise.resolve();

  constructor(options: SharedRealtimeClientOptions = {}) {
    this.brokerUrl = options.brokerUrl ?? getRealtimeWebSocketUrl;
    this.createStompClient = options.createStompClient ?? ((config) => new Client(config));
    this.callbacks = options.callbacks ?? {};
  }

  setCallbacks(callbacks: RealtimeClientCallbacks) {
    this.callbacks = callbacks;
  }

  connect(accessToken: string) {
    const normalizedToken = accessToken.trim();
    if (!normalizedToken) {
      this.reportError('Không thể kết nối thời gian thực khi thiếu phiên đăng nhập.');
      return Promise.resolve();
    }
    this.desiredToken = normalizedToken;
    return this.queueReconcile();
  }

  disconnect() {
    this.desiredToken = null;
    this.desiredHomeId = null;
    this.callbacks.onHomeSubscriptionChange?.(null);
    return this.queueReconcile();
  }

  subscribeToHome(homeId: string) {
    const normalizedHomeId = homeId.trim();
    homeEventsDestination(normalizedHomeId);
    if (this.desiredHomeId === normalizedHomeId) return;
    this.desiredHomeId = normalizedHomeId;
    this.syncSubscription(this.client);
  }

  unsubscribeFromHome(homeId?: string) {
    if (homeId && this.desiredHomeId !== homeId.trim()) return;
    this.desiredHomeId = null;
    this.removeSubscription();
  }

  private queueReconcile() {
    this.reconcileQueue = this.reconcileQueue.then(() => this.reconcile()).catch(() => {
      this.reportError('Không thể thay đổi kết nối thời gian thực.');
    });
    return this.reconcileQueue;
  }

  private async reconcile() {
    const desiredToken = this.desiredToken;
    if (this.client && this.clientToken === desiredToken && this.client.active) return;

    if (this.client) {
      const previousClient = this.client;
      this.client = null;
      this.clientToken = null;
      this.removeSubscription();
      await previousClient.deactivate();
    }

    if (!desiredToken || this.desiredToken !== desiredToken) {
      this.recentEventIds.clear();
      this.callbacks.onStatusChange?.('disconnected');
      return;
    }

    this.callbacks.onStatusChange?.('connecting');
    let client: StompClientAdapter | null = null;
    client = this.createStompClient(this.createConfig(desiredToken, () => client));
    this.client = client;
    this.clientToken = desiredToken;
    client.activate();
  }

  private createConfig(accessToken: string, getConfiguredClient: () => StompClientAdapter | null): StompConfig {
    return {
      brokerURL: this.brokerUrl(),
      connectHeaders: {
        Authorization: `Bearer ${accessToken}`,
      },
      connectionTimeout: 10_000,
      reconnectDelay: 1_000,
      maxReconnectDelay: 10_000,
      reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
      heartbeatIncoming: HEARTBEAT_INTERVAL_MS,
      heartbeatOutgoing: HEARTBEAT_INTERVAL_MS,
      discardWebsocketOnCommFailure: true,
      debug: () => undefined,
      onConnect: () => {
        const configuredClient = getConfiguredClient();
        if (this.client !== configuredClient) return;
        this.callbacks.onStatusChange?.('connected');
        this.syncSubscription(configuredClient);
      },
      onDisconnect: () => {
        const configuredClient = getConfiguredClient();
        if (this.client === configuredClient) this.callbacks.onStatusChange?.('disconnected');
      },
      onWebSocketClose: () => {
        const configuredClient = getConfiguredClient();
        if (this.client !== configuredClient) return;
        this.subscription = null;
        this.subscribedHomeId = null;
        this.callbacks.onHomeSubscriptionChange?.(null);
        this.callbacks.onStatusChange?.(this.desiredToken ? 'reconnecting' : 'disconnected');
      },
      onWebSocketError: () => {
        const configuredClient = getConfiguredClient();
        if (this.client === configuredClient) {
          this.reportError('Không thể kết nối tới dịch vụ thời gian thực.');
        }
      },
      onStompError: () => {
        const configuredClient = getConfiguredClient();
        if (this.client === configuredClient) {
          this.reportError('Máy chủ từ chối kết nối hoặc đăng ký thời gian thực.');
        }
      },
    };
  }

  private syncSubscription(client: StompClientAdapter | null) {
    if (!client?.connected) return;
    if (this.subscribedHomeId === this.desiredHomeId && this.subscription) return;

    this.removeSubscription();
    if (!this.desiredHomeId) return;

    const homeId = this.desiredHomeId;
    try {
      this.subscription = client.subscribe(homeEventsDestination(homeId), (message) => {
        this.handleMessage(message.body, homeId);
      });
      this.subscribedHomeId = homeId;
      this.callbacks.onHomeSubscriptionChange?.(homeId);
    } catch {
      this.reportError('Không thể đăng ký nhận sự kiện của nhà hiện tại.');
    }
  }

  private removeSubscription() {
    if (this.subscription) {
      try {
        this.subscription.unsubscribe();
      } catch {
        // A closed transport has already removed this broker subscription.
      }
    }
    this.subscription = null;
    this.subscribedHomeId = null;
    this.callbacks.onHomeSubscriptionChange?.(null);
  }

  private handleMessage(body: string, subscribedHomeId: string) {
    try {
      const event = parseRealtimeEvent(body);
      if (event.homeId !== subscribedHomeId || !this.recentEventIds.addIfNew(event.eventId)) return;
      this.callbacks.onEvent?.(event);
    } catch {
      this.reportError('Đã bỏ qua một sự kiện thời gian thực không hợp lệ.');
    }
  }

  private reportError(message: string) {
    this.callbacks.onError?.(message);
  }
}

export const realtimeClient = new SharedRealtimeClient();
