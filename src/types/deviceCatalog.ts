import type { DeviceResponse } from '../types/device';

export interface DeviceCatalog {
  id: string;
  name: string;
  deviceType: string;
  modelCode: string;
  serialPrefix: string;
  description?: string;
  imageUrl?: string;
  icon?: string;
  defaultCapabilities?: Record<string, string[]>;
  isActive: boolean;
  totalDeviceCount: number;
  unclaimedCount: number;
  claimedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceCatalogRequest {
  name: string;
  deviceType: string;
  modelCode: string;
  serialPrefix: string;
  description?: string;
  imageUrl?: string;
  icon?: string;
  defaultCapabilities?: Record<string, string[]>;
}

export interface QrItem {
  device: DeviceResponse;
  qr: {
    payload: string;
    token: string;
    expiresAt: string;
    singleUse: boolean;
  };
}

export interface DeviceBatchGenerateQrRequest {
  catalogId: string;
  quantity: number;
  customName?: string;
}

export interface DeviceBatchGenerateQrResponse {
  catalog: DeviceCatalog;
  generatedCount: number;
  items: QrItem[];
}

export interface DeviceAdminStats {
  totalCatalogs: number;
  totalDevices: number;
  unclaimedDevices: number;
  claimedDevices: number;
  typeBreakdown: Record<string, number>;
}
