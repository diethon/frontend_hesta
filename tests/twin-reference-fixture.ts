import type { TwinHomeSnapshotResponse, TwinDeviceSnapshotResponse, TwinSensorSnapshotResponse } from '../src/types/twin';
import type { TwinLayout } from '../src/types/twinLayout';

const homeId = '00000000-0000-4000-8000-000000000001';
const roomIds = ['living', 'bedroom', 'kitchen', 'bathroom'];
const device = (id: string, name: string, deviceType: TwinDeviceSnapshotResponse['deviceType'], roomId: string): TwinDeviceSnapshotResponse => ({ deviceId: id, name, deviceType, roomId, icon: null, status: 'ONLINE', currentState: { power: 'ON' }, lastSeen: '2026-09-18T08:00:00Z', healthStatus: 'ACTIVE' });
const sensor = (id: string, metricType: string, latestValue: number, unit: string, roomId: string, healthStatus: TwinSensorSnapshotResponse['healthStatus'] = 'ACTIVE'): TwinSensorSnapshotResponse => ({ sensorId: id, deviceId: id, roomId, metricType, latestValue, unit, healthStatus, observedAt: '2026-09-18T08:00:00Z' });
export const referenceSnapshot: TwinHomeSnapshotResponse = {
  homeId, name: 'Nhà mẫu · 4 phòng', unassignedDevices: [], unassignedSensors: [],
  rooms: [
    { roomId: roomIds[0], homeId, name: 'Phòng khách', icon: null, devices: [device('main-light', 'Đèn chính', 'LIGHT', roomIds[0])], sensors: [sensor('temperature', 'TEMPERATURE', 29, '°C', roomIds[0], 'STALE')] },
    { roomId: roomIds[1], homeId, name: 'Phòng ngủ', icon: null, devices: [device('ac', 'Điều hòa', 'AC', roomIds[1])], sensors: [sensor('humidity-bedroom', 'HUMIDITY', 65, '%', roomIds[1])] },
    { roomId: roomIds[2], homeId, name: 'Nhà bếp', icon: null, devices: [device('kitchen-light', 'Đèn bếp', 'LIGHT', roomIds[2])], sensors: [sensor('smoke', 'SMOKE', 0, 'ppm', roomIds[2], 'OFFLINE')] },
    { roomId: roomIds[3], homeId, name: 'Phòng tắm', icon: null, devices: [], sensors: [sensor('humidity-bathroom', 'HUMIDITY', 72, '%', roomIds[3])] },
  ],
};
export const referenceLayout: TwinLayout = {
  homeId, revision: 1,
  rooms: roomIds.map((roomId, i) => ({ roomId, x: i % 2 ? 0.54 : 0.08, y: i > 1 ? 0.53 : 0.08, width: i % 2 ? 0.38 : 0.46, height: i > 1 ? 0.39 : 0.45 })),
  nodes: [
    { nodeType: 'DEVICE', nodeId: 'main-light', roomId: roomIds[0], x: 0.18, y: 0.34 },
    { nodeType: 'SENSOR', nodeId: 'temperature', roomId: roomIds[0], x: 0.43, y: 0.3 },
    { nodeType: 'DEVICE', nodeId: 'ac', roomId: roomIds[1], x: 0.61, y: 0.43 },
    { nodeType: 'SENSOR', nodeId: 'humidity-bedroom', roomId: roomIds[1], x: 0.85, y: 0.4 },
    { nodeType: 'DEVICE', nodeId: 'kitchen-light', roomId: roomIds[2], x: 0.18, y: 0.83 },
    { nodeType: 'SENSOR', nodeId: 'smoke', roomId: roomIds[2], x: 0.47, y: 0.82 },
    { nodeType: 'SENSOR', nodeId: 'humidity-bathroom', roomId: roomIds[3], x: 0.85, y: 0.82 },
  ],
};
