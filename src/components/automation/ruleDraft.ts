// Pure helpers for the automation rule editor: loading a rule into the form, templates, validation
// and list edits. Kept free of React so the editor component only wires state to the UI.
import type {
  AutomationRule,
  RuleActionInput,
  RuleConditionInput,
} from '../../types/automation';
import type { AutomationTemplate } from './TemplateGrid';

export type TriggerType = 'SENSOR' | 'EVENT' | 'SCHEDULE';
export type LogicalOp = 'AND' | 'OR';

export interface RuleDraftParts {
  triggerType: TriggerType;
  conditions: RuleConditionInput[];
  actions: RuleActionInput[];
}

/** Re-numbers `order` after any add/remove/move so it always matches the array index. */
export function withOrder<T extends { order: number }>(items: T[]): T[] {
  return items.map((item, index) => ({ ...item, order: index }));
}

export function removeAt<T extends { order: number }>(items: T[], index: number): T[] {
  return withOrder(items.filter((_, i) => i !== index));
}

export function moveItem<T extends { order: number }>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const copy = [...items];
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return withOrder(copy);
}

/** Converts a saved rule into editable form state. */
export function ruleToDraft(rule: AutomationRule): RuleDraftParts & { logicalOp: LogicalOp; mixedOps: boolean } {
  const conditions: RuleConditionInput[] = (rule.conditions || []).map((c, order) => ({
    deviceId: c.deviceId,
    attribute: c.attribute,
    operator: c.operator,
    expectedValue: c.expectedValue,
    logicalOperator: c.logicalOperator || 'AND',
    order,
  }));
  const actions: RuleActionInput[] = (rule.actions || []).map((a, order) => ({
    deviceId: a.deviceId,
    sceneId: a.sceneId,
    action: a.action,
    parameters: a.parameters || {},
    order,
  }));
  // The editor shows one AND/OR switch for all conditions; older rules may mix both.
  const ops = new Set(conditions.slice(1).map((c) => c.logicalOperator));
  return {
    triggerType: rule.triggerType || 'SENSOR',
    conditions,
    actions,
    mixedOps: ops.size > 1,
    logicalOp: ((conditions[1] ?? conditions[0])?.logicalOperator as LogicalOp) || 'AND',
  };
}

const turnOn = (): RuleActionInput => ({ action: 'TURN_ON', parameters: {}, order: 0 });

/** Starting conditions/actions for a template picked in the template grid. */
export function templateToDraft(template: AutomationTemplate): RuleDraftParts {
  if (template.id === 'blank') return { triggerType: 'SENSOR', conditions: [], actions: [] };
  switch (template.triggerType) {
    case 'SENSOR':
      return {
        triggerType: 'SENSOR',
        conditions: [{ attribute: 'motion', operator: 'EQ', expectedValue: true, logicalOperator: 'AND', order: 0 }],
        actions: [turnOn()],
      };
    case 'EVENT': {
      const isDoor = template.id === 'door-ac';
      const eventCode = template.sampleCondition?.expected || (isDoor ? 'DOOR_OPENED' : 'GAS_LEAK_DETECTED');
      const actionCode = template.sampleAction?.action || (isDoor ? 'TURN_OFF' : 'TURN_ON');
      return {
        triggerType: 'EVENT',
        conditions: [{ attribute: 'eventType', operator: 'EQ', expectedValue: eventCode, logicalOperator: 'AND', order: 0 }],
        actions: [{ action: actionCode, parameters: {}, order: 0 }],
      };
    }
    default:
      return { triggerType: 'SCHEDULE', conditions: [], actions: [turnOn()] };
  }
}

/** First thing the user still has to fill in, or null when the rule can be saved. */
export function validateRuleDraft(
  name: string,
  triggerType: TriggerType,
  conditions: RuleConditionInput[],
  actions: RuleActionInput[],
  activeScheduleCount = 0,
): string | null {
  if (!name.trim()) return 'Nhập tên quy tắc (tối đa 40 ký tự)';
  if (triggerType === 'SCHEDULE' && activeScheduleCount === 0) return 'Thêm ít nhất 1 giờ chạy';
  if (triggerType === 'SENSOR') {
    if (conditions.length === 0) return 'Thêm ít nhất 1 điều kiện cho cảm biến';
    if (conditions.some((c) => !c.deviceId)) return 'Chọn cảm biến nguồn cho điều kiện';
  }
  if (triggerType === 'EVENT' && !conditions[0]?.expectedValue) return 'Chọn sự kiện kích hoạt';
  if (actions.length === 0) return 'Thêm ít nhất 1 hành động thực thi';
  const incomplete = actions.some((a) => (a.action === 'EXECUTE_SCENE' ? !a.sceneId : !a.deviceId));
  if (incomplete) return 'Chọn thiết bị hoặc kịch bản cho hành động';
  return null;
}
