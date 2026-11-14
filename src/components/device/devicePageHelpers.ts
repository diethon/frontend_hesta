import type { DeviceResponse } from '../../types/device';
import type { FigmaDeviceType } from './DeviceDetailModal';
import type { IconName } from '../home/HomeIcons';

export interface UIMappedDevice {
  id: string;
  name: string;
  room: string;
  roomId?: string;
  type: FigmaDeviceType;
  icon: IconName;
  status: string;
  value?: string;
  on?: boolean;
  offline?: boolean;
  sensor?: boolean;
  brightness?: number;
  manualOverrideUntil?: string | null;
  manualOverrideActive?: boolean;
  raw?: DeviceResponse;
}

export const SORT_OPTIONS = [
  'Nhóm theo phòng',
  'Nhóm theo loại',
  'Tên A–Z',
  'Trạng thái (đang bật trước)',
  'Gần đây nhất',
] as const;

export type DeviceSortOption = (typeof SORT_OPTIONS)[number];

export const DEVICE_TYPE_FILTER_OPTIONS = [
  'Tất cả',
  'Đèn',
  'Điều hòa',
  'Cảm biến',
  'Cổng',
  'Công tắc',
  'Camera',
] as const;

export type DeviceTypeFilterOption = (typeof DEVICE_TYPE_FILTER_OPTIONS)[number];

export function mapDeviceToUI(
  d: DeviceResponse,
  localPower: Record<string, boolean>,
  localBrightness: Record<string, number>
): UIMappedDevice {
  const isOnline = d.status === 'ONLINE';
  const isUnknown = d.status === 'UNKNOWN';
  const isOffline = d.status === 'OFFLINE' || isUnknown;
  const isPowerOn =
    localPower[d.id] !== undefined
      ? localPower[d.id]
      : d.currentState?.power === 'ON' ||
        d.currentState?.power === true ||
        d.currentState?.power === 'true';

  let type: FigmaDeviceType;
  let icon: IconName;
  let isSensor = false;
  let valueStr: string | undefined;
  const brightness =
    localBrightness[d.id] ??
    (d.currentState?.brightness ? Number(d.currentState.brightness) : 80);

  const typeUpper = (d.deviceType || '').toUpperCase();
  const nameLower = (d.name || '').toLowerCase();

  if (typeUpper.includes('LIGHT') || typeUpper.includes('LED')) {
    type = 'Đèn';
    icon = 'lamp';
  } else if (
    typeUpper.includes('AIR') ||
    typeUpper.includes('CLIMATE') ||
    typeUpper.includes('AC') ||
    nameLower.includes('điều hòa') ||
    nameLower.includes('casper')
  ) {
    type = 'Điều hòa';
    icon = 'snowflake';
    const temp = d.currentState?.temperature;
    valueStr = temp !== undefined ? `${temp}°C` : undefined;
  } else if (
    typeUpper.includes('GATE') ||
    typeUpper.includes('ROLLING') ||
    nameLower.includes('cổng')
  ) {
    type = 'Cổng';
    icon = 'door';
  } else if (typeUpper.includes('TEMP') || typeUpper.includes('HUMID')) {
    type = 'Cảm biến';
    icon = 'thermometer';
    isSensor = true;
    const temp = d.currentState?.temperature;
    valueStr = temp !== undefined ? `${temp}°C` : undefined;
  } else if (
    typeUpper.includes('LUX') ||
    typeUpper.includes('SUN') ||
    typeUpper.includes('LIGHT_SENSOR')
  ) {
    type = 'Cảm biến';
    icon = 'sun';
    isSensor = true;
    const lux = d.currentState?.lux;
    valueStr =
      lux !== undefined
        ? `${lux} lx`
        : d.currentState?.LIGHT_SENSOR !== undefined
        ? Number(d.currentState.LIGHT_SENSOR) === 1
          ? 'Sáng'
          : 'Tối'
        : undefined;
  } else if (typeUpper.includes('MOTION')) {
    type = 'Cảm biến';
    icon = 'activity';
    isSensor = true;
    valueStr = d.currentState?.motion ? 'Chuyển động' : 'Tĩnh';
  } else if (typeUpper.includes('SMOKE')) {
    type = 'Cảm biến';
    icon = 'shield';
    isSensor = true;
    valueStr = d.currentState?.smoke ? 'Cảnh báo' : 'An toàn';
  } else if (typeUpper.includes('CAMERA')) {
    type = 'Camera';
    icon = 'camera';
  } else if (nameLower.includes('bơm')) {
    type = 'Công tắc';
    icon = 'droplet';
  } else if (typeUpper.includes('LOCK') || nameLower.includes('khóa')) {
    type = 'Công tắc';
    icon = 'lock';
  } else {
    type = 'Công tắc';
    icon = 'automation';
  }

  // Construct status text
  let statusText = isUnknown ? 'Không xác định' : isOffline ? 'Ngoại tuyến' : isPowerOn ? 'Đang bật' : 'Tắt';
  if (isOnline) {
    if (type === 'Đèn') {
      statusText = isPowerOn ? `Đang bật · ${brightness}%` : 'Đã tắt';
    } else if (type === 'Điều hòa') {
      statusText = isPowerOn ? 'Lạnh · Quạt tự động' : 'Đã tắt';
    } else if (type === 'Cảm biến' && icon === 'thermometer') {
      const hum = d.currentState?.humidity;
      statusText =
        hum !== undefined
          ? `Độ ẩm ${hum}%`
          : d.currentState?.temperature !== undefined
          ? `Nhiệt độ ${d.currentState.temperature}°C`
          : 'Chưa có dữ liệu';
    } else if (type === 'Cảm biến' && icon === 'sun') {
      if (d.currentState?.lux !== undefined) {
        statusText = Number(d.currentState.lux) > 200 ? 'Trời sáng' : 'Trời tối';
      } else if (d.currentState?.LIGHT_SENSOR !== undefined) {
        statusText =
          Number(d.currentState.LIGHT_SENSOR) === 1 ? 'Trời sáng' : 'Trời tối';
      } else {
        statusText = 'Chưa có dữ liệu';
      }
    } else if (type === 'Cảm biến') {
      statusText = 'Bình thường';
    } else if (type === 'Cổng') {
      statusText = isPowerOn ? 'Đang mở' : 'Đã dừng';
    }
  }

  // Merge local custom wattage override if saved
  let mergedSettings = d.settings;
  if (typeof window !== 'undefined' && d.id) {
    const savedWatt = window.localStorage.getItem(`hesta_wattage_${d.id}`);
    if (savedWatt !== null && !Number.isNaN(Number(savedWatt)) && Number(savedWatt) > 0) {
      mergedSettings = { ...(d.settings || {}), wattage: Number(savedWatt) };
    }
  }
  const normalizedDevice: DeviceResponse = mergedSettings !== d.settings ? { ...d, settings: mergedSettings } : d;

  return {
    id: d.id,
    name: d.name,
    room: d.roomName || 'Chưa phân phòng',
    roomId: d.roomId || undefined,
    type,
    icon,
    status: statusText,
    value: valueStr,
    on: isPowerOn,
    offline: isOffline,
    sensor: isSensor,
    brightness,
    manualOverrideUntil: d.manualOverrideUntil,
    manualOverrideActive:
      d.manualOverrideActive ??
      (d.manualOverrideUntil
        ? new Date(d.manualOverrideUntil).getTime() > Date.now()
        : false),
    raw: normalizedDevice,
  };
}

