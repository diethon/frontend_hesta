import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, beforeEach, test } from 'node:test';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import { runInThisContext } from 'node:vm';
import React from 'react';
import { renderToString } from 'react-dom/server';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const modules = new Map();
globalThis.__viteEnv = { VITE_API_BASE_URL: 'http://backend.test/api/v1' };

function loadSource(path) {
  const filename = resolve(root, path);
  if (modules.has(filename)) return modules.get(filename).exports;
  const module = { exports: {} };
  modules.set(filename, module);
  const source = readFileSync(filename, 'utf8').replaceAll('import.meta.env', 'globalThis.__viteEnv');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    fileName: filename,
  });
  const sourceRequire = (name) => {
    if (!name.startsWith('.')) return require(name);
    const base = resolve(dirname(filename), name);
    const dependencyPath = ['.ts', '.tsx'].map((extension) => base + extension).find(existsSync);
    assert.ok(dependencyPath, `Cannot resolve ${name} from ${path}`);
    return loadSource(dependencyPath);
  };
  runInThisContext(`(function(require, module, exports) { ${outputText}\n})`, { filename })(sourceRequire, module, module.exports);
  return module.exports;
}

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key) => key === 'accessToken' ? 'twin-test-token' : null,
} });
const { apiClient } = loadSource('src/services/apiClient.ts');
const twin = loadSource('src/store/twinSlice.ts');
const { createAppStore } = loadSource('src/store/store.ts');
const { currentHomeChanged } = loadSource('src/store/homeSlice.ts');
const { sessionEnded } = loadSource('src/store/authSlice.ts');
const rt = loadSource('src/store/realtimeSlice.ts');
const { SharedRealtimeClient } = loadSource('src/realtime/realtimeClient.ts');
const { parseRealtimeEvent } = loadSource('src/realtime/realtimeTypes.ts');
const { isTwinEvent } = loadSource('src/realtime/twinEvents.ts');
const { DigitalTwinView } = loadSource('src/components/twin/DigitalTwinPage.tsx');
const nav = loadSource('src/routes/navigation.ts');
const fixture = (name) => JSON.parse(readFileSync(resolve(root, `tests/fixtures/twin/${name}.json`), 'utf8'));
const snapshot = fixture('twin-snapshot').result;
const sensorEvent = fixture('twin-sensor-event');
const deviceEvent = fixture('twin-device-event');
const healthEvent = fixture('twin-health-event');
const homeId = snapshot.homeId;
const sensorId = sensorEvent.data.sensorId;
const deviceId = deviceEvent.data.deviceId;
const later = '2026-09-17T09:01:00Z';
let requests;
const originalAdapter = apiClient.defaults.adapter;
const response = (config, result = snapshot) => ({ data: { code: 1000, result }, status: 200, statusText: 'OK', headers: {}, config });
beforeEach(() => {
  requests = [];
  apiClient.defaults.adapter = async (config) => { requests.push(config); return response(config); };
});
after(() => {
  apiClient.defaults.adapter = originalAdapter;
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else delete globalThis.localStorage;
});
function open(store, id = homeId) {
  store.dispatch(currentHomeChanged(id));
  store.dispatch(twin.twinOpened(id));
}
async function ready() {
  const store = createAppStore(); open(store);
  await store.dispatch(twin.loadTwinSnapshot(homeId));
  return store;
}
const emit = (store, event) => store.dispatch(rt.realtimeEventReceived(parseRealtimeEvent(event)));
const { executeTwinCommand } = loadSource('src/store/twinCommandSlice.ts');
const { twinDeviceActions } = loadSource('src/services/deviceCommandService.ts');
const { adaptTwinDevice, adaptTwinHouse, roomHeatmapReading } = loadSource('src/services/twinAdapter.ts');

