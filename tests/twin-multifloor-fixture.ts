import type { TwinDeviceSnapshotResponse, TwinHomeSnapshotResponse, TwinSensorSnapshotResponse } from '../src/types/twin';
import type { TwinLayout } from '../src/types/twinLayout';

const homeId = '00000000-0000-4000-8000-000000000001';
const roomIds = {
  living: 'f1-living', kitchen: 'f1-kitchen', bath1: 'f1-bathroom',
  master: 'f2-master-bedroom', child: 'f2-child-bedroom', bath2: 'f2-bathroom',
  office: 'f3-office', terrace: 'f3-terrace',
};

const device = (id: string, name: string, deviceType: TwinDeviceSnapshotResponse['deviceType'], roomId: string, healthStatus: TwinDeviceSnapshotResponse['healthStatus'] = 'ACTIVE'): TwinDeviceSnapshotResponse => ({
  deviceId: id, name, deviceType, roomId, icon: null, status: healthStatus === 'OFFLINE' ? 'OFFLINE' : 'ONLINE', currentState: { power: healthStatus === 'OFFLINE' ? 'OFF' : 'ON' }, lastSeen: '2026-09-20T08:00:00Z', healthStatus,
});
const sensor = (id: string, metricType: string, latestValue: number, unit: string, roomId: string, healthStatus: TwinSensorSnapshotResponse['healthStatus'] = 'ACTIVE'): TwinSensorSnapshotResponse => ({
  sensorId: id, deviceId: id, roomId, metricType, latestValue, unit, healthStatus, observedAt: '2026-09-20T08:00:00Z',
});

export const multiFloorSnapshot: TwinHomeSnapshotResponse = {
  homeId,
  name: 'Nhà mẫu 3 tầng · 8 phòng',
  unassignedDevices: [],
  unassignedSensors: [],
  rooms: [
    { roomId: roomIds.living, homeId, name: 'Phòng khách · Tầng 1', icon: null, devices: [device('main-light', 'Đèn phòng khách', 'LIGHT', roomIds.living)], sensors: [sensor('temperature', 'TEMPERATURE', 27.5, '°C', roomIds.living)] },
    { roomId: roomIds.kitchen, homeId, name: 'Nhà bếp · Tầng 1', icon: null, devices: [device('kitchen-light', 'Đèn bếp', 'LIGHT', roomIds.kitchen)], sensors: [sensor('smoke-kitchen', 'SMOKE', 0, 'ppm', roomIds.kitchen)] },
    { roomId: roomIds.bath1, homeId, name: 'Phòng tắm · Tầng 1', icon: null, devices: [], sensors: [sensor('humidity-bath-1', 'HUMIDITY', 68, '%', roomIds.bath1)] },
    { roomId: roomIds.master, homeId, name: 'Phòng ngủ chính · Tầng 2', icon: null, devices: [device('master-ac', 'Điều hòa phòng chính', 'AC', roomIds.master)], sensors: [sensor('humidity-master', 'HUMIDITY', 61, '%', roomIds.master)] },
    { roomId: roomIds.child, homeId, name: 'Phòng ngủ nhỏ · Tầng 2', icon: null, devices: [device('child-light', 'Đèn phòng ngủ nhỏ', 'LIGHT', roomIds.child)], sensors: [sensor('temperature-child', 'TEMPERATURE', 26.8, '°C', roomIds.child)] },
    { roomId: roomIds.bath2, homeId, name: 'Phòng tắm · Tầng 2', icon: null, devices: [], sensors: [sensor('humidity-bath-2', 'HUMIDITY', 72, '%', roomIds.bath2, 'STALE')] },
    { roomId: roomIds.office, homeId, name: 'Phòng làm việc · Tầng 3', icon: null, devices: [device('office-light', 'Đèn làm việc', 'LIGHT', roomIds.office)], sensors: [sensor('office-temperature', 'TEMPERATURE', 28.1, '°C', roomIds.office)] },
    { roomId: roomIds.terrace, homeId, name: 'Sân thượng · Tầng 3', icon: null, devices: [device('terrace-light', 'Đèn sân thượng', 'LIGHT', roomIds.terrace, 'OFFLINE')], sensors: [sensor('outdoor-humidity', 'HUMIDITY', 74, '%', roomIds.terrace)] },
  ],
};

export const multiFloorLayout: TwinLayout = {
  homeId,
  revision: 1,
  rooms: [
    { roomId: roomIds.living, floor: 1, x: .05, y: .06, width: .54, height: .86 },
    { roomId: roomIds.kitchen, floor: 1, x: .61, y: .06, width: .34, height: .53 },
    { roomId: roomIds.bath1, floor: 1, x: .61, y: .62, width: .34, height: .3 },
    { roomId: roomIds.master, floor: 2, x: .05, y: .06, width: .54, height: .54 },
    { roomId: roomIds.child, floor: 2, x: .61, y: .06, width: .34, height: .54 },
    { roomId: roomIds.bath2, floor: 2, x: .61, y: .63, width: .34, height: .29 },
    { roomId: roomIds.office, floor: 3, x: .08, y: .09, width: .52, height: .72 },
    { roomId: roomIds.terrace, floor: 3, x: .62, y: .09, width: .3, height: .72 },
  ],
  nodes: [
    { nodeType: 'DEVICE', nodeId: 'main-light', roomId: roomIds.living, x: .25, y: .28 },
    { nodeType: 'SENSOR', nodeId: 'temperature', roomId: roomIds.living, x: .48, y: .35 },
    { nodeType: 'DEVICE', nodeId: 'kitchen-light', roomId: roomIds.kitchen, x: .72, y: .27 },
    { nodeType: 'SENSOR', nodeId: 'smoke-kitchen', roomId: roomIds.kitchen, x: .88, y: .45 },
    { nodeType: 'SENSOR', nodeId: 'humidity-bath-1', roomId: roomIds.bath1, x: .79, y: .78 },
    { nodeType: 'DEVICE', nodeId: 'master-ac', roomId: roomIds.master, x: .18, y: .24 },
    { nodeType: 'SENSOR', nodeId: 'humidity-master', roomId: roomIds.master, x: .49, y: .43 },
    { nodeType: 'DEVICE', nodeId: 'child-light', roomId: roomIds.child, x: .72, y: .24 },
    { nodeType: 'SENSOR', nodeId: 'temperature-child', roomId: roomIds.child, x: .88, y: .43 },
    { nodeType: 'SENSOR', nodeId: 'humidity-bath-2', roomId: roomIds.bath2, x: .78, y: .78 },
    { nodeType: 'DEVICE', nodeId: 'office-light', roomId: roomIds.office, x: .24, y: .33 },
    { nodeType: 'SENSOR', nodeId: 'office-temperature', roomId: roomIds.office, x: .5, y: .57 },
    { nodeType: 'DEVICE', nodeId: 'terrace-light', roomId: roomIds.terrace, x: .7, y: .29 },
    { nodeType: 'SENSOR', nodeId: 'outdoor-humidity', roomId: roomIds.terrace, x: .85, y: .62 },
  ],
};
