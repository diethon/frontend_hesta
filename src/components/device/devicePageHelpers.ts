import type { DeviceResponse } from '../../types/device';
import type { FigmaDeviceType } from './DeviceDetailModal';
import type { IconName } from '../home/HomeIcons';
import {
  AC_MODE_CODE_TO_LABEL,
  extractSensorMetrics,
  resolveFanSpeedLevel,
} from './deviceHelpers';

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
  accessLevel?: 'NONE' | 'VIEW' | 'CONTROL';
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
  'Quạt',
  'TV',
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
  const isError = d.status === 'ERROR';
  const isOffline = d.status === 'OFFLINE' || isUnknown || isError || d.status === 'UNCLAIMED';
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
  const sensorMetrics = extractSensorMetrics(d.currentState);

  if (typeUpper === 'FAN' || typeUpper === 'SMART_FAN') {
    type = 'Quạt';
    icon = 'wind';
    const spd = resolveFanSpeedLevel(d.currentState);
    valueStr = isPowerOn && spd > 0 ? `Mức ${spd}` : undefined;
  } else if (typeUpper === 'TV' || typeUpper === 'SMART_TV') {
    type = 'TV';
    icon = 'tv';
  } else if (typeUpper.includes('FLAME')) {
    type = 'Cảm biến';
    icon = 'flame';
    isSensor = true;
    if (sensorMetrics.flame !== undefined) {
      valueStr = sensorMetrics.flame ? 'Phát hiện lửa!' : 'An toàn';
    }
  } else if (typeUpper.includes('LIGHT_SENSOR') || typeUpper.includes('LUX') || typeUpper.includes('SUN')) {
    type = 'Cảm biến';
    icon = 'sun';
    isSensor = true;
    valueStr =
      sensorMetrics.lux !== undefined
        ? `${sensorMetrics.lux} lx`
        : sensorMetrics.lightBinary !== undefined
          ? sensorMetrics.lightBinary
            ? 'Sáng'
            : 'Tối'
          : undefined;
  } else if ((typeUpper.includes('LIGHT') && !typeUpper.includes('SENSOR')) || typeUpper.includes('LED')) {
    type = 'Đèn';
    icon = 'lamp';
  } else if (
    typeUpper.includes('AIR') ||
    typeUpper.includes('CLIMATE') ||
    typeUpper === 'AC' ||
    typeUpper === 'AC_REMOTE' ||
    nameLower.includes('điều hòa') ||
    nameLower.includes('casper')
  ) {
    type = 'Điều hòa';
    icon = 'snowflake';
    const temp = d.currentState?.temperature;
    valueStr = temp !== undefined ? `${temp}°C` : undefined;
  } else if (
    typeUpper === 'DOOR' ||
    typeUpper.includes('GATE') ||
    typeUpper.includes('DOOR') ||
    typeUpper.includes('ROLLING') ||
    typeUpper.includes('CURTAIN') ||
    nameLower.includes('cổng') ||
    nameLower.includes('cửa cuốn') ||
    nameLower.includes('rèm')
  ) {
    type = 'Cổng';
    icon = 'door';
  } else if (typeUpper.includes('TEMP') || typeUpper.includes('HUMID')) {
    type = 'Cảm biến';
    icon = 'thermometer';
    isSensor = true;
    valueStr =
      sensorMetrics.temperature !== undefined
        ? `${sensorMetrics.temperature}°C`
        : sensorMetrics.humidity !== undefined
          ? `${sensorMetrics.humidity}%`
          : undefined;
  } else if (typeUpper.includes('MOTION')) {
    type = 'Cảm biến';
    icon = 'activity';
    isSensor = true;
    if (sensorMetrics.motion !== undefined) {
      valueStr = sensorMetrics.motion ? 'Chuyển động' : 'Tĩnh';
    }
  } else if (typeUpper.includes('SMOKE') || typeUpper.includes('GAS')) {
    type = 'Cảm biến';
    icon = 'shield';
    isSensor = true;
    if (sensorMetrics.gasPpm !== undefined) {
      valueStr = `${sensorMetrics.gasPpm} ppm`;
    } else if (sensorMetrics.smoke !== undefined) {
      valueStr =
        typeof sensorMetrics.smoke === 'number'
          ? `${sensorMetrics.smoke} ppm`
          : sensorMetrics.smoke
            ? 'Cảnh báo'
            : 'An toàn';
    }
  } else if (typeUpper.includes('FLAME')) {
    type = 'Cảm biến';
    icon = 'flame';
    isSensor = true;
    if (sensorMetrics.flame !== undefined) {
      valueStr = sensorMetrics.flame ? 'Phát hiện lửa!' : 'An toàn';
    }
  } else if (typeUpper.includes('CAMERA')) {
    type = 'Camera';
    icon = 'camera';
  } else if (typeUpper.includes('PUMP') || nameLower.includes('bơm')) {
    type = 'Công tắc';
    icon = 'droplet';
  } else if (nameLower.includes('quạt')) {
    type = 'Công tắc';
    icon = 'wind';
  } else if (typeUpper.includes('LOCK') || nameLower.includes('khóa')) {
    type = 'Công tắc';
    icon = 'lock';
  } else {
    type = 'Công tắc';
    icon = 'automation';
  }

  // Construct status text
  let statusText = isUnknown ? 'Không xác định' : isError ? 'Lỗi thiết bị' : isOffline ? 'Ngoại tuyến' : isPowerOn ? 'Đang bật' : 'Tắt';
  if (isOnline) {
    if (type === 'Đèn') {
      statusText = isPowerOn ? `Đang bật · ${brightness}%` : 'Đã tắt';
    } else if (type === 'Điều hòa') {
      const modeCode = String(d.currentState?.mode ?? 'COOL').toUpperCase();
      const modeLabel = AC_MODE_CODE_TO_LABEL[modeCode] ?? (typeof d.currentState?.mode === 'string' ? d.currentState.mode : 'Lạnh');
      statusText = isPowerOn ? `${modeLabel} · ${d.currentState?.temperature ?? 24}°C` : 'Đã tắt';
    } else if (type === 'Cảm biến' && icon === 'thermometer') {
      statusText =
        sensorMetrics.humidity !== undefined
          ? `Độ ẩm ${sensorMetrics.humidity}%`
          : sensorMetrics.temperature !== undefined
            ? `Nhiệt độ ${sensorMetrics.temperature}°C`
            : 'Chưa có dữ liệu';
    } else if (type === 'Cảm biến' && icon === 'sun') {
      if (sensorMetrics.lightBinary !== undefined) {
        statusText = sensorMetrics.lightBinary ? 'Trời sáng' : 'Trời tối';
      } else {
        statusText = 'Chưa có dữ liệu';
      }
    } else if (type === 'Cảm biến' && icon === 'flame') {
      statusText = sensorMetrics.flame ? 'Cảnh báo cháy!' : 'An toàn';
    } else if (type === 'Cảm biến' && icon === 'shield') {
      const smokeAlert =
        typeof sensorMetrics.smoke === 'boolean'
          ? sensorMetrics.smoke
          : typeof sensorMetrics.smoke === 'number'
            ? sensorMetrics.smoke > 50
            : false;
      const gasAlert = (sensorMetrics.gasPpm ?? 0) > 200;
      statusText = smokeAlert || gasAlert ? 'Cảnh báo khói/gas!' : 'An toàn';
    } else if (type === 'Cảm biến' && icon === 'activity') {
      statusText = sensorMetrics.motion === undefined ? 'Chưa có dữ liệu' : sensorMetrics.motion ? 'Có chuyển động' : 'Không có chuyển động';
    } else if (type === 'Cảm biến') {
      statusText = 'Bình thường';
    } else if (typeUpper.includes('PUMP') || nameLower.includes('bơm')) {
      statusText = isPowerOn ? 'Đang bơm nước' : 'Đã dừng';
    } else if (typeUpper === 'FAN' || nameLower.includes('quạt')) {
      const fanSpeed = resolveFanSpeedLevel(d.currentState);
      statusText = isPowerOn ? (fanSpeed > 0 ? `Đang bật · Mức ${fanSpeed}` : 'Đang bật') : 'Đã tắt';
    } else if (typeUpper === 'TV') {
      const ch = d.currentState?.channel;
      statusText = isPowerOn ? (ch !== undefined ? `Đang bật · Kênh ${ch}` : 'Đang bật') : 'Đã tắt';
    } else if (type === 'Cổng') {
      const gateStr = String(d.currentState?.state ?? '').trim().toUpperCase();
      if (gateStr === 'OPENING') statusText = 'Đang mở...';
      else if (gateStr === 'CLOSING') statusText = 'Đang đóng...';
      else if (gateStr === 'OPEN') statusText = 'Đã mở';
      else if (gateStr === 'CLOSED' || gateStr === 'CLOSE') statusText = 'Đã đóng';
      else if (gateStr === 'STOPPED' || gateStr === 'STOP') statusText = 'Đã dừng';
      else statusText = 'Sẵn sàng';
    } else if (type === 'Quạt') {
      const fanSpeed = resolveFanSpeedLevel(d.currentState);
      statusText = isPowerOn ? (fanSpeed > 0 ? `Đang bật · Mức ${fanSpeed}` : 'Đang bật') : 'Đã tắt';
    } else if (type === 'TV') {
      const ch = d.currentState?.channel;
      statusText = isPowerOn ? (ch !== undefined ? `Đang bật · Kênh ${ch}` : 'Đang bật') : 'Đã tắt';
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
    accessLevel: d.accessLevel,
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
    case 'Quạt':
      return 'sky';
    case 'TV':
      return 'violet';
    case 'Công tắc':
    default:
      return 'indigo';
  }
}