test('Twin Adapter preserves HESTA state and suppresses active effects on offline devices', () => {
  const device = { ...deviceEvent.data, currentState: { power: 'ON', brightness: 80 } };
  const view = adaptTwinDevice(device);
  assert.equal(view.id, deviceId);
  assert.equal(view.type, device.deviceType);
  assert.equal(view.state, device.currentState);
  assert.equal(view.powered, true);
  assert.equal(adaptTwinDevice({ ...device, status: 'OFFLINE' }).powered, false);
  assert.equal(adaptTwinDevice({ ...device, healthStatus: 'STALE' }).powered, false);
  assert.equal(adaptTwinDevice({ ...device, currentState: null }).powered, false);
});

test('Twin controls derive actions only from declared capabilities, never guess from device type', () => {
  assert.deepEqual(twinDeviceActions({ deviceType: 'LIGHT' }), []);
  assert.deepEqual(twinDeviceActions({ capabilities: { POWER: ['turn_on', 'TURN_OFF'], LIGHT: ['TURN_ON', 'SET_BRIGHTNESS'] } }), ['TURN_ON', 'TURN_OFF', 'SET_BRIGHTNESS']);
});

test('Twin commands prevent duplicates, wait for ACK and do not overwrite confirmed runtime', async () => {
  const store = await ready();
  const previous = store.getState().twin;
  let acknowledge;
  apiClient.defaults.adapter = (config) => {
    requests.push(config);
    return new Promise((resolve) => { acknowledge = () => resolve(response(config, { command: { success: true, status: 'SUCCESS' } })); });
  };
  const task = store.dispatch(executeTwinCommand({ homeId, deviceId, command: { action: 'TURN_ON' } }));
  await new Promise(setImmediate);
  assert.equal(store.getState().twinCommand.byId[deviceId].pending, true);
  assert.equal(store.getState().twin, previous);
  const duplicate = await store.dispatch(executeTwinCommand({ homeId, deviceId, command: { action: 'TURN_OFF' } }));
  assert.equal(duplicate.meta.condition, true);
  assert.equal(requests.length, 2); // initial snapshot + one command
  assert.equal(requests[1].url, `/devices/${deviceId}/commands`);
  assert.deepEqual(JSON.parse(requests[1].data), { action: 'TURN_ON' });
  emit(store, { ...deviceEvent, data: { ...deviceEvent.data, currentState: { power: 'OFF' }, lastSeen: later }, timestamp: later });
  const confirmed = store.getState().twin;
  acknowledge(); await task;
  assert.equal(store.getState().twinCommand.byId[deviceId].acknowledged, true);
  assert.equal(store.getState().twin, confirmed);
  assert.deepEqual(store.getState().twin.devicesById[deviceId].currentState, { power: 'OFF' });
});

test('advanced Twin commands preserve backend parameter names and expose MQTT timeout', async () => {
  const store = await ready();
  const previous = store.getState().twin;
  apiClient.defaults.adapter = async (config) => { requests.push(config); return response(config, { success: false, status: 'TIMEOUT', message: 'TIMEOUT_NO_ACK' }); };
  await store.dispatch(executeTwinCommand({ homeId, deviceId, command: { action: 'SET_BRIGHTNESS', parameters: { level: 75 } } }));
  assert.equal(requests[1].url, `/devices/${deviceId}/command`);
  assert.deepEqual(JSON.parse(requests[1].data), { action: 'SET_BRIGHTNESS', parameters: { level: 75 } });
  assert.equal(store.getState().twinCommand.byId[deviceId].pending, false);
  assert.equal(store.getState().twinCommand.byId[deviceId].error, 'TIMEOUT_NO_ACK');
  assert.equal(store.getState().twin, previous);
});

test('late command ACK after changing homes cannot restore feedback or device state', async () => {
  const store = await ready();
  let acknowledge;
  apiClient.defaults.adapter = (config) => new Promise((resolve) => { acknowledge = () => resolve(response(config, { success: true, status: 'SUCCESS' })); });
  const task = store.dispatch(executeTwinCommand({ homeId, deviceId, command: { action: 'SET_SPEED', parameters: { speed: 60 } } }));
  await new Promise(setImmediate);
  store.dispatch(currentHomeChanged('home-b')); store.dispatch(twin.twinOpened('home-b'));
  acknowledge(); await task;
  assert.deepEqual(store.getState().twinCommand.byId, {});
  assert.equal(store.getState().twin.homeId, 'home-b');
  assert.deepEqual(store.getState().twin.devicesById, {});
});

