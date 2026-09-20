export interface DeviceSummary {
  id: string;
  homeId: string;
  roomId?: string;
  roomName?: string;
  name: string;
  deviceType: string;
  status: string;
  capabilities?: string[];
}

export interface SceneActionInput {
  targetDeviceId: string;
  action: string;
  value: unknown;
  order: number;
}

export interface SceneAction extends SceneActionInput {
  id: string;
  targetDeviceName: string;
}

export interface Scene {
  id: string;
  homeId: string;
  name: string;
  description?: string;
  enabled: boolean;
  actions: SceneAction[];
}

export interface SceneInput {
  name: string;
  description?: string;
  enabled: boolean;
  actions: SceneActionInput[];
}

export type SceneUpdateInput = Omit<SceneInput, 'actions'> & { actions?: SceneActionInput[] };

export interface RuleConditionInput {
  deviceId?: string;
  attribute: string;
  operator: 'EQ' | 'NE' | 'GT' | 'GTE' | 'LT' | 'LTE';
  expectedValue: unknown;
  logicalOperator: 'AND' | 'OR';
  order: number;
}

export interface RuleActionInput {
  deviceId: string;
  action: string;
  parameters: Record<string, unknown>;
  order: number;
}

export interface AutomationRule {
  id: string;
  homeId: string;
  name: string;
  description?: string;
  triggerType: 'SENSOR' | 'EVENT' | 'SCHEDULE';
  enabled: boolean;
  conditions: Array<RuleConditionInput & { id: string; deviceName?: string }>;
  actions: Array<RuleActionInput & { id: string; deviceName: string }>;
}

export interface AutomationRuleInput {
  name: string;
  description?: string;
  triggerType: 'SENSOR' | 'EVENT' | 'SCHEDULE';
  enabled: boolean;
  conditions: RuleConditionInput[];
  actions: RuleActionInput[];
}
