import { sendDeviceCommand, sendManualPowerCommand } from './deviceApi';
import type { DeviceResponse } from '../types/device';

export interface TwinDeviceCommand { action: string; parameters?: Record<string, unknown> }

export function twinDeviceActions(device: Pick<DeviceResponse, 'capabilities'>): string[] {
  return [...new Set(Object.values(device.capabilities ?? {}).flat().map((action) => action.trim().toUpperCase()))];
}

export const deviceCommandService = {
  async execute(deviceId: string, command: TwinDeviceCommand) {
    // Power uses the existing manual override endpoint, matching the Device page.
    const result = command.action === 'TURN_ON' || command.action === 'TURN_OFF'
      ? (await sendManualPowerCommand(deviceId, command.action)).command
      : await sendDeviceCommand(deviceId, command.action, command.parameters);
    if (!result || !result.success || !['SUCCESS', 'ACKNOWLEDGED'].includes(result.status.toUpperCase())) {
      throw new Error(result?.message ?? 'Thiết bị chưa xác nhận lệnh. Hãy kiểm tra kết nối và thử lại.');
    }
    // ACK is feedback only. Device state remains owned by snapshot/WebSocket.
    return result;
  },
};