test('offline devices cannot send Twin commands', async () => {
  const store = await ready();
  emit(store, { ...deviceEvent, data: { ...deviceEvent.data, status: 'OFFLINE', lastSeen: later }, timestamp: later });
  const task = await store.dispatch(executeTwinCommand({ homeId, deviceId, command: { action: 'TURN_ON' } }));
  assert.equal(task.meta.condition, true);
  assert.equal(requests.length, 1);
});

test('heatmap chooses latest active reading and never mixes CO2, AQI or incompatible units', () => {
  const make = (metricType, latestValue, unit, healthStatus = 'ACTIVE', observedAt = later) => ({ ...sensorEvent.data, metricType, latestValue, unit, healthStatus, observedAt });
  assert.equal(roomHeatmapReading([make('TEMPERATURE', 90, '°F')], 'temperature'), null);
  assert.equal(roomHeatmapReading([make('TEMPERATURE', 28, '°C', 'STALE')], 'temperature'), null);
  assert.deepEqual(roomHeatmapReading([make('TEMPERATURE', 25, '°C', 'ACTIVE', '2026-09-17T08:00:00Z'), make('TEMPERATURE', 30, '°C')], 'temperature'), { value: 30, unit: '°C', ratio: .7 });
  assert.deepEqual(roomHeatmapReading([make('AIR_QUALITY', 30, 'AQI')], 'air-quality'), { value: 30, unit: 'AQI', ratio: .15 });
  assert.equal(roomHeatmapReading([make('CO2', 1200, 'ppm')], 'air-quality'), null);
  assert.deepEqual(roomHeatmapReading([make('CO2', 1200, 'ppm')], 'co2'), { value: 1200, unit: 'ppm', ratio: .5 });
  assert.equal(roomHeatmapReading([make('TEMPERATURE', 30, '°C')], 'normal'), null);
});

test('Twin House Adapter keeps explicit room IDs, separates storeys and never scatters missing devices', () => {
  const { createTwinDraftingMetadata } = loadSource('src/components/twin/twinDrafting.ts');
  const geometry = { rooms: [
    { roomId: 'living', x: .1, y: .1, width: .3, height: .3, floor: 1 },
    { roomId: 'bedroom', x: .1, y: .1, width: .3, height: .3, floor: 2 },
  ], nodes: [{ nodeType: 'DEVICE', nodeId: 'light', roomId: 'living', x: .2, y: .2 }] };
  const model = adaptTwinHouse(homeId, geometry, createTwinDraftingMetadata(), ['light', 'missing-position'], [], 'all', true);
  assert.deepEqual(model.floors.map((floor) => floor.rooms.map((room) => room.roomId)), [['living'], ['bedroom']]);
  assert.equal(model.floors.flatMap((floor) => floor.nodes).length, 1);
  assert.ok(model.floors[1].rooms[0].y > model.floors[0].rooms[0].y);
  assert.equal(adaptTwinHouse(homeId, geometry, createTwinDraftingMetadata(), ['light'], [], 2, false).floors[0].nodes.length, 0);
});

test('wall geometry leaves actual door/window openings without negative or overlapping solids', () => {
  const { wallSegments } = loadSource('src/components/twin/scene/wallGeometry.ts');
  const opening = { center: 0, object: { kind: 'DOOR', width: 1, height: 2 } };
  const segments = wallSegments(4, 2.5, [opening]);
  assert.equal(segments.length, 3);
  assert.ok(segments.every((part) => part.width > 0 && part.height > 0));
  assert.equal(segments.find((part) => part.x === 0).y, 2.25);
  const overlapped = wallSegments(4, 2.5, [opening, { ...opening, center: .25 }]);
  assert.ok(overlapped.every((part) => part.width > 0 && part.height > 0));
});

