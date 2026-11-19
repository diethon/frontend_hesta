import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Box3, OrthographicCamera, Spherical, Vector3 } from 'three';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const modules = new Map();
function loadSource(path) {
  const filename = resolve(root, path);
  if (modules.has(filename)) return modules.get(filename).exports;
  const module = { exports: {} };
  modules.set(filename, module);
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }, fileName: filename,
  });
  const sourceRequire = (name) => {
    if (!name.startsWith('.')) return require(name);
    const base = resolve(dirname(filename), name);
    const dependency = existsSync(base) ? base : ['.ts', '.tsx'].map((ext) => base + ext).find(existsSync);
    assert.ok(dependency, `Cannot resolve ${name} from ${path}`);
    return loadSource(dependency);
  };
  runInThisContext(`(function(require, module, exports) { ${outputText}\n})`, { filename })(sourceRequire, module, module.exports);
  return module.exports;
}
const { latestDashboardMetric, deviceHealthCounts, deviceAlert } = loadSource('src/components/twin/dashboard/twinDashboardData.ts');
const { scopeTwinHouse } = loadSource('src/services/twinSceneScope.ts');
const { fitOrthographicZoom } = loadSource('src/components/twin/scene/cameraFraming.ts');
const { adaptTwinArchitecture, twinRoomCategory } = loadSource('src/services/twinArchitectureAdapter.ts');
const { createV2Illustration, roomNameFloorHint } = loadSource('src/services/twinV2Illustration.ts');
const { materializeTwinArchitecture } = loadSource('src/services/twinLayoutMaterialize.ts');
const { draftingFromArchitecture } = loadSource('src/components/twin/twinDrafting.ts');
const { adaptTwinHouse } = loadSource('src/services/twinAdapter.ts');

test('V2 illustrative plan composes only API rooms and preserves device membership without saving', () => {
  const names = { bedroom: 'Phòng ngủ', living: 'Phòng khách', garage: 'Garage', garden: 'Garden', kitchen: 'Phòng bếp' };
  const identities = [{ nodeType: 'DEVICE', nodeId: 'real-light', roomId: 'living' }, { nodeType: 'DEVICE', nodeId: 'unassigned', roomId: null }];
  const result = createV2Illustration(Object.keys(names), identities, names);
  assert.deepEqual(result.rooms.map(room => room.roomId), Object.keys(names));
  assert.equal(result.nodes.length, 1);
  assert.equal(result.nodes[0].roomId, 'living');
  assert.equal(result.nodes[0].nodeId, 'real-light');
  const garden = result.rooms.find(room => room.roomId === 'garden');
  const living = result.rooms.find(room => room.roomId === 'living');
  assert.ok(garden.x >= living.x + living.width);
  assert.ok(result.rooms.every(room => room.floor === 1));
  assert.ok(result.rooms.every(room => room.x >= 0 && room.y >= 0 && room.x + room.width <= 1 && room.y + room.height <= 1));
  const expandedNames = { ...names, office: 'Phòng làm việc', guest: 'Phòng ngủ khách', bath: 'Phòng tắm' };
  const expanded = createV2Illustration(Object.keys(expandedNames), identities, expandedNames);
  assert.equal(expanded.rooms.length, 8);
  assert.ok(expanded.rooms.every(room => room.x >= 0 && room.y >= 0 && room.x + room.width <= 1.001 && room.y + room.height <= 1.001));
  assert.equal(expanded.rooms.find(room => room.roomId === 'garden').height, .84);
});

test('V2 furniture survives the existing layout document without unsupported backend model variants', () => {
  const names = { bedroom: 'Phòng ngủ', living: 'Phòng khách', garage: 'Garage', garden: 'Garden', kitchen: 'Phòng bếp' };
  const geometry = createV2Illustration(Object.keys(names), [], names);
  const metadata = { version: 1, settings: { gridSnap: true, edgeSnap: true }, rooms: {}, blueprints: {} };
  const saved = materializeTwinArchitecture('real-home', geometry, metadata, names);
  const allowed = new Set(['armchair', 'coffee_table', 'nightstand', 'office_chair', 'shelf', 'washbasin']);
  assert.ok(Object.values(saved.rooms).flatMap(room => room.objects).every(item => !item.model || allowed.has(item.model)));
  const drafting = draftingFromArchitecture(saved);
  const view = adaptTwinHouse('real-home', { ...geometry, architecture: saved }, drafting, [], [], 'all', false);
  const restored = view.floors.flatMap(floor => adaptTwinArchitecture(floor, drafting, names).floor.furniture);
  for (const type of ['car', 'stove', 'table_round', 'sideboard']) assert.ok(restored.some(item => item.type === type), type);
});

