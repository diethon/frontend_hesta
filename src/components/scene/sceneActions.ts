import type { DeviceSummary } from '../../types/automation';
import type { SceneResponse, SceneActionResponse, SceneActionRequest, SceneActionType, UpdateSceneRequest, DeviceResponse } from '../../types/scene';
import { actionOptions } from '../deviceActionOptions.ts';
import { formatMultiActionSummary } from '../device/deviceMultiActionHelpers';

export type AnyDevice = DeviceSummary | DeviceResponse;

export interface DraftSceneAction { deviceId: string; action: string; value: string }

import { normalizeDeviceCapabilities } from '../device/deviceHelpers';

// Keep this list aligned with supported Scene actions.
const sceneActionCodes = [
  'TURN_ON',
  'TURN_OFF',
  'TOGGLE',
  'SET_BRIGHTNESS',
  'SET_COLOR',
  'SET_RGB',
  'SET_TEMPERATURE',
  'SET_SPEED',
  'OPEN',
  'CLOSE',
  'STOP',
  'SET_STATE',
] as const satisfies readonly SceneActionType[];

const attributeActionsByDeviceType: Record<string, Record<string, readonly string[]>> = {
  LIGHT: { power: ['TURN_ON', 'TURN_OFF', 'TOGGLE'], brightness: ['SET_BRIGHTNESS'] },
  LED: { power: ['TURN_ON', 'TURN_OFF', 'TOGGLE'], brightness: ['SET_BRIGHTNESS'] },
  LED_RGB: { power: ['TURN_ON', 'TURN_OFF', 'TOGGLE'], brightness: ['SET_BRIGHTNESS'], color: ['SET_RGB', 'SET_COLOR'], rgb: ['SET_RGB', 'SET_COLOR'] },
  FAN: { power: ['TURN_ON', 'TURN_OFF', 'TOGGLE'], speed: ['SET_SPEED'] },
  AC: { power: ['TURN_ON', 'TURN_OFF', 'TOGGLE'], temperature: ['SET_TEMPERATURE'], fanspeed: ['SET_SPEED'], speed: ['SET_SPEED'] },
  AIR_CONDITIONER: { power: ['TURN_ON', 'TURN_OFF', 'TOGGLE'], temperature: ['SET_TEMPERATURE'], fanspeed: ['SET_SPEED'], speed: ['SET_SPEED'] },
  SOCKET: { power: ['TURN_ON', 'TURN_OFF', 'TOGGLE'] },
  SMART_PLUG: { power: ['TURN_ON', 'TURN_OFF', 'TOGGLE'] },
  GATE: { gate: ['OPEN', 'CLOSE', 'STOP'] },
  ROLLING_DOOR: { gate: ['OPEN', 'CLOSE', 'STOP'] },
};

const defaultActionsByDeviceType: Record<string, readonly string[]> = {
  LIGHT: ['TURN_ON', 'TURN_OFF', 'TOGGLE', 'SET_BRIGHTNESS'],
  LED: ['TURN_ON', 'TURN_OFF', 'TOGGLE', 'SET_BRIGHTNESS'],
  LED_RGB: ['TURN_ON', 'TURN_OFF', 'TOGGLE', 'SET_BRIGHTNESS', 'SET_RGB', 'SET_COLOR'],
  FAN: ['TURN_ON', 'TURN_OFF', 'TOGGLE', 'SET_SPEED'],
  AC: ['TURN_ON', 'TURN_OFF', 'TOGGLE', 'SET_TEMPERATURE'],
  AIR_CONDITIONER: ['TURN_ON', 'TURN_OFF', 'TOGGLE', 'SET_TEMPERATURE'],
  SOCKET: ['TURN_ON', 'TURN_OFF', 'TOGGLE'],
  SMART_PLUG: ['TURN_ON', 'TURN_OFF', 'TOGGLE'],
  GATE: ['OPEN', 'CLOSE', 'STOP'],
  ROLLING_DOOR: ['OPEN', 'CLOSE', 'STOP'],
};

