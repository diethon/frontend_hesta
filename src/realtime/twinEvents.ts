import type { RealtimeEvent } from './realtimeTypes';
import type { TwinDeviceSnapshotResponse, TwinHealthStatusChangedPayload, TwinSensorSnapshotResponse } from '../types/twin';

export type TwinEvent =
  | (RealtimeEvent<TwinDeviceSnapshotResponse> & { type: 'DEVICE_STATE_CHANGED' })
  | (RealtimeEvent<TwinSensorSnapshotResponse> & { type: 'SENSOR_READING_UPDATED' })
  | (RealtimeEvent<TwinHealthStatusChangedPayload> & { type: 'TWIN_HEALTH_STATUS_CHANGED' });

const healthValues = new Set(['ACTIVE', 'STALE', 'OFFLINE']);
const nullableString = (value: unknown) => value === null || typeof value === 'string';
const nullableTime = (value: unknown) => value === null || (typeof value === 'string' && Number.isFinite(Date.parse(value)));

// The shared transport validates the envelope; validate node payloads before reducers see them.
export function isTwinEvent(event: RealtimeEvent): event is TwinEvent {
  if (!event.data || typeof event.data !== 'object' || Array.isArray(event.data)) return false;
  const data = event.data as Record<string, unknown>;
  if (!healthValues.has(String(data.healthStatus)) || !nullableString(data.roomId)) return false;
  if (typeof data.deviceId !== 'string' || !data.deviceId) return false;
  switch (event.type) {
    case 'DEVICE_STATE_CHANGED':
      return typeof data.name === 'string' && typeof data.deviceType === 'string'
        && ['LIGHT', 'FAN', 'AC', 'SOCKET', 'SENSOR', 'LOCK', 'CAMERA', 'MICROPHONE'].includes(data.deviceType)
        && ['ONLINE', 'OFFLINE', 'ERROR', 'UNKNOWN'].includes(String(data.status))
        && nullableString(data.icon) && data.currentState !== undefined && nullableTime(data.lastSeen);
    case 'SENSOR_READING_UPDATED':
      return typeof data.sensorId === 'string' && !!data.sensorId
        && typeof data.metricType === 'string' && !!data.metricType
        && (data.latestValue === null || (typeof data.latestValue === 'number' && Number.isFinite(data.latestValue)))
        && nullableString(data.unit) && nullableTime(data.observedAt);
    case 'TWIN_HEALTH_STATUS_CHANGED':
      return (data.nodeType === 'DEVICE' || data.nodeType === 'SENSOR')
        && typeof data.nodeId === 'string' && !!data.nodeId
        && healthValues.has(String(data.previousStatus)) && nullableTime(data.referenceTime)
        && typeof data.evaluatedAt === 'string' && Number.isFinite(Date.parse(data.evaluatedAt));
    default:
      return false;
  }
}