test('unsaved V2 floors use explicit room-name hints without creating domain rooms', () => {
  assert.equal(roomNameFloorHint('Hành lang tầng 2'), 2);
  assert.equal(roomNameFloorHint('Ban công tầng 3'), 3);
  assert.equal(roomNameFloorHint('Bedroom floor 4'), 4);
  assert.equal(roomNameFloorHint('Phòng 305'), 1);
  assert.equal(roomNameFloorHint('Tầng 999'), 1);
  const names = { living: 'Phòng khách', hall: 'Hành lang tầng 2', balcony: 'Ban công tầng 3' };
  const result = createV2Illustration(Object.keys(names), [{ nodeType: 'DEVICE', nodeId: 'hall-lamp', roomId: 'hall' }], names);
  assert.deepEqual(result.rooms.map(room => [room.roomId, room.floor]), [['living', 1], ['hall', 2], ['balcony', 3]]);
  assert.deepEqual(result.nodes.map(node => [node.nodeId, node.roomId]), [['hall-lamp', 'hall']]);
  assert.equal(twinRoomCategory(names.hall), 'hallway');
});

test('real garage and garden rooms receive appropriate illustrative furnishings without replacing authored layouts', () => {
  assert.equal(twinRoomCategory('Sân vườn'), 'garden');
  assert.equal(twinRoomCategory('Nhà xe'), 'garage');
  const rooms = ['garage-id', 'garden-id'].map((roomId, index) => ({ roomId, x: index * 7, y: 0, z: 0, width: 6, depth: 6, wallHeight: 2.6, wallThickness: .12, outline: [{ x: -3, z: -3 }, { x: 3, z: -3 }, { x: 3, z: 3 }, { x: -3, z: 3 }] }));
  const floor = { id: 'real-floor', name: 'Actual floor', level: 1, rooms, nodes: [] };
  const names = { 'garage-id': 'Garage', 'garden-id': 'Garden' };
  const result = adaptTwinArchitecture(floor, { rooms: {} }, names);
  const garage = result.floor.furniture.filter(item => result.furnitureRooms.get(item.id) === 'garage-id');
  const garden = result.floor.furniture.filter(item => result.furnitureRooms.get(item.id) === 'garden-id');
  assert.ok(garage.some(item => item.type === 'car'));
  assert.ok(garden.some(item => item.type === 'plant'));
  assert.ok([...garage, ...garden].every(item => item.type !== 'sofa' && item.type !== 'bed'));
  assert.equal(result.floor.rooms[0].floor_material, 'concrete');
  const garageOpenings = result.floor.openings.filter(opening => opening.room_id === 'garage-id');
  assert.ok(garageOpenings.some(opening => opening.type === 'door' && opening.sill === 0 && opening.width > 2), 'garage gets a floor-level vehicle opening for a roller door');
  assert.ok(garageOpenings.every(opening => opening.type !== 'window'));
  const authored = adaptTwinArchitecture(floor, { rooms: { 'garden-id': { autoFurniture: false, objects: [] }, 'garage-id': { autoFurniture: false, objects: [] } } }, names);
  assert.equal(authored.floor.furniture.length, 0);
  assert.deepEqual(authored.floor.rooms[1].wall_heights, [2.6, 2.6, 2.6, 2.6]);
});

test('V2 room detail isolates real IDs without changing saved geometry or device membership', () => {
  const living = { roomId: 'actual-living', x: 3, z: -2, outline: [{ x: 1, z: 2 }] };
  const bedroom = { roomId: 'actual-bed', x: -4, z: 5 };
  const device = { nodeId: 'real-lamp', roomId: living.roomId, x: 4, z: -1 };
  const house = { id: 'real-home', floors: [
    { id: 'floor-a', rooms: [living], nodes: [device, { nodeId: 'other', roomId: null }] },
    { id: 'floor-b', rooms: [bedroom], nodes: [{ nodeId: 'fan', roomId: bedroom.roomId }] },
  ] };
  const scoped = scopeTwinHouse(house, living.roomId);
  assert.equal(scoped.id, house.id);
  assert.deepEqual(scoped.floors.map(floor => floor.id), ['floor-a']);
  assert.equal(scoped.floors[0].rooms[0], living);
  assert.equal(scoped.floors[0].nodes[0], device);
  assert.equal(scoped.floors[0].nodes.length, 1);
  assert.equal(house.floors[0].nodes.length, 2);
  assert.equal(scopeTwinHouse(house, null), house);
  assert.equal(scopeTwinHouse(house, 'deleted-room'), house);
});

