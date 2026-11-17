import type { TwinDeviceSnapshotResponse, TwinHealthStatus } from '../types/twin';

/** Compatibility health for shared sensor/device visuals; device status is authoritative. */
export function deviceConnectionHealth(device: Pick<TwinDeviceSnapshotResponse, 'status'>): TwinHealthStatus {
  return device.status === 'ONLINE' ? 'ACTIVE' : 'OFFLINE';
}
