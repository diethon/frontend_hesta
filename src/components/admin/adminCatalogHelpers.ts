import type { DeviceCatalogRequest } from '../../types/deviceCatalog';

export interface DeviceTypeOption {
  value: string;
  label: string;
}

export interface CatalogDeviceTypeOption {
  value: string;
  label: string;
  prefix: string;
  icon: string;
}

export const DEVICE_TYPE_OPTIONS: DeviceTypeOption[] = [
  { value: 'ALL', label: 'Tất cả loại thiết bị' },
  { value: 'LED_RGB', label: 'Đèn LED RGB' },
  { value: 'LIGHT', label: 'Công tắc / Đèn relay' },
  { value: 'SMART_PLUG', label: 'Ổ cắm đo điện' },
  { value: 'FAN', label: 'Quạt thông minh' },
  { value: 'WATER_PUMP', label: 'Máy bơm nước' },
  { value: 'GATE_MOTOR', label: 'Motor cổng tự động' },
  { value: 'AC_REMOTE', label: 'Điều khiển điều hòa' },
  { value: 'TEMP_HUMID_SENSOR', label: 'Cảm biến nhiệt ẩm' },
  { value: 'MOTION_SENSOR', label: 'Cảm biến chuyển động' },
  { value: 'SMOKE_SENSOR', label: 'Cảm biến báo khói' },
  { value: 'CAMERA_AI', label: 'Camera AI' },
];

export const CATALOG_DEVICE_TYPES: CatalogDeviceTypeOption[] = [
  { value: 'LED_RGB', label: 'Đèn LED RGB', prefix: 'HESTA-RGB-', icon: 'lightbulb' },
  { value: 'LIGHT', label: 'Công tắc / Đèn relay', prefix: 'HESTA-SW-', icon: 'toggle-left' },
  { value: 'SMART_PLUG', label: 'Ổ cắm đo điện', prefix: 'HESTA-PLUG-', icon: 'plug' },
  { value: 'FAN', label: 'Quạt thông minh', prefix: 'HESTA-FAN-', icon: 'fan' },
  { value: 'WATER_PUMP', label: 'Máy bơm nước', prefix: 'HESTA-PUMP-', icon: 'droplet' },
  { value: 'GATE_MOTOR', label: 'Motor cổng tự động', prefix: 'HESTA-GATE-', icon: 'door-closed' },
  { value: 'AC_REMOTE', label: 'Điều khiển điều hòa', prefix: 'HESTA-AC-', icon: 'wind' },
  { value: 'TEMP_HUMID_SENSOR', label: 'Cảm biến nhiệt ẩm', prefix: 'HESTA-TH-', icon: 'thermometer' },
  { value: 'MOTION_SENSOR', label: 'Cảm biến chuyển động', prefix: 'HESTA-PIR-', icon: 'radar' },
  { value: 'SMOKE_SENSOR', label: 'Cảm biến báo khói', prefix: 'HESTA-SMOKE-', icon: 'flame' },
  { value: 'LUX_SENSOR', label: 'Cảm biến ánh sáng', prefix: 'HESTA-LUX-', icon: 'sun' },
  { value: 'IR_REMOTE', label: 'Điều khiển hồng ngoại', prefix: 'HESTA-IR-', icon: 'remote' },
  { value: 'CAMERA_AI', label: 'Camera AI', prefix: 'HESTA-CAM-', icon: 'camera' },
];

export function getFriendlyDeviceTypeName(deviceType: string): string {
  switch (deviceType) {
    case 'LED_RGB':
      return 'Đèn LED RGB';
    case 'LIGHT':
      return 'Công tắc / Đèn relay';
    case 'SMART_PLUG':
      return 'Ổ cắm đo điện';
    case 'FAN':
      return 'Quạt thông minh';
    case 'WATER_PUMP':
      return 'Máy bơm nước';
    case 'GATE_MOTOR':
      return 'Motor cổng tự động';
    case 'AC_REMOTE':
      return 'Điều khiển điều hòa';
    case 'TEMP_HUMID_SENSOR':
      return 'Cảm biến nhiệt ẩm';
    case 'MOTION_SENSOR':
      return 'Cảm biến chuyển động';
    case 'SMOKE_SENSOR':
      return 'Cảm biến báo khói';
    case 'LUX_SENSOR':
      return 'Cảm biến ánh sáng';
    case 'IR_REMOTE':
      return 'Điều khiển hồng ngoại';
    case 'CAMERA_AI':
      return 'Camera AI';
    default:
      return deviceType;
  }
}

export function isCatalogFormDirty(
  current: DeviceCatalogRequest,
  initial: DeviceCatalogRequest
): boolean {
  return (
    current.name.trim() !== initial.name.trim() ||
    current.deviceType !== initial.deviceType ||
    current.modelCode.trim() !== initial.modelCode.trim() ||
    current.serialPrefix.trim() !== initial.serialPrefix.trim() ||
    (current.description || '').trim() !== (initial.description || '').trim() ||
    (current.imageUrl || '') !== (initial.imageUrl || '')
  );
}