test('V2 orthographic fit keeps every architecture corner inside wide and narrow viewports', () => {
  const box = new Box3(new Vector3(-8, -.2, -5), new Vector3(9, 5, 6));
  const target = box.getCenter(new Vector3());
  for (const [width, height] of [[1440, 720], [320, 580], [840, 800]]) {
    for (const theta of [-2.8, .68, 2.1]) {
      const phi = 1;
      const camera = new OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, .05, 1000);
      camera.position.copy(target).add(new Vector3().setFromSpherical(new Spherical(80, phi, theta)));
      camera.lookAt(target);
      camera.zoom = fitOrthographicZoom(box, target, theta, phi, width, height);
      camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      let fill = 0;
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const corner = new Vector3(x, y, z).project(camera);
        assert.ok(Math.abs(corner.x) <= .841 && Math.abs(corner.y) <= .841);
        fill = Math.max(fill, Math.abs(corner.x), Math.abs(corner.y));
      }
      assert.ok(fill >= .839, 'House fills the limiting axis rather than appearing too small');
    }
  }
});
const sensor = (overrides = {}) => ({ sensorId: 'sensor-1', deviceId: 'device-1', roomId: 'room-1',
  metricType: 'TEMPERATURE', unit: '°C', latestValue: 26.4, healthStatus: 'ACTIVE',
  observedAt: '2026-10-20T09:00:00Z', ...overrides });
const device = (overrides = {}) => ({ deviceId: 'device-1', roomId: 'room-1', name: 'Light',
  deviceType: 'LIGHT', icon: null, status: 'ONLINE', healthStatus: 'ACTIVE', currentState: {}, lastSeen: null, ...overrides });

test('dashboard metric preserves the newest actual reading and its unit, never averages rooms', () => {
  const older = sensor();
  const newest = sensor({ sensorId: 's2', roomId: 'room-2', latestValue: 78, unit: '°F', observedAt: '2026-10-20T09:01:00Z' });
  assert.equal(latestDashboardMetric([newest, older], 'temperature'), newest);
});

test('dashboard metric ignores stale/offline readings even if they are newer', () => {
  const active = sensor();
  assert.equal(latestDashboardMetric([active, sensor({ healthStatus: 'STALE', observedAt: '2026-10-20T09:02:00Z' }),
    sensor({ healthStatus: 'OFFLINE', observedAt: '2026-10-20T09:03:00Z' })], 'temperature'), active);
});

test('dashboard metric falls back to latest stale/offline reading when no active reading exists', () => {
  const stale = sensor({ healthStatus: 'STALE', observedAt: '2026-10-20T09:02:00Z', latestValue: 27 });
  const offline = sensor({ healthStatus: 'OFFLINE', observedAt: '2026-10-20T09:03:00Z', latestValue: 28 });
  assert.equal(latestDashboardMetric([stale, offline], 'temperature'), offline);
});

test('dashboard metric rejects null, non-finite, invalid timestamps and incompatible units', () => {
  const invalid = [sensor({ latestValue: null }), sensor({ latestValue: Infinity }), sensor({ latestValue: NaN }),
    sensor({ unit: null }), sensor({ unit: '%' }), sensor({ observedAt: null }), sensor({ observedAt: 'invalid' })];
  assert.equal(latestDashboardMetric(invalid, 'temperature'), undefined);
});

test('dashboard metric accepts zero humidity without replacing it with an empty state', () => {
  const reading = sensor({ metricType: 'HUMIDITY', latestValue: 0, unit: ' % ' });
  assert.equal(latestDashboardMetric([reading], 'humidity'), reading);
});

test('light analytics require actual illuminance in lux rather than device brightness percentage', () => {
  const reading = sensor({ metricType: 'ILLUMINANCE', latestValue: 320, unit: 'lx' });
  assert.equal(latestDashboardMetric([sensor({ metricType: 'LIGHT', unit: '%', latestValue: 70 }), reading], 'light'), reading);
  assert.equal(latestDashboardMetric([sensor({ metricType: 'BRIGHTNESS', unit: 'lux' })], 'light'), undefined);
});

test('motion reflects latest confirmed numeric true and false events', () => {
  const active = sensor({ metricType: 'MOTION', unit: null, latestValue: 1 });
  const clear = sensor({ metricType: 'MOTION', unit: 'bool', latestValue: 0, observedAt: '2026-10-20T09:01:00Z' });
  assert.equal(latestDashboardMetric([active], 'motion'), active);
  assert.equal(latestDashboardMetric([active, clear], 'motion'), clear);
});