test('new backend device types keep realtime state and use an extensible view model', async () => {
  const store = await ready();
  const event = { ...deviceEvent, data: { ...deviceEvent.data, deviceType: 'FUTURE_HESTA_DEVICE', lastSeen: later }, timestamp: later };
  assert.equal(isTwinEvent(parseRealtimeEvent(event)), true);
  emit(store, event);
  assert.equal(adaptTwinDevice(store.getState().twin.devicesById[deviceId]).type, 'FUTURE_HESTA_DEVICE');
  assert.equal(requests.length, 1);
});
const render = (store, id = homeId) => renderToString(React.createElement(Provider, { store },
  React.createElement(MemoryRouter, null, React.createElement(DigitalTwinView, { homeId: id, initialMode: 'overview' }))));

const { DEVICE_TYPES } = loadSource('src/types/deviceVocabulary.ts');
const currentDeviceTypes = Object.values(DEVICE_TYPES);

test('GET twin retains every current device type, including node devices without rooms', async () => {
  const result = structuredClone(snapshot);
  result.unassignedDevices = currentDeviceTypes.map((deviceType, index) => ({
    ...deviceEvent.data, deviceId: `current-device-${index}`, roomId: null, deviceType,
  }));
  apiClient.defaults.adapter = async (config) => { requests.push(config); return response(config, result); };
  const store = await ready();
  const state = store.getState().twin;
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, `/homes/${homeId}/twin`);
  for (const [index, type] of currentDeviceTypes.entries()) {
    const id = `current-device-${index}`;
    assert.equal(state.devicesById[id].deviceType, type);
    assert.ok(state.unassignedDeviceIds.includes(id));
  }
});

test('realtime accepts every current device type without rewriting it or mixing sensor streams', async () => {
  const store = await ready();
  const sensors = structuredClone(store.getState().twin.sensorsById);
  for (const type of currentDeviceTypes) {
    const event = { ...deviceEvent, data: { ...deviceEvent.data, deviceType: type } };
    assert.equal(isTwinEvent(event), true, type);
    emit(store, event);
    assert.equal(store.getState().twin.devicesById[deviceId].deviceType, type);
  }
  assert.deepEqual(store.getState().twin.sensorsById, sensors);
  assert.equal(isTwinEvent({ ...deviceEvent, data: { ...deviceEvent.data, deviceType: 'INVALID_TYPE' } }), true); // generic renderer
  assert.equal(isTwinEvent({ ...deviceEvent, data: { ...deviceEvent.data, deviceType: ' ' } }), false);
});

test('device icons in twin distinguish the current sensor, plug, remote and camera types', () => {
  const { DeviceGlyph } = loadSource('src/components/twin/TwinVisualIcon.tsx');
  const icons = {
    LIGHT: 'lightbulb', LED_RGB: 'lightbulb', SMART_PLUG: 'plug-zap', IR_REMOTE: 'radio',
    TEMP_HUMID_SENSOR: 'thermometer', MOTION_SENSOR: 'activity', SMOKE_SENSOR: 'flame', CAMERA_AI: 'camera',
  };
  for (const [deviceType, icon] of Object.entries(icons)) {
    const html = renderToString(React.createElement(DeviceGlyph, { deviceType }));
    assert.ok(html.includes(`lucide-${icon}`), deviceType);
  }
});

test('backend snapshot normalizes rooms, devices and exact canonical sensor IDs; authenticated API uses code 1000', async () => {
  const store = await ready();
  const state = store.getState().twin;
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, `/homes/${homeId}/twin`);
  assert.equal(requests[0].headers.get('Authorization'), 'Bearer twin-test-token');
  assert.equal(state.home.name, 'My Home');
  assert.equal(state.roomIds.length, 2);
  assert.equal(state.deviceIds.length, 3);
  assert.equal(state.sensorIds.length, 3);
  assert.deepEqual(state.sensorsById[sensorId], sensorEvent.data);
  assert.deepEqual(state.roomsById[sensorEvent.data.roomId].sensorIds, snapshot.rooms[1].sensors.map((sensor) => sensor.sensorId));
  assert.deepEqual(state.unassignedDeviceIds, []);
  assert.equal(state.initialized, true);
});

