export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type SecurityEventStatus = 'DETECTED' | 'CONFIRMED' | 'DISMISSED';

export interface SecurityEvent {
  id: string;
  homeId: string;
  deviceId?: string | null;
  deviceName?: string | null;
  roomName?: string | null;
  eventType: 'MOTION' | 'INTRUSION';
  location?: string | null;
  severity?: SeverityLevel | null;
  status: SecurityEventStatus;
  detectedAt: string;
}

export type AnomalyStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface DeviceAnomaly {
  id: string;
  homeId: string;
  deviceId: string;
  deviceName?: string;
  roomName?: string;
  anomalyType: 'GAS_LEAKAGE' | 'SMOKE_DETECTED' | 'HIGH_TEMPERATURE' | 'SENSOR_OFFLINE';
  metric?: string;
  currentValue?: string;
  expectedRange?: string;
  severity?: SeverityLevel;
  status: AnomalyStatus;
  reason?: string;
  detectedAt: string;
}

/** Spring Data Page serialized by the backend. */
export interface SpringPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
}