export function getSceneDeviceActions(device?: AnyDevice, allowedTypes: readonly SceneActionType[] = sceneActionCodes) {
  if (!device) return [];
  const deviceType = device.deviceType?.toUpperCase() ?? '';
  const actionsByAttribute = attributeActionsByDeviceType[deviceType] ?? {};
  const normalizedCaps = normalizeDeviceCapabilities((device as any).capabilities);

  let capabilities: string[] = [];
  if (Object.keys(normalizedCaps).length > 0) {
    capabilities = Object.values(normalizedCaps).flat();
    for (const key of Object.keys(normalizedCaps)) {
      const uKey = key.toUpperCase();
      if (uKey === 'POWER') capabilities.push('TURN_ON', 'TURN_OFF', 'TOGGLE');
      if (uKey === 'COLOR' || uKey === 'RGB') capabilities.push('SET_RGB', 'SET_COLOR');
      if (uKey === 'BRIGHTNESS') capabilities.push('SET_BRIGHTNESS');
      if (uKey === 'CLIMATE' || uKey === 'TEMPERATURE') capabilities.push('SET_TEMPERATURE');
      if (uKey === 'SPEED' || uKey === 'FAN') capabilities.push('SET_SPEED');
      if (uKey === 'GATE' || uKey === 'DOOR') capabilities.push('OPEN', 'CLOSE', 'STOP');
    }
  } else {
    capabilities = [...(defaultActionsByDeviceType[deviceType] ?? [])];
  }

  const supported = new Set<string>();
  for (const capability of capabilities) {
    const normalized = String(capability).trim().toUpperCase();
    if ((sceneActionCodes as readonly string[]).includes(normalized)) {
      supported.add(normalized);
    } else {
      for (const action of actionsByAttribute[String(capability).trim().toLowerCase()] ?? []) supported.add(action);
    }
  }
  supported.add('SET_STATE');
  return actionOptions.filter((option) => supported.has(option.code) && (allowedTypes.length === 0 || (allowedTypes as readonly string[]).includes(option.code)));
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

export function buildSceneActionInput(item: DraftSceneAction, order: number, devices: AnyDevice[], allowedTypes: readonly SceneActionType[] = sceneActionCodes): SceneActionRequest {
  const device = devices.find((candidate) => candidate.id === item.deviceId);
  if (!device) throw new Error(`Hành động ${order + 1} chưa chọn thiết bị.`);

  const rawAction = item.action.trim();
  const rawValue = item.value.trim();

  if (rawAction === 'SET_STATE') {
    let value: unknown;
    try {
      value = JSON.parse(rawValue) as unknown;
    } catch {
      throw new Error(`Dữ liệu của hành động ${order + 1} phải là JSON hợp lệ.`);
    }
    if (!value || Array.isArray(value) || typeof value !== 'object' || !Object.keys(value).length) {
      throw new Error(`Dữ liệu của hành động ${order + 1} không được rỗng.`);
    }
    return { targetDeviceId: device.id, action: 'SET_STATE', value, order };
  }

  const option = getSceneDeviceActions(device, allowedTypes).find((candidate) => candidate.code === item.action);
  if (!option) throw new Error(`Hành động ${order + 1} không phù hợp với thiết bị đã chọn.`);

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
  } else if (option.valueKind === 'text' || option.valueKind === 'color') {
    value = rawValue || (option.valueKind === 'color' ? (option.defaultValue || '#ffc107') : '');
  }

  return { targetDeviceId: device.id, action: option.code as SceneActionType, value, order };
}

export function formatSceneAction(action: SceneActionResponse, devices?: AnyDevice[]): string {
  if (action.action === 'SET_STATE') {
    const parsed = typeof action.value === 'string' ? (() => { try { return JSON.parse(action.value); } catch { return action.value; } })() : action.value;
    return formatMultiActionSummary(action.action, parsed, devices, action.targetDeviceId);
  }
  const label = actionOptions.find((option) => option.code === action.action)?.label ?? action.action;
  if (action.value == null || action.value === '') return label;
  if (action.action === 'SET_BRIGHTNESS' || action.action === 'SET_SPEED') return `${label}: ${action.value}%`;
  if (action.action === 'SET_TEMPERATURE') return `${label}: ${action.value}°C`;
  const act = action.action as string;
  if (act === 'SET_COLOR' || act === 'SET_RGB') return `${label}: ${action.value}`;
  if (act === 'SET_FAN' || act === 'SET_MODE') return `${label}: ${action.value}`;
  return `${label}: ${typeof action.value === 'object' ? JSON.stringify(action.value) : action.value}`;
}
