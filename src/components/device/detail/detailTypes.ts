import type { DeviceResponse } from '../../../types/device';
import type { IconName } from '../../home/HomeIcons';

export type FigmaDeviceType = 'Đèn' | 'Điều hòa' | 'Cảm biến' | 'Cổng' | 'Công tắc' | 'Camera';

export interface CustomColorItem {
  id: string;
  name: string;
  hex: string;
  rgb?: [number, number, number];
}

export interface DetailDeviceRawExtras {
  manufacturer?: string;
  macAddress?: string;
  ipAddress?: string;
  protocol?: string;
  firmwareVersion?: string;
}

export interface DetailDeviceInput {
  id?: string;
  realDeviceId?: string;
  name?: string;
  room?: string;
  roomName?: string;
  roomId?: string;
  type?: FigmaDeviceType | string;
  deviceType?: string;
  icon?: IconName;
  status?: string;
  value?: string;
  on?: boolean;
  offline?: boolean;
  sensor?: boolean | string;
  brightness?: number;
  brand?: string;
  model?: string;
  serialNumber?: string;
  macAddress?: string;
  ipAddress?: string;
  firmwareVersion?: string;
  lastSeen?: string;
  manualOverrideUntil?: string | null;
  manualOverrideActive?: boolean;
  currentState?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  raw?: Partial<DeviceResponse> & DetailDeviceRawExtras;
}

export const lightColors = [
  '#f5d6a0',
  '#f1a991',
  '#d9b8f4',
  '#91b8f1',
  '#9ed9c2',
  '#fff1c9',
  '#d8e4ff',
  '#ffffff',
];

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  const num = parseInt(clean, 16) || 0;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function resolveFigmaDeviceType(device: DetailDeviceInput | null | undefined): FigmaDeviceType {
  if (!device) return 'Công tắc';
  const devName = (device.name || '').toLowerCase();
  const devTypeStr = (device.type || device.raw?.deviceType || device.deviceType || '').toUpperCase();

  if (
    devName.includes('bơm') ||
    devName.includes('pump') ||
    devTypeStr.includes('PUMP') ||
    devTypeStr.includes('WATER') ||
    devName.includes('quạt') ||
    devName.includes('ổ cắm') ||
    devName.includes('công tắc') ||
    devTypeStr.includes('SWITCH') ||
    devTypeStr.includes('RELAY') ||
    device.type === 'Công tắc'
  ) {
    return 'Công tắc';
  }
  if (
    device.type === 'Đèn' ||
    devTypeStr.includes('LIGHT') ||
    devTypeStr.includes('LED') ||
    (!device.type && devName.includes('đèn'))
  ) {
    return 'Đèn';
  }
  if (
    device.type === 'Điều hòa' ||
    devTypeStr.includes('AIR') ||
    devTypeStr.includes('CLIMATE') ||
    devTypeStr.includes('AC') ||
    devName.includes('điều hòa') ||
    devName.includes('casper')
  ) {
    return 'Điều hòa';
  }
  if (
    device.type === 'Cổng' ||
    devTypeStr.includes('GATE') ||
    devTypeStr.includes('DOOR') ||
    devName.includes('cổng')
  ) {
    return 'Cổng';
  }
  if (
    device.type === 'Cảm biến' ||
    device.sensor ||
    devTypeStr.includes('SENSOR') ||
    devTypeStr.includes('TEMP') ||
    devTypeStr.includes('HUMID') ||
    devTypeStr.includes('MOTION') ||
    devTypeStr.includes('LUX') ||
    devName.includes('cảm biến')
  ) {
    return 'Cảm biến';
  }
  if (device.type === 'Camera' || devTypeStr.includes('CAMERA') || devName.includes('camera')) {
    return 'Camera';
  }
  if (device.type) {
    return device.type as FigmaDeviceType;
  }
  if (device.icon === 'lamp') return 'Đèn';
  if (device.icon === 'snowflake') return 'Điều hòa';
  if (device.icon === 'door') return 'Cổng';
  if (device.icon === 'camera') return 'Camera';
  return 'Công tắc';
}

export function formatRelativeTime(dateString?: string): string {
  if (!dateString) return 'Chưa có dữ liệu';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Chưa có dữ liệu';
  const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 1) return 'Vừa xong';
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ngày trước`;
}
