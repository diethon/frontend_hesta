import type { DeviceSummary, RuleActionInput } from '../../types/automation';
import { getDeviceActions } from '../deviceActionOptions.ts';

export { actionOptions, getDeviceActions } from '../deviceActionOptions.ts';

export interface DraftAction { deviceId: string; sceneId?: string; action: string; value: string }

export function buildActionInput(item: DraftAction, order: number, devices: DeviceSummary[]): RuleActionInput {
  if (item.action === 'EXECUTE_SCENE') {
    if (!item.sceneId) throw new Error(`Vui lòng chọn kịch bản cho hành động ${order + 1}.`);
    return { sceneId: item.sceneId, action: 'EXECUTE_SCENE', parameters: {}, order };
  }
  const device = devices.find((candidate) => candidate.id === item.deviceId);
  if (!device) throw new Error(`Hành động ${order + 1} chưa chọn thiết bị.`);

  const rawAction = item.action.trim();
  const rawValue = item.value.trim();

  if (rawAction === 'SET_STATE') {
    let parameters: Record<string, unknown>;
    try {
      parameters = (typeof item.value === 'object' ? item.value : JSON.parse(rawValue)) as Record<string, unknown>;
    } catch {
      throw new Error(`Dữ liệu của hành động ${order + 1} phải là JSON hợp lệ.`);
    }
    if (!parameters || typeof parameters !== 'object' || !Object.keys(parameters).length) {
      throw new Error(`Dữ liệu của hành động ${order + 1} không được rỗng.`);
    }
    return { deviceId: device.id, action: 'SET_STATE', parameters, order };
  }

  const option = getDeviceActions(device).find((candidate) => candidate.code === item.action);
  if (!option) throw new Error(`Hành động ${order + 1} không phù hợp với thiết bị đã chọn.`);

  const value = item.value.trim();
  let parameters: Record<string, unknown> = {};
  if (option.valueKind === 'percentage' || option.valueKind === 'number') {
    const number = Number(value);
    if (!value || !Number.isFinite(number) || (option.valueKind === 'percentage' && (number < 0 || number > 100))) {
      throw new Error(`${option.valueLabel} của hành động ${order + 1} không hợp lệ.`);
    }
    parameters = { [option.parameterKey]: number };
  } else if (option.valueKind === 'color') {
    const colorVal = value || option.defaultValue || '#ffc107';
    parameters = { [option.parameterKey]: colorVal, hex: colorVal };
    // Try to extract RGB components if hex
    if (colorVal.startsWith('#') && (colorVal.length === 7 || colorVal.length === 4)) {
      const clean = colorVal.replace('#', '');
      const r = parseInt(clean.length === 3 ? clean[0] + clean[0] : clean.substring(0, 2), 16);
      const g = parseInt(clean.length === 3 ? clean[1] + clean[1] : clean.substring(2, 4), 16);
      const b = parseInt(clean.length === 3 ? clean[2] + clean[2] : clean.substring(4, 6), 16);
      if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
        parameters.r = r;
        parameters.g = g;
        parameters.b = b;
      }
    }
  } else if (option.valueKind === 'text') {
    if (!value) throw new Error(`Vui lòng nhập ${option.valueLabel?.toLowerCase()} cho hành động ${order + 1}.`);
    parameters = { [option.parameterKey]: value };
  } else if (option.valueKind === 'json') {
    let parsed: unknown;
    try { parsed = JSON.parse(value) as unknown; } catch { throw new Error(`Trạng thái của hành động ${order + 1} phải là JSON hợp lệ.`); }
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object' || !Object.keys(parsed).length) {
      throw new Error(`Trạng thái của hành động ${order + 1} phải là một đối tượng JSON không rỗng.`);
    }
    parameters = parsed as Record<string, unknown>;
  }
  return { deviceId: device.id, action: option.code, parameters, order };
}
