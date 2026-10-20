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
    const dependency = ['.ts', '.tsx'].map((ext) => base + ext).find(existsSync);
    assert.ok(dependency, `Cannot resolve ${name} from ${path}`);
    return loadSource(dependency);
  };
  runInThisContext(`(function(require, module, exports) { ${outputText}\n})`, { filename })(sourceRequire, module, module.exports);
  return module.exports;
}
const { latestDashboardMetric, deviceHealthCounts, deviceAlert } = loadSource('src/components/twin/dashboard/twinDashboardData.ts');
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

test('device health never presents offline or stale last-known power as currently operating', () => {
  const result = deviceHealthCounts([device({ status: 'OFFLINE', currentState: { power: true } }),
    device({ healthStatus: 'STALE', currentState: { power: false } }), device({ status: 'ERROR', currentState: { power: true } })]);
  assert.equal(result.on, 0);
  assert.equal(result.off, 0);
  assert.equal(result.online, 0);
  assert.equal(result.offline, 1);
  assert.equal(result.warning, 2);
  assert.equal(result.unknown, 3);
});

test('device alerts preserve error priority and distinguish health from connectivity', () => {
  assert.equal(deviceAlert(device()), null);
  assert.match(deviceAlert(device({ status: 'ERROR', healthStatus: 'OFFLINE' })), /lỗi/);
  assert.match(deviceAlert(device({ healthStatus: 'OFFLINE' })), /ngoại tuyến/);
  assert.match(deviceAlert(device({ healthStatus: 'STALE' })), /đã cũ/);
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
