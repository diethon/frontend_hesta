import { featureRequest } from './featureApi';
import type {
  ParentalGuardianRule,
  ParentalGuardianLog,
  CreateGuardianRuleInput,
  UpdateGuardianRuleInput,
  SimulateEventType,
} from '../types/guardian';

const basePath = (homeId: string) => `/homes/${homeId}/guardian-rules`;

export const getGuardianRules = (homeId: string) =>
  featureRequest<ParentalGuardianRule[]>(basePath(homeId));

export const getGuardianRule = (homeId: string, ruleId: string) =>
  featureRequest<ParentalGuardianRule>(`${basePath(homeId)}/${ruleId}`);

export const createGuardianRule = (homeId: string, input: CreateGuardianRuleInput) =>
  featureRequest<ParentalGuardianRule>(basePath(homeId), {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateGuardianRule = (homeId: string, ruleId: string, input: UpdateGuardianRuleInput) =>
  featureRequest<ParentalGuardianRule>(`${basePath(homeId)}/${ruleId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });

export const toggleGuardianRule = (homeId: string, ruleId: string, enabled: boolean) =>
  featureRequest<ParentalGuardianRule>(`${basePath(homeId)}/${ruleId}/enabled?enabled=${enabled}`, {
    method: 'PATCH',
  });

export const deleteGuardianRule = (homeId: string, ruleId: string) =>
  featureRequest<void>(`${basePath(homeId)}/${ruleId}`, {
    method: 'DELETE',
  });

export const toggleParentAway = (homeId: string, ruleId: string, away: boolean) =>
  featureRequest<ParentalGuardianRule>(`${basePath(homeId)}/${ruleId}/parent-away?away=${away}`, {
    method: 'PATCH',
  });

export const extendGuardianSession = (homeId: string, ruleId: string, extraMinutes = 15) =>
  featureRequest<ParentalGuardianRule>(`${basePath(homeId)}/${ruleId}/extend?extraMinutes=${extraMinutes}`, {
    method: 'POST',
  });

export const unlockGuardianSession = (homeId: string, ruleId: string) =>
  featureRequest<ParentalGuardianRule>(`${basePath(homeId)}/${ruleId}/unlock`, {
    method: 'POST',
  });

export const simulateGuardianEvent = (homeId: string, ruleId: string, eventType: SimulateEventType) =>
  featureRequest<ParentalGuardianRule>(`${basePath(homeId)}/${ruleId}/simulate`, {
    method: 'POST',
    body: JSON.stringify({ eventType }),
  });

export const getGuardianLogs = (homeId: string, ruleId: string) =>
  featureRequest<ParentalGuardianLog[]>(`${basePath(homeId)}/${ruleId}/logs`);