test('one device event replaces exactly its node, leaves sensors/other devices untouched and accepts equal lastSeen', async () => {
  const store = await ready(); const before = store.getState().twin;
  emit(store, { ...deviceEvent, data: { ...deviceEvent.data, currentState: { power: false, mode: 'eco' }, healthStatus: 'STALE' } });
  const after = store.getState().twin;
  assert.deepEqual(after.devicesById[deviceId].currentState, { power: false, mode: 'eco' });
  assert.equal(after.devicesById[deviceId].status, 'ONLINE');
  assert.equal(after.devicesById[deviceId].healthStatus, 'STALE');
  for (const id of before.deviceIds.filter((id) => id !== deviceId)) assert.equal(after.devicesById[id], before.devicesById[id]);
  assert.equal(after.sensorsById, before.sensorsById);
  assert.equal(after.roomsById, before.roomsById);
  emit(store, { ...deviceEvent, data: { ...deviceEvent.data, lastSeen: '2026-09-17T08:00:00Z' } });
  assert.equal(store.getState().twin, after);
});

test('one sensor event changes only its node and rejects older observedAt without fetching', async () => {
  const store = await ready(); const before = store.getState().twin;
  emit(store, { ...sensorEvent, data: { ...sensorEvent.data, latestValue: 30, observedAt: later } });
  const after = store.getState().twin;
  assert.equal(after.sensorsById[sensorId].latestValue, 30);
  for (const id of before.sensorIds.filter((id) => id !== sensorId)) assert.equal(after.sensorsById[id], before.sensorsById[id]);
  assert.equal(after.devicesById, before.devicesById);
  assert.equal(after.roomsById, before.roomsById);
  emit(store, sensorEvent);
  assert.equal(store.getState().twin, after);
  assert.equal(requests.length, 1);
});

test('initial health remains authoritative; device room movement updates only its own membership', async () => {
  const data = structuredClone(snapshot);
  data.rooms[0].devices[0].healthStatus = 'STALE';
  data.rooms[1].sensors[1].healthStatus = 'OFFLINE';
  apiClient.defaults.adapter = async (config) => response(config, data);
  const store = await ready();
  assert.equal(store.getState().twin.devicesById[deviceId].healthStatus, 'STALE');
  assert.equal(store.getState().twin.sensorsById[sensorId].healthStatus, 'OFFLINE');
  const sensors = store.getState().twin.sensorsById;
  emit(store, { ...deviceEvent, data: { ...deviceEvent.data, roomId: null } });
  assert.deepEqual(store.getState().twin.unassignedDeviceIds, [deviceId]);
  assert.ok(!store.getState().twin.roomsById[deviceEvent.data.roomId].deviceIds.includes(deviceId));
  emit(store, { ...deviceEvent, data: { ...deviceEvent.data, roomId: snapshot.rooms[1].roomId } });
  assert.deepEqual(store.getState().twin.unassignedDeviceIds, []);
  assert.ok(store.getState().twin.roomsById[snapshot.rooms[1].roomId].deviceIds.includes(deviceId));
  assert.equal(store.getState().twin.sensorsById, sensors);
});

test('new exact-case sensor stream inserts in room then moves to unassigned without a fake room or reload', async () => {
  const store = await ready();
  const data = { ...sensorEvent.data, sensorId: `${sensorEvent.data.deviceId}:temperature`, metricType: 'temperature' };
  emit(store, { ...sensorEvent, data });
  assert.ok(store.getState().twin.roomsById[data.roomId].sensorIds.includes(data.sensorId));
  emit(store, { ...sensorEvent, data: { ...data, roomId: null, observedAt: later } });
  const state = store.getState().twin;
  assert.deepEqual(state.unassignedSensorIds, [data.sensorId]);
  assert.equal(state.roomIds.length, 2);
  assert.ok(!state.roomsById[data.roomId].sensorIds.includes(data.sensorId));
  assert.equal(state.sensorIds.filter((id) => id === data.sensorId).length, 1);
  assert.equal(requests.length, 1);
});

