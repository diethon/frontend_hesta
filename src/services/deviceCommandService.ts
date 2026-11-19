import { sendDeviceCommand } from './deviceApi';
import type { DeviceResponse } from '../types/device';

export interface TwinDeviceCommand { action: string; parameters?: Record<string, unknown> }

// Match DeviceServiceImpl.extractSupportedActions: an empty group is itself a
// capability declaration. Never infer actions from device type or appearance.
const groupActions: Readonly<Record<string, readonly string[]>> = {
  POWER: ['TURN_ON', 'TURN_OFF', 'TOGGLE'],
  BRIGHTNESS: ['SET_BRIGHTNESS'],
  COLOR: ['SET_RGB', 'SET_COLOR'], RGB: ['SET_RGB', 'SET_COLOR'],
  TEMPERATURE: ['SET_TEMPERATURE'], TEMP: ['SET_TEMPERATURE'],
  SPEED: ['SET_FAN', 'SET_SPEED'], FAN: ['SET_FAN', 'SET_SPEED'],
  MODE: ['SET_MODE'], GATE: ['OPEN', 'CLOSE', 'STOP'], DOOR: ['OPEN', 'CLOSE', 'STOP'],
};

export function twinDeviceActions(device: Pick<DeviceResponse, 'capabilities'>): string[] {
  return [...new Set(Object.entries(device.capabilities ?? {}).flatMap(([group, actions]) =>
    actions?.length ? actions : groupActions[group.trim().toUpperCase()] ?? [],
  ).map((action) => action.trim().toUpperCase()).filter(Boolean))];
}

export const deviceCommandService = {
  async execute(deviceId: string, command: TwinDeviceCommand) {
    const result = await sendDeviceCommand(deviceId, command.action, command.parameters);
    if (!result || !result.success || !['SUCCESS', 'ACKNOWLEDGED'].includes(result.status.toUpperCase())) {
      throw new Error(result?.message ?? 'Thiết bị chưa xác nhận lệnh. Hãy kiểm tra kết nối và thử lại.');
    }
    // ACK is feedback only. Device state remains owned by snapshot/WebSocket.
    return result;
  },
};
