export const REALTIME_EVENT_TYPES = [
  'SENSOR_READING_UPDATED',
  'DEVICE_STATE_CHANGED',
  'TWIN_HEALTH_STATUS_CHANGED',
  'NOTIFICATION_CREATED',
] as const;

export type RealtimeEventType = (typeof REALTIME_EVENT_TYPES)[number];

export interface RealtimeEvent<T = unknown> {
  eventId: string;
  type: RealtimeEventType;
  homeId: string;
  deviceId?: string | null;
  data: T;
  timestamp: string;
}

const realtimeEventTypes = new Set<string>(REALTIME_EVENT_TYPES);

export function parseRealtimeEvent(value: string | unknown): RealtimeEvent {
  let candidate: unknown = value;
  if (typeof value === 'string') {
    try {
      candidate = JSON.parse(value);
    } catch {
      throw new Error('Realtime payload is not valid JSON.');
    }
  }

  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new Error('Realtime payload must be an object.');
  }

  const event = candidate as Record<string, unknown>;
  if (typeof event.eventId !== 'string' || !event.eventId.trim()) {
    throw new Error('Realtime eventId is missing.');
  }
  if (typeof event.type !== 'string' || !realtimeEventTypes.has(event.type)) {
    throw new Error('Realtime event type is unsupported.');
  }
  if (typeof event.homeId !== 'string' || !event.homeId.trim()) {
    throw new Error('Realtime homeId is missing.');
  }
  if (event.deviceId !== undefined && event.deviceId !== null && typeof event.deviceId !== 'string') {
    throw new Error('Realtime deviceId is invalid.');
  }
  if (event.data === undefined || event.data === null) {
    throw new Error('Realtime data is missing.');
  }
  if (typeof event.timestamp !== 'string' || Number.isNaN(Date.parse(event.timestamp))) {
    throw new Error('Realtime timestamp is invalid.');
  }

  return event as unknown as RealtimeEvent;
}
