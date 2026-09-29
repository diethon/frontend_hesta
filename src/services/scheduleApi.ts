import { featureRequest } from './featureApi';
import type { Schedule, ScheduleInput } from '../types/schedule';

const path = (homeId: string, kind: 'scenes' | 'automation-rules', targetId: string) =>
  `/homes/${homeId}/${kind}/${targetId}/schedules`;

export const getSchedules = (homeId: string, kind: 'scenes' | 'automation-rules', targetId: string) =>
  featureRequest<Schedule[]>(path(homeId, kind, targetId));

export const saveSchedule = (homeId: string, kind: 'scenes' | 'automation-rules', targetId: string,
  input: ScheduleInput, scheduleId?: string) => featureRequest<Schedule>(
  `${path(homeId, kind, targetId)}${scheduleId ? `/${scheduleId}` : ''}`,
  { method: scheduleId ? 'PUT' : 'POST', body: JSON.stringify(input) },
);

export const deleteSchedule = (homeId: string, kind: 'scenes' | 'automation-rules', targetId: string,
  scheduleId: string) => featureRequest<void>(`${path(homeId, kind, targetId)}/${scheduleId}`, { method: 'DELETE' });
