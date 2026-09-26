import type { AutomationExecution, AutomationRule, AutomationRuleInput, AutomationTestResult } from '../types/automation';
import { featureRequest } from './featureApi';

export const getAutomationRules = (homeId: string) =>
  featureRequest<AutomationRule[]>(`/homes/${homeId}/automation-rules`);

export const createAutomationRule = (homeId: string, input: AutomationRuleInput) =>
  featureRequest<AutomationRule>(`/homes/${homeId}/automation-rules`, {
    method: 'POST', body: JSON.stringify(input),
  });

export const updateAutomationRule = (homeId: string, ruleId: string, input: AutomationRuleInput) =>
  featureRequest<AutomationRule>(`/homes/${homeId}/automation-rules/${ruleId}`, {
    method: 'PUT', body: JSON.stringify(input),
  });

export const getAutomationExecutions = (homeId: string, ruleId: string) =>
  featureRequest<AutomationExecution[]>(`/homes/${homeId}/automation-rules/${ruleId}/executions`);

export const testAutomationRule = (homeId: string, ruleId: string, event: {
  sourceDeviceId?: string; eventType: string; data: Record<string, unknown>;
}) => featureRequest<AutomationTestResult>(`/homes/${homeId}/automation-rules/${ruleId}/test`, {
  method: 'POST', body: JSON.stringify(event),
});

export const toggleAutomationRule = (homeId: string, ruleId: string, enabled: boolean) =>
  featureRequest<AutomationRule>(`/homes/${homeId}/automation-rules/${ruleId}/enabled?enabled=${enabled}`, {
    method: 'PATCH',
  });

export const deleteAutomationRule = (homeId: string, ruleId: string) =>
  featureRequest<void>(`/homes/${homeId}/automation-rules/${ruleId}`, { method: 'DELETE' });