test('motion rejects non-binary readings and malformed raw booleans outside the snapshot contract', () => {
  assert.equal(latestDashboardMetric([2, -1, true, false].map((latestValue) => sensor({ metricType: 'MOTION', unit: null, latestValue })), 'motion'), undefined);
});

test('empty home analytics never fabricate measurements or health counts', () => {
  for (const metric of ['temperature', 'humidity', 'light', 'motion']) assert.equal(latestDashboardMetric([], metric), undefined);
  assert.deepEqual(deviceHealthCounts([]), { total: 0, online: 0, on: 0, off: 0, offline: 0, warning: 0, unknown: 0 });
});

test('device health separates unknown power from explicit off', () => {
  const result = deviceHealthCounts([device({ currentState: { power: true } }), device({ currentState: { power: 'OFF' } }),
    device({ currentState: { brightness: 0 } }), device({ currentState: { power: 'invalid' } })]);
  assert.deepEqual(result, { total: 4, online: 4, on: 1, off: 1, offline: 0, warning: 0, unknown: 2 });
});

test('device connectivity follows status even when legacy freshness is stale', () => {
  const result = deviceHealthCounts([device({ status: 'OFFLINE', currentState: { power: true } }),
    device({ healthStatus: 'STALE', currentState: { power: false } }), device({ status: 'ERROR', currentState: { power: true } })]);
  assert.equal(result.on, 0);
  assert.equal(result.off, 1);
  assert.equal(result.online, 1);
  assert.equal(result.offline, 1);
  assert.equal(result.warning, 1);
  assert.equal(result.unknown, 2);
});

test('device alerts use connection status and ignore legacy freshness', () => {
  assert.equal(deviceAlert(device()), null);
  assert.match(deviceAlert(device({ status: 'ERROR', healthStatus: 'OFFLINE' })), /lỗi/);
  assert.match(deviceAlert(device({ status: 'OFFLINE' })), /ngoại tuyến/);
  assert.equal(deviceAlert(device({ healthStatus: 'OFFLINE' })), null);
  assert.equal(deviceAlert(device({ healthStatus: 'STALE' })), null);
});

