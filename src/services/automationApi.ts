import type { AutomationRule, AutomationRuleInput } from '../types/automation';
import { featureRequest } from './featureApi';

export const getAutomationRules = (homeId: string) =>
  featureRequest<AutomationRule[]>(`/homes/${homeId}/automation-rules`);

export const createAutomationRule = (homeId: string, input: AutomationRuleInput) =>
  featureRequest<AutomationRule>(`/homes/${homeId}/automation-rules`, {
    method: 'POST', body: JSON.stringify(input),
  });

export const toggleAutomationRule = (homeId: string, ruleId: string, enabled: boolean) =>
  featureRequest<AutomationRule>(`/homes/${homeId}/automation-rules/${ruleId}/enabled?enabled=${enabled}`, {
    method: 'PATCH',
  });

export const deleteAutomationRule = (homeId: string, ruleId: string) =>
  featureRequest<void>(`/homes/${homeId}/automation-rules/${ruleId}`, { method: 'DELETE' });
