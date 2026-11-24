import type { RuleScheduleInput } from './schedule';

export interface DeviceSummary {
  id: string;
  homeId: string;
  roomId?: string;
  roomName?: string;
  room?: string;
  online?: boolean;
  name: string;
  deviceType: string;
  status: string;
  currentState?: Record<string, unknown>;
  capabilities?: Record<string, string[]>;
  icon?: string;
  supportedActions?: string[];
  supportedAttributes?: string[];
  sensor?: boolean;
  actionable?: boolean;
}

export interface DeviceCapabilityInfo extends DeviceSummary {
  supportedActions: string[];
  supportedAttributes: string[];
  sensor: boolean;
  actionable: boolean;
}

export interface CapabilityGroup {
  code: string;
  label: string;
  icon: string;
  actions: string[];
  deviceIds: string[];
  deviceCount: number;
}

export interface HomeCapabilitiesResponse {
  homeId: string;
  devices: DeviceCapabilityInfo[];
  capabilities: CapabilityGroup[];
  actionTypes: string[];
  sensorAttributes: string[];
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
  icon?: string | null;
  description?: string;
  enabled: boolean;
  actions: SceneAction[];
}

export interface SceneInput {
  name: string;
  icon?: string | null;
  description?: string;
  enabled: boolean;
  actions: SceneActionInput[];
}

export type SceneUpdateInput = Omit<SceneInput, 'actions'> & { actions?: SceneActionInput[] };

export interface RuleConditionInput {
  deviceId?: string;
  /** Condition on a device group: true when ANY member matches. */
  groupId?: string;
  attribute: string;
  operator: 'EQ' | 'NE' | 'GT' | 'GTE' | 'LT' | 'LTE';
  expectedValue: unknown;
  logicalOperator: 'AND' | 'OR';
  order: number;
}

export interface RuleActionInput {
  deviceId?: string;
  sceneId?: string;
  /** Command every member of the group that supports the action. */
  groupId?: string;
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
  /** Seconds the conditions must stay true before the rule runs (0 = at once). */
  holdSeconds?: number;
  conditions: Array<RuleConditionInput & { id: string; deviceName?: string; groupName?: string }>;
  actions: Array<RuleActionInput & { id: string; deviceName?: string; sceneName?: string; groupName?: string }>;
  /** Times of a SCHEDULE rule ("HH:mm:ss", ISO days 1=Mon…7=Sun, empty = every day). */
  schedules?: Array<{ id: string; scheduledTime: string; repeatDays: number[]; active: boolean }>;
}

/** A wait step (`action: 'DELAY'`, `parameters.seconds`) and the optional auto-off on a turn-on/open step. */
export const DELAY_ACTION = 'DELAY';
export const AUTO_OFF_KEY = 'autoOffSeconds';
export const MAX_DELAY_SECONDS = 3600;
export const MAX_AUTO_OFF_SECONDS = 24 * 3600;
export const MAX_HOLD_SECONDS = 3600;

export interface AutomationRuleInput {
  name: string;
  description?: string;
  triggerType: 'SENSOR' | 'EVENT' | 'SCHEDULE';
  enabled: boolean;
  holdSeconds?: number;
  conditions: RuleConditionInput[];
  actions: RuleActionInput[];
  /** All times of a SCHEDULE rule, saved in the same request (at least one must be active). Omit to keep the saved ones. */
  schedules?: RuleScheduleInput[];
}

export interface AutomationExecution {
  id: string;
  ruleId: string;
  ruleName?: string;
  triggerSource: string;
  status: string;
  test: boolean;
  matchedAt: string;
  startedAt?: string;
  completedAt?: string;
  resultDetail: Array<{ deviceId?: string; sceneId?: string; groupId?: string; seconds?: number; autoOffSeconds?: number; action: string; success: boolean; status: string }>;
}