// Render real dashboard panels against the same normalized slice shape as the
// application. No HTTP, history, capabilities or measurements are fabricated by
// these components during render; transport effects do not execute under SSR.
globalThis.__twinDashboardEnv = {};
const analyticsSource = resolve(root, 'src/components/twin/dashboard/TwinAnalytics.tsx');
const { TwinAnalytics } = loadSource(analyticsSource);
const sourceFilename = resolve(root, 'src/services/apiClient.ts');
const apiSource = readFileSync(sourceFilename, 'utf8').replaceAll('import.meta.env', 'globalThis.__twinDashboardEnv');
const apiModule = { exports: {} };
const apiOutput = ts.transpileModule(apiSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
runInThisContext(`(function(require, module, exports) { ${apiOutput}\n})`, { filename: sourceFilename })((name) =>
  name.startsWith('.') ? loadSource(resolve(dirname(sourceFilename), `${name}.ts`)) : require(name), apiModule, apiModule.exports);
modules.set(sourceFilename, apiModule);
const { TwinControlSidebar } = loadSource('src/components/twin/dashboard/TwinControlSidebar.tsx');
const { TwinRoomInfo } = loadSource('src/components/twin/dashboard/TwinRoomInfo.tsx');

function dashboardStore() {
  const devices = [device({ deviceId: 'd1', roomId: 'room-1', name: 'Floor One Lamp', currentState: { power: true } }),
    device({ deviceId: 'd2', roomId: 'room-2', name: 'Floor Two Lamp', currentState: { power: false } }),
    device({ deviceId: 'd3', roomId: null, name: 'Unassigned Lamp', status: 'OFFLINE', healthStatus: 'OFFLINE' })];
  const sensors = [sensor({ sensorId: 's1', roomId: 'room-1', latestValue: 21.2 }),
    sensor({ sensorId: 's2', roomId: 'room-2', latestValue: 28.9, observedAt: '2026-10-20T09:01:00Z' }),
    sensor({ sensorId: 's3', roomId: null, latestValue: 39.8, observedAt: '2026-10-20T09:02:00Z' })];
  const state = {
    twin: { homeId: 'h1', home: { homeId: 'h1', name: 'Actual Home' },
      devicesById: Object.fromEntries(devices.map((item) => [item.deviceId, item])),
      sensorsById: Object.fromEntries(sensors.map((item) => [item.sensorId, item])),
      roomsById: {
        'room-1': { roomId: 'room-1', homeId: 'h1', name: 'Living Room', icon: null, deviceIds: ['d1'], sensorIds: ['s1'] },
        'room-2': { roomId: 'room-2', homeId: 'h1', name: 'Bedroom', icon: null, deviceIds: ['d2'], sensorIds: ['s2'] },
      } }, twinCommand: { byId: {} },
  };
  return configureStore({ reducer: (current = state) => current });
}
const renderPanel = (Component, props) => renderToString(React.createElement(Provider, { store: dashboardStore() }, React.createElement(Component, props)));
const sidebarProps = { geometry: { rooms: [], nodes: [] }, selection: null, onSelect: () => {}, onEdit2D: () => {},
  canEdit: false, onFocusRoom: () => {}, onFitHome: () => {} };
const metricText = (html) => html.replaceAll('<!-- -->', '');

test('actual sidebar floor scope excludes other floors and unassigned devices', () => {
  const html = renderPanel(TwinControlSidebar, { ...sidebarProps, scopeRoomIds: ['room-1'], scopeName: 'Tầng 1' });
  assert.match(html, /Chọn thiết bị Floor One Lamp/);
  assert.doesNotMatch(html, /Floor Two Lamp|Unassigned Lamp/);
  assert.match(html, /Tầng 1/);
});

test('actual sidebar selected room takes precedence over floor scope', () => {
  const html = renderPanel(TwinControlSidebar, { ...sidebarProps, selection: { kind: 'room', id: 'room-2' }, scopeRoomIds: ['room-1'], scopeName: 'Tầng 1' });
  assert.match(html, /Chọn thiết bị Floor Two Lamp/);
  assert.match(html, /Bedroom/);
  assert.doesNotMatch(html, /Floor One Lamp|Unassigned Lamp/);
});

test('actual analytics floor scope uses only readings and health from that floor', () => {
  const html = metricText(renderPanel(TwinAnalytics, { scopeRoomIds: ['room-1'], scopeName: 'Tầng 1' }));
  assert.match(html, /21,2/);
  assert.doesNotMatch(html, /28,9|39,8/);
  assert.match(html, /Tầng 1/);
  assert.match(html, /\/ 1 trực tuyến/);
});

test('actual analytics selected room takes precedence over floor scope', () => {
  const html = metricText(renderPanel(TwinAnalytics, { roomId: 'room-2', scopeRoomIds: ['room-1'], scopeName: 'Tầng 1' }));
  assert.match(html, /28,9/);
  assert.match(html, /Bedroom/);
  assert.doesNotMatch(html, /21,2|39,8|Tầng 1/);
});

test('actual whole-house panels retain access to unassigned devices and their readings', () => {
  const sidebar = renderPanel(TwinControlSidebar, sidebarProps);
  assert.match(sidebar, /Chọn thiết bị Unassigned Lamp/);
  const analytics = metricText(renderPanel(TwinAnalytics, {}));
  assert.match(analytics, /39,8/);
  assert.match(analytics, /Chưa gán phòng/);
  assert.match(analytics, /\/ 3 trực tuyến/);
});

test('actual empty floor scope stays empty instead of silently showing whole-house data', () => {
  const sidebar = renderPanel(TwinControlSidebar, { ...sidebarProps, scopeRoomIds: [], scopeName: 'Tầng trống' });
  assert.doesNotMatch(sidebar, /Floor One Lamp|Floor Two Lamp|Unassigned Lamp/);
  const analytics = metricText(renderPanel(TwinAnalytics, { scopeRoomIds: [] }));
  assert.doesNotMatch(analytics, /21,2|28,9|39,8/);
  assert.match(analytics, /Đang chờ dữ liệu từ HESTA/);
  assert.match(analytics, /\/ 0 trực tuyến/);
});

test('room information counts business devices and sensors even when they have no geometry', () => {
  const html = metricText(renderPanel(TwinRoomInfo, { roomId: 'room-1', geometry: { rooms: [], nodes: [] } }));
  assert.match(html, /Living Room/);
  assert.match(html, /1 thiết bị/);
  assert.match(html, /1 cảm biến/);
  assert.match(html, /Chưa bố trí/);
  assert.doesNotMatch(html, /Bedroom|Unassigned Lamp/);
});

test('room information asks for a selection instead of presenting unassigned devices as a room', () => {
  const html = metricText(renderPanel(TwinRoomInfo, { roomId: null, geometry: { rooms: [], nodes: [] } }));
  assert.match(html, /Chọn một phòng/);
  assert.doesNotMatch(html, /Living Room|Bedroom|1 thiết bị/);
});
