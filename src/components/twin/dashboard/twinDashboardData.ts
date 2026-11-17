import type { TwinDeviceSnapshotResponse, TwinSensorSnapshotResponse } from '../../../types/twin';
import { knownPower, sensorVisualKind } from '../twinPresentation';

export function deviceHealthCounts(devices: TwinDeviceSnapshotResponse[]) {
  const counts = { total: devices.length, online: 0, on: 0, off: 0, offline: 0, warning: 0, unknown: 0 };
  for (const device of devices) {
    const live = device.status === 'ONLINE';
    if (live) counts.online++;
    if (device.status === 'OFFLINE') counts.offline++;
    if (device.status === 'ERROR') counts.warning++;
    const power = live ? knownPower(device.currentState) : null;
    if (power === true) counts.on++;
    else if (power === false) counts.off++;
    else counts.unknown++;
  }
  return counts;
}

export type DashboardMetric = 'temperature' | 'humidity' | 'light' | 'motion';
const compatibleUnits: Record<DashboardMetric, readonly string[]> = {
  temperature: ['°c', 'c', 'celsius', '°f', 'f', 'fahrenheit', 'k'],
  humidity: ['%', '%rh', 'rh'],
  light: ['lux', 'lx'],
  motion: ['boolean', 'bool', ''],
};

/** Pick one actual reading, never average sensors with different locations or units. */
export function latestDashboardMetric(sensors: TwinSensorSnapshotResponse[], metric: DashboardMetric) {
  let latest: TwinSensorSnapshotResponse | undefined;
  for (const sensor of sensors) {
    if (sensor.healthStatus !== 'ACTIVE' || sensorVisualKind(sensor.metricType) !== metric || sensor.latestValue === null || !Number.isFinite(sensor.latestValue)) continue;
    const unit = sensor.unit?.trim().toLowerCase() ?? '';
    if (!compatibleUnits[metric].includes(unit)) continue;
    if (metric === 'motion' && sensor.latestValue !== 0 && sensor.latestValue !== 1) continue;
    const timestamp = sensor.observedAt ? Date.parse(sensor.observedAt) : NaN;
    if (!Number.isFinite(timestamp)) continue;
    if (!latest || timestamp > Date.parse(latest.observedAt!)) latest = sensor;
  }
  return latest;
}

export function deviceAlert(device: TwinDeviceSnapshotResponse) {
  if (device.status === 'ERROR') return 'Thiết bị báo lỗi';
  if (device.status === 'OFFLINE') return 'Thiết bị ngoại tuyến';
  return null;
}