test('sensor ordering preserves backend microsecond precision and respects timezone offsets', async () => {
  const store = await ready();
  emit(store, { ...sensorEvent, data: { ...sensorEvent.data, latestValue: 31, observedAt: '2026-09-17T16:01:00.000002+07:00' } });
  emit(store, { ...sensorEvent, data: { ...sensorEvent.data, latestValue: 29, observedAt: '2026-09-17T09:01:00.000001Z' } });
  assert.equal(store.getState().twin.sensorsById[sensorId].latestValue, 31);
});

test('explicit resync preserves visible nodes during loading and replays events received in flight', async () => {
  const store = await ready(); let finish;
  apiClient.defaults.adapter = (config) => new Promise((resolve) => { finish = () => resolve(response(config)); });
  const request = store.dispatch(twin.loadTwinSnapshot(homeId));
  await new Promise(setImmediate);
  assert.match(render(store), /Ceiling light/);
  emit(store, { ...sensorEvent, data: { ...sensorEvent.data, latestValue: 32, observedAt: later } });
  finish(); await request;
  assert.equal(store.getState().twin.sensorsById[sensorId].latestValue, 32);
});

test('health evaluation order and delayed complete payloads cannot undo newer health; fresh activity recovers', async () => {
  const store = await ready();
  emit(store, healthEvent);
  emit(store, { ...healthEvent, data: { ...healthEvent.data, healthStatus: 'OFFLINE', evaluatedAt: later } });
  emit(store, healthEvent);
  emit(store, sensorEvent);
  assert.equal(store.getState().twin.sensorsById[sensorId].healthStatus, 'OFFLINE');
  emit(store, { ...sensorEvent, timestamp: later, data: { ...sensorEvent.data, observedAt: later } });
  assert.equal(store.getState().twin.sensorsById[sensorId].healthStatus, 'ACTIVE');
});

for (const nodeType of ['DEVICE', 'SENSOR']) test(`health event patches only one ${nodeType} health field`, async () => {
  const store = await ready(); const before = store.getState().twin;
  const key = nodeType === 'DEVICE' ? 'devicesById' : 'sensorsById';
  const nodeId = nodeType === 'DEVICE' ? deviceId : sensorId;
  emit(store, { ...healthEvent, data: { ...healthEvent.data, nodeType, nodeId, healthStatus: 'OFFLINE' } });
  const after = store.getState().twin;
  assert.deepEqual(after[key][nodeId], { ...before[key][nodeId], healthStatus: 'OFFLINE' });
  for (const id of Object.keys(before[key]).filter((id) => id !== nodeId)) assert.equal(before[key][id], after[key][id]);
  assert.equal(after[nodeType === 'DEVICE' ? 'sensorsById' : 'devicesById'], before[nodeType === 'DEVICE' ? 'sensorsById' : 'devicesById']);
  assert.equal(requests.length, 1);
});

test('old health cannot stale a fresh reading, and unknown nodes/wrong-home events are ignored', async () => {
  const store = await ready();
  emit(store, { ...sensorEvent, data: { ...sensorEvent.data, observedAt: later } });
  const before = store.getState().twin;
  emit(store, healthEvent);
  emit(store, { ...sensorEvent, homeId: 'other-home' });
  emit(store, { ...deviceEvent, homeId: 'other-home' });
  emit(store, { ...healthEvent, homeId: 'other-home' });
  emit(store, { ...healthEvent, data: { ...healthEvent.data, nodeId: 'missing' } });
  assert.equal(store.getState().twin, before);
});

