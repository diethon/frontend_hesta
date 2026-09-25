import type { DeviceSummary } from '../../types/automation';
import type { SceneResponse, SceneActionResponse, SceneActionRequest, SceneActionType, UpdateSceneRequest } from '../../types/scene';
import { actionOptions, getDeviceActions } from '../deviceActionOptions.ts';

export interface DraftSceneAction { deviceId: string; action: string; value: string }

const sceneActionCodes = new Set(['TURN_ON', 'TURN_OFF', 'SET_BRIGHTNESS', 'SET_TEMPERATURE', 'SET_SPEED', 'SET_STATE']);

export function getSceneDeviceActions(device?: DeviceSummary) {
  return getDeviceActions(device).filter((option) => sceneActionCodes.has(option.code));
}

export function sceneActionsToDraft(actions: SceneActionResponse[]): DraftSceneAction[] {
  return [...actions].sort((first, second) => first.order - second.order).map((action) => ({
    deviceId: action.targetDeviceId,
    action: action.action,
    value: action.value == null ? '' : typeof action.value === 'string' ? action.value : JSON.stringify(action.value),
  }));
}

export function sceneToggleInput(scene: SceneResponse): UpdateSceneRequest {
  return { name: scene.name, icon: scene.icon, description: scene.description, enabled: !scene.enabled };
}

export function buildSceneActionInput(item: DraftSceneAction, order: number, devices: DeviceSummary[]): SceneActionRequest {
  const device = devices.find((candidate) => candidate.id === item.deviceId);
  const option = getSceneDeviceActions(device).find((candidate) => candidate.code === item.action);
  if (!device || !option) throw new Error(`Hành động ${order + 1} không phù hợp với thiết bị đã chọn.`);

  const rawValue = item.value.trim();
  let value: unknown = null;
  if (option.valueKind === 'percentage' || option.valueKind === 'number') {
    const number = Number(rawValue);
    if (!rawValue || !Number.isFinite(number)
      || (option.valueKind === 'percentage' && (!Number.isInteger(number) || number < 0 || number > 100))) {
      throw new Error(`${option.valueLabel} của hành động ${order + 1} không hợp lệ.`);
    }
    value = number;
  } else if (option.valueKind === 'json') {
    try { value = JSON.parse(rawValue) as unknown; } catch { throw new Error(`Trạng thái của hành động ${order + 1} phải là JSON hợp lệ.`); }
    if (!value || Array.isArray(value) || typeof value !== 'object' || !Object.keys(value).length) {
      throw new Error(`Trạng thái của hành động ${order + 1} phải là một đối tượng JSON không rỗng.`);
    }
  }

  return { targetDeviceId: device.id, action: option.code as SceneActionType, value, order };
}

export function formatSceneAction(action: SceneActionResponse): string {
  const label = actionOptions.find((option) => option.code === action.action)?.label ?? action.action;
  if (action.value == null) return label;
  if (action.action === 'SET_BRIGHTNESS' || action.action === 'SET_SPEED') return `${label}: ${action.value}%`;
  if (action.action === 'SET_TEMPERATURE') return `${label}: ${action.value}°C`;
  return `${label}: ${JSON.stringify(action.value)}`;
}
