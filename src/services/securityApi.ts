import { featureRequest } from './featureApi';
import type { AnomalyStatus, DeviceAnomaly, SecurityEvent, SecurityEventStatus, SpringPage } from '../types/security';

interface PageQuery<S> {
  page?: number;
  size?: number;
  status?: S;
}

const query = <S extends string>({ page = 0, size = 12, status }: PageQuery<S>) =>
  `?page=${page}&size=${size}${status ? `&status=${status}` : ''}`;

export const getSecurityEvents = (homeId: string, options: PageQuery<SecurityEventStatus> = {}) =>
  featureRequest<SpringPage<SecurityEvent>>(`/homes/${homeId}/security-events${query(options)}`);

export const updateSecurityEvent = (homeId: string, eventId: string, action: 'confirm' | 'dismiss') =>
  featureRequest<SecurityEvent>(`/homes/${homeId}/security-events/${eventId}/${action}`, { method: 'PUT' });

export const getAnomalies = (homeId: string, options: PageQuery<AnomalyStatus> = {}) =>
  featureRequest<SpringPage<DeviceAnomaly>>(`/homes/${homeId}/anomalies${query(options)}`);

export const acknowledgeAnomaly = (homeId: string, anomalyId: string) =>
  featureRequest<DeviceAnomaly>(`/homes/${homeId}/anomalies/${anomalyId}/acknowledge`, { method: 'PUT' });

export const resolveAnomaly = (homeId: string, anomalyId: string) =>
  featureRequest<DeviceAnomaly>(`/homes/${homeId}/anomalies/${anomalyId}/resolve`, {
    method: 'PUT',
    body: JSON.stringify({ falsePositive: false }),
  });