test('unassigned and nullable snapshot nodes, device movement and empty currentState are supported', async () => {
  const data = { ...snapshot, rooms: [], unassignedDevices: [{ ...deviceEvent.data, roomId: null, lastSeen: null, currentState: null }], unassignedSensors: [{ ...sensorEvent.data, roomId: null, unit: null, observedAt: null }] };
  const normalized = twin.normalizeTwinSnapshot(data);
  assert.deepEqual(normalized.unassignedDeviceIds, [deviceId]);
  assert.deepEqual(normalized.unassignedSensorIds, [sensorId]);
  apiClient.defaults.adapter = async (config) => response(config, data);
  const store = await ready();
  const html = render(store);
  assert.match(html, /Chưa có phòng/);
  assert.match(html, /Chưa ghi nhận/);
  assert.match(html, /Chưa có dữ liệu/);
  assert.doesNotMatch(html, /undefined|null/);
});

test('switching homes hides old state immediately; late A response cannot overwrite B, including A-B-A', async () => {
  const pending = [];
  apiClient.defaults.adapter = (config) => new Promise((resolve) => pending.push({ config, resolve }));
  const store = createAppStore(); open(store);
  const first = store.dispatch(twin.loadTwinSnapshot(homeId));
  await new Promise(setImmediate);
  open(store, 'home-b');
  assert.equal(store.getState().twin.home, null);
  const second = store.dispatch(twin.loadTwinSnapshot('home-b'));
  await new Promise(setImmediate);
  pending[1].resolve(response(pending[1].config, { ...snapshot, homeId: 'home-b', name: 'Home B' }));
  await second;
  assert.doesNotMatch(render(store, homeId), /Home B/);
  open(store);
  const third = store.dispatch(twin.loadTwinSnapshot(homeId));
  await new Promise(setImmediate);
  pending[2].resolve(response(pending[2].config, { ...snapshot, name: 'Newest A' })); await third;
  pending[0].resolve(response(pending[0].config)); await first;
  assert.equal(store.getState().twin.home.name, 'Newest A');
  store.dispatch(sessionEnded());
  assert.deepEqual(store.getState().twin, twin.emptyTwinState());
});

test('events received during initial snapshot load are applied after normalization', async () => {
  let finish;
  apiClient.defaults.adapter = (config) => new Promise((resolve) => { finish = () => resolve(response(config)); });
  const store = createAppStore(); open(store);
  const request = store.dispatch(twin.loadTwinSnapshot(homeId));
  await new Promise(setImmediate);
  emit(store, { ...sensorEvent, data: { ...sensorEvent.data, latestValue: 30, observedAt: later } });
  finish(); await request;
  assert.equal(store.getState().twin.sensorsById[sensorId].latestValue, 30);
  assert.deepEqual(store.getState().twin.pendingEvents, []);
});

test('UI renders home/rooms/nodes, values, business state and all backend health statuses after events', async () => {
  const store = await ready();
  let html = render(store);
  for (const text of ['My Home', 'Living Room', 'Bedroom', 'Ceiling light', 'TEMPERATURE', '26.4', '°C', 'ONLINE', 'ON', 'ACTIVE', 'Lần thấy cuối', 'Cập nhật']) assert.ok(html.includes(text), text);
  emit(store, { ...sensorEvent, data: { ...sensorEvent.data, latestValue: 30, healthStatus: 'STALE' } });
  emit(store, { ...deviceEvent, data: { ...deviceEvent.data, currentState: { power: 'OFF' } } });
  emit(store, { ...healthEvent, data: { ...healthEvent.data, nodeType: 'DEVICE', nodeId: deviceId, healthStatus: 'OFFLINE' } });
  html = render(store);
  assert.match(html, />30</); assert.match(html, />OFF</);
  for (const health of ['ACTIVE', 'STALE', 'OFFLINE']) assert.ok(html.includes(health));
  assert.equal(requests.length, 1);
});

