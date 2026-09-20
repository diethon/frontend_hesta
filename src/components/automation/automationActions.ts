import type { DeviceSummary, RuleActionInput } from '../../types/automation';
import { getDeviceActions } from '../deviceActionOptions.ts';

export { actionOptions, getDeviceActions } from '../deviceActionOptions.ts';

export interface DraftAction { deviceId: string; action: string; value: string }

export function buildActionInput(item: DraftAction, order: number, devices: DeviceSummary[]): RuleActionInput {
  const device = devices.find((candidate) => candidate.id === item.deviceId);
  const option = getDeviceActions(device).find((candidate) => candidate.code === item.action);
  if (!device || !option) throw new Error(`Hành động ${order + 1} không phù hợp với thiết bị đã chọn.`);

  const value = item.value.trim();
  let parameters: Record<string, unknown> = {};
  if (option.valueKind === 'percentage' || option.valueKind === 'number') {
    const number = Number(value);
    if (!value || !Number.isFinite(number) || (option.valueKind === 'percentage' && (number < 0 || number > 100))) {
      throw new Error(`${option.valueLabel} của hành động ${order + 1} không hợp lệ.`);
    }
    parameters = { [option.parameterKey]: number };
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