export function formatLastSeenVi(dateStr?: string | null): string {
  if (!dateStr) return 'Chưa có dữ liệu';
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  if (isNaN(diffMs)) return 'Chưa có dữ liệu';
  if (diffMs < 45000) return 'vừa xong';
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} ngày trước`;
  return `${Math.floor(diffDays / 30)} tháng trước`;
}

export function getDeviceRatedWattage(
  device: UIMappedDevice,
  breakdownWattage?: number
): number {
  // 1. raw.settings.wattage
  const settingsWattage =
    device.raw?.settings?.wattage ??
    device.raw?.settings?.ratedPowerWatts ??
    device.raw?.settings?.powerWatts;

  if (typeof settingsWattage === 'number' && settingsWattage > 0) {
    return settingsWattage;
  }
  if (
    typeof settingsWattage === 'string' &&
    !isNaN(Number(settingsWattage)) &&
    Number(settingsWattage) > 0
  ) {
    return Number(settingsWattage);
  }

  // 2. 24H breakdown wattage
  if (typeof breakdownWattage === 'number' && breakdownWattage > 0) {
    return breakdownWattage;
  }

  // 3. Fallbacks: 750 for 'Điều hòa', 0 for sensors/camera, 40 otherwise
  if (device.type === 'Điều hòa') {
    return 750;
  }
  if (device.sensor || device.type === 'Cảm biến' || device.type === 'Camera') {
    return 0;
  }
  return 40;
}

export function formatWattage(watts: number): string {
  if (watts >= 1000) {
    const kw = watts / 1000;
    return `${kw >= 10 ? kw.toFixed(1) : (Math.round(kw * 10) / 10).toFixed(1)} kW`;
  }
  return `${Math.round(watts)} W`;
}

export function getDeviceTypeColorClass(type: FigmaDeviceType): string {
  switch (type) {
    case 'Đèn':
      return 'amber';
    case 'Điều hòa':
      return 'sky';
    case 'Cảm biến':
      return 'emerald';
    case 'Cổng':
      return 'violet';
    case 'Camera':
      return 'slate';
    case 'Công tắc':
    default:
      return 'indigo';
  }
}