test('UI handles loading, safe error/retry, no rooms, empty rooms and disconnected/reconnecting states', async () => {
  const store = createAppStore(); open(store);
  assert.match(render(store), /Đang tải Digital Twin/);
  apiClient.defaults.adapter = async () => { throw new Error('private backend stack trace'); };
  await store.dispatch(twin.loadTwinSnapshot(homeId));
  assert.match(render(store), /role="alert"/); assert.match(render(store), /Thử lại/);
  assert.doesNotMatch(render(store), /private backend/);
  apiClient.defaults.adapter = async (config) => response(config, { ...snapshot, rooms: [{ ...snapshot.rooms[0], devices: [], sensors: [] }] });
  await store.dispatch(twin.loadTwinSnapshot(homeId));
  assert.match(render(store), /Chưa có thiết bị/); assert.match(render(store), /Chưa có dữ liệu cảm biến/);
  assert.match(render(store), /Không có thiết bị hoặc cảm biến chưa gán phòng/);
  store.dispatch(rt.connectionStatusChanged('reconnecting'));
  assert.match(render(store), /Đang kết nối lại/); assert.match(render(store), /Living Room/);
  store.dispatch(rt.connectionStatusChanged('connected'));
  store.dispatch(rt.homeSubscriptionChanged(homeId));
  assert.match(render(store), /Đã kết nối/);
});

test('shared STOMP client parses frame → existing event action → Redux → rendered UI; reconnect does not reload REST', async () => {
  const store = await ready(); let config; const subscriptions = [];
  const adapter = { active: false, connected: false, activate() { this.active = true; }, async deactivate() { this.active = false; },
    subscribe(destination, callback) { subscriptions.push({ destination, callback }); return { unsubscribe() {} }; },
  };
  const client = new SharedRealtimeClient({ brokerUrl: () => 'ws://test/ws', createStompClient: (value) => { config = value; return adapter; }, callbacks: {
    onEvent: (event) => store.dispatch(rt.realtimeEventReceived(event)),
    onStatusChange: (status) => store.dispatch(rt.connectionStatusChanged(status)),
    onHomeSubscriptionChange: (id) => store.dispatch(rt.homeSubscriptionChanged(id)),
  } });
  await client.connect('test-token'); client.subscribeToHome(homeId); adapter.connected = true; config.onConnect();
  assert.equal(config.connectHeaders.Authorization, 'Bearer test-token');
  assert.equal(subscriptions[0].destination, `/topic/homes/${homeId}/events`);
  subscriptions[0].callback({ body: JSON.stringify({ ...sensorEvent, data: { ...sensorEvent.data, latestValue: 30 } }) });
  assert.match(render(store), />30</);
  config.onWebSocketClose(); assert.match(render(store), /Đang kết nối lại/); assert.match(render(store), />30</);
  config.onConnect(); assert.equal(subscriptions.length, 2); assert.match(render(store), /Đã kết nối/);
  assert.equal(requests.length, 1); await client.disconnect();
});

test('invalid payloads are ignored; unknown event names rejected; Twin login return path preserves invitation precedence', () => {
  assert.equal(isTwinEvent({ ...sensorEvent, data: { sensorId } }), false);
  assert.equal(isTwinEvent({ ...healthEvent, data: { ...healthEvent.data, healthStatus: 'FRESH' } }), false);
  assert.throws(() => parseRealtimeEvent({ ...sensorEvent, type: 'FAKE_EVENT' }));
  const path = `/home/${homeId}/digital-twin`;
  const state = nav.readNavigationState({ returnTo: path });
  assert.equal(state.returnTo, path);
  assert.equal(nav.loginDestination({ platformRole: 'USER' }, '', state), path);
  assert.equal(nav.loginDestination({ platformRole: 'ADMIN' }, '', state), path);
  assert.equal(nav.loginDestination({ platformRole: 'USER' }, '?inviteToken=invite', state), '/join');
  assert.equal(nav.loginDestination({ platformRole: 'USER' }, '?token=invite', state), '/join');
  assert.equal(nav.loginDestination({ platformRole: 'USER' }, '?inviteToken=invite', {
    ...state, handledInviteToken: 'invite',
  }), path);
  for (const returnTo of ['//evil.test', `https://evil.test${path}`, '/home/../digital-twin', `${path}/extra`]) {
    assert.equal(nav.readNavigationState({ returnTo }).returnTo, undefined);
  }
});
