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
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key) => key === 'accessToken' ? 'layout-test-token' : null } });
const { apiClient } = loadSource('src/services/apiClient.ts');
const { createAppStore } = loadSource('src/store/store.ts');
const twin = loadSource('src/store/twinSlice.ts');
const layout = loadSource('src/store/twinLayoutSlice.ts');
const geo = loadSource('src/components/twin/layoutGeometry.ts');
const { currentHomeChanged } = loadSource('src/store/homeSlice.ts');
const { sessionEnded } = loadSource('src/store/authSlice.ts');
const { realtimeEventReceived } = loadSource('src/store/realtimeSlice.ts');
const { parseRealtimeEvent } = loadSource('src/realtime/realtimeTypes.ts');
const { TwinLayoutEditor } = loadSource('src/components/twin/TwinLayoutEditor.tsx');
const fixture = (name) => JSON.parse(readFileSync(resolve(root, `tests/fixtures/twin/${name}.json`), 'utf8'));
const snapshot = fixture('twin-snapshot').result;
const sensorEvent = fixture('twin-sensor-event');
const deviceEvent = fixture('twin-device-event');
const healthEvent = fixture('twin-health-event');
const homeId = snapshot.homeId;
const roomId = snapshot.rooms[0].roomId;
const sensorId = sensorEvent.data.sensorId;
const deviceId = deviceEvent.data.deviceId;
const saved = { homeId, revision: 3,
  rooms: [{ roomId, x: 0.05, y: 0.05, width: 0.45, height: 0.4 }],
  nodes: [
    { nodeType: 'DEVICE', nodeId: deviceId, roomId, x: 0.25, y: 0.2 },
    { nodeType: 'SENSOR', nodeId: sensorId, roomId: null, x: 0.7, y: 0.4 },
  ],
};
const empty = { homeId, revision: 0, rooms: [], nodes: [] };
const response = (config, result) => ({ config, data: { code: 1000, result }, status: 200, statusText: 'OK', headers: {} });
let requests, backendLayout, role;
const adapter = async (config) => {
  requests.push(config);
  if (config.url.endsWith('/my-homes')) return response(config, [{ homeId, role }]);
  if (config.url.endsWith('/twin')) return response(config, snapshot);
  if (config.method === 'put') {
    const body = JSON.parse(config.data);
    backendLayout = { homeId, revision: backendLayout.revision + 1, rooms: body.rooms, nodes: body.nodes };
  }
  return response(config, backendLayout);
};
beforeEach(() => { requests = []; backendLayout = structuredClone(saved); role = 'OWNER'; apiClient.defaults.adapter = adapter; });
after(() => { if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage); else delete globalThis.localStorage; });
function open(store, id = homeId) { store.dispatch(currentHomeChanged(id)); store.dispatch(twin.twinOpened(id)); }
async function ready() {
  const store = createAppStore(); open(store);
  await Promise.all([store.dispatch(twin.loadTwinSnapshot(homeId)), store.dispatch(layout.loadTwinLayout(homeId)), store.dispatch(layout.loadLayoutRole(homeId))]);
  return store;
}
const render = (store) => renderToString(React.createElement(Provider, { store }, React.createElement(MemoryRouter, null, React.createElement(TwinLayoutEditor, { homeId }))));
const edit = (store) => store.dispatch(layout.layoutEditingStarted());
const draft = (store) => store.getState().twinLayout.draft;
const change = (store, value) => store.dispatch(layout.layoutDraftChanged(value));
const moveRoom = (store) => change(store, { ...draft(store), rooms: draft(store).rooms.map((room) => geo.clampRoom({ ...room, x: 0.3 })) });
const emit = (store, event) => store.dispatch(realtimeEventReceived(parseRealtimeEvent(event)));
const puts = () => requests.filter((request) => request.method === 'put');

test('consumes the exact backend empty/saved envelopes and PUT example without renaming fields', async () => {
  const example = (name) => JSON.parse(readFileSync(resolve(root, `tests/fixtures/twin-layout/twin-layout-${name}.json`), 'utf8'));
  for (const name of ['empty', 'saved']) {
    backendLayout = example(name).result;
    const store = await ready();
    assert.deepEqual(store.getState().twinLayout.confirmed, backendLayout);
  }
  const request = example('put');
  assert.equal(geo.geometryError(request), null);
  assert.deepEqual(geo.layoutRequest(request, request.expectedRevision), request);
});

test('empty layout is valid; owner can edit and first save sends revision zero', async () => {
  backendLayout = empty;
  const store = await ready();
  assert.equal(store.getState().twinLayout.confirmed.revision, 0);
  assert.match(render(store), /Chưa có sơ đồ/);
  assert.match(render(store), /Chỉnh sửa sơ đồ/);
  edit(store); assert.equal(store.getState().twinLayout.dirty, false);
  change(store, { rooms: [geo.defaultRoom(roomId, 0)], nodes: [] });
  await store.dispatch(layout.saveTwinLayout(homeId));
  assert.equal(JSON.parse(puts()[0].data).expectedRevision, 0);
  assert.equal(store.getState().twinLayout.confirmed.revision, 1);
});

test('saved layout renders exact normalized room position/dimensions and device/sensor positions', async () => {
  const store = await ready(); const html = render(store);
  assert.deepEqual(store.getState().twinLayout.confirmed, saved);
  assert.match(html, /left:5%;top:5%;width:45%;height:40%/);
  for (const node of saved.nodes) {
    assert.ok(html.includes(`data-node-key="${geo.nodeKey(node)}"`));
    assert.ok(html.includes(`data-x="${node.x}" data-y="${node.y}"`));
  }
  const request = requests.find((item) => item.url.endsWith('/twin-layout'));
  assert.equal(request.url, `/homes/${homeId}/twin-layout`);
  assert.equal(request.headers.get('Authorization'), 'Bearer layout-test-token');
});

test('move/resize modify draft only, normalized bounds/precision hold, cancel restores confirmed', async () => {
  const store = await ready(); const runtime = store.getState().twin;
  edit(store); moveRoom(store);
  assert.equal(store.getState().twinLayout.dirty, true);
  assert.equal(draft(store).rooms[0].x, 0.3);
  change(store, { ...draft(store), rooms: [geo.resizeRoom(draft(store).rooms[0], 2, -5)] });
  assert.equal(draft(store).rooms[0].width, 0.7);
  assert.equal(draft(store).rooms[0].height, 0.001);
  assert.deepEqual(store.getState().twinLayout.confirmed, saved);
  assert.equal(store.getState().twin, runtime);
  assert.equal(puts().length, 0);
  assert.deepEqual(geo.clampRoom({ roomId, x: -5, y: 4, width: 0.33444, height: 0.2 }), { roomId, x: 0, y: 0.8, width: 0.334, height: 0.2 });
  store.dispatch(layout.layoutEditingCancelled());
  assert.equal(draft(store), null); assert.equal(store.getState().twinLayout.dirty, false);
  assert.match(render(store), /left:5%;top:5%;width:45%;height:40%/);
});

test('unchanged geometry and returning to saved geometry are clean; invalid draft is rejected', async () => {
  const store = await ready(); edit(store);
  change(store, structuredClone(draft(store))); assert.equal(store.getState().twinLayout.dirty, false);
  moveRoom(store); change(store, saved); assert.equal(store.getState().twinLayout.dirty, false);
  const before = draft(store);
  change(store, { ...before, rooms: [{ ...before.rooms[0], x: -1 }] });
  assert.equal(draft(store), before);
  assert.ok(geo.geometryError({ ...before, nodes: [{ ...before.nodes[0], x: 0.1234 }] }));
  assert.ok(geo.geometryError({ ...before, nodes: [{ ...before.nodes[0], x: NaN }] }));
});

test('save is one full replacement, uses current revision and canonical response rather than local increment', async () => {
  const store = await ready(); edit(store); moveRoom(store);
  const expected = structuredClone(draft(store));
  const canonical = { ...expected, homeId, revision: 17, rooms: [{ ...expected.rooms[0], x: 0.299 }] };
  apiClient.defaults.adapter = async (config) => { requests.push(config); return response(config, canonical); };
  await Promise.all([store.dispatch(layout.saveTwinLayout(homeId)), store.dispatch(layout.saveTwinLayout(homeId))]);
  assert.equal(puts().length, 1);
  assert.deepEqual(JSON.parse(puts()[0].data), { expectedRevision: 3, ...expected });
  assert.deepEqual(store.getState().twinLayout.confirmed, canonical);
  assert.equal(store.getState().twinLayout.dirty, false); assert.equal(draft(store), null);
  edit(store); moveRoom(store); await store.dispatch(layout.saveTwinLayout(homeId));
  assert.equal(JSON.parse(puts()[1].data).expectedRevision, 17);
});

test('serialization whitelists geometry and never stores pixels or runtime fields', () => {
  const request = geo.layoutRequest({ rooms: [{ ...saved.rooms[0], pixelWidth: 1440 }], nodes: [{ ...saved.nodes[1], latestValue: 30, healthStatus: 'ACTIVE', currentState: {}, observedAt: 'now', lastSeen: 'now', status: 'ONLINE' }] }, 3);
  assert.deepEqual(request, { expectedRevision: 3, rooms: saved.rooms, nodes: [saved.nodes[1]] });
});

test('unplaced palette derives rooms/devices/sensors; placing and removing only touch draft', async () => {
  backendLayout = empty; const store = await ready(); edit(store);
  const html = render(store);
  // Only the active room group is mounted; browser tests switch device/sensor groups.
  for (const text of ['Chưa đặt', 'Living Room', 'Bedroom', 'Thiết bị', 'Cảm biến', 'Tìm đối tượng chưa đặt']) assert.ok(html.includes(text));
  const runtime = store.getState().twin;
  change(store, { rooms: saved.rooms, nodes: [saved.nodes[0]] });
  assert.equal(store.getState().twinLayout.dirty, true);
  change(store, { ...draft(store), nodes: saved.nodes });
  assert.equal(draft(store).nodes[1].nodeId, sensorId);
  change(store, { ...draft(store), nodes: [] });
  assert.equal(store.getState().twin, runtime);
  assert.equal(puts().length, 0);
  await store.dispatch(layout.saveTwinLayout(homeId));
  assert.deepEqual(JSON.parse(puts()[0].data).nodes, []);
});

test('identity is nodeType plus exact nodeId; drops pick topmost room or null and do not reassign domain room', async () => {
  assert.notEqual(geo.nodeKey({ nodeType: 'DEVICE', nodeId: 'same' }), geo.nodeKey({ nodeType: 'SENSOR', nodeId: 'same' }));
  assert.equal(geo.nodeKey({ nodeType: 'SENSOR', nodeId: 'uuid:TeMp:More' }), 'SENSOR:uuid:TeMp:More');
  const store = await ready(); edit(store);
  const rooms = [saved.rooms[0], { ...saved.rooms[0], roomId: snapshot.rooms[1].roomId }];
  const node = geo.moveLayoutNode(saved.nodes[0], 0.2, 0.2, rooms);
  assert.equal(node.roomId, rooms[1].roomId);
  assert.equal(geo.moveLayoutNode(node, 0.99, 0.99, rooms).roomId, null);
  assert.equal(geo.moveLayoutNode(node, -2, 9, rooms).x, 0);
  change(store, { rooms, nodes: [node, saved.nodes[1]] });
  assert.equal(store.getState().twin.devicesById[deviceId].roomId, deviceEvent.data.roomId);
});

for (const editing of [false, true]) {
  for (const kind of ['sensor', 'device', 'health']) test(`${kind} realtime updates rendered runtime and preserves ${editing ? 'draft' : 'confirmed'} geometry`, async () => {
    const store = await ready(); if (editing) { edit(store); moveRoom(store); }
    const before = store.getState().twinLayout;
    const event = kind === 'sensor' ? { ...sensorEvent, data: { ...sensorEvent.data, latestValue: 30, observedAt: '2026-09-17T09:01:00Z' } }
      : kind === 'device' ? { ...deviceEvent, data: { ...deviceEvent.data, currentState: { power: 'OFF' } } }
      : { ...healthEvent, data: { ...healthEvent.data, healthStatus: 'STALE' } };
    emit(store, event);
    assert.equal(store.getState().twinLayout, before);
    const html = render(store);
    assert.match(html, kind === 'sensor' ? /30 °C/ : kind === 'device' ? /OFF · ONLINE/ : /STALE/);
    for (const node of saved.nodes) assert.ok(html.includes(`data-x="${node.x}" data-y="${node.y}"`));
    assert.equal(puts().length, 0);
  });
}

for (const action of ['cancel', 'save']) test(`${action} after realtime retains the newest runtime state`, async () => {
  const store = await ready(); edit(store); moveRoom(store);
  emit(store, { ...sensorEvent, data: { ...sensorEvent.data, latestValue: 30, observedAt: '2026-09-17T09:01:00Z' } });
  emit(store, { ...deviceEvent, data: { ...deviceEvent.data, currentState: { power: 'OFF' } } });
  const runtime = store.getState().twin;
  if (action === 'save') await store.dispatch(layout.saveTwinLayout(homeId)); else store.dispatch(layout.layoutEditingCancelled());
  assert.equal(store.getState().twin, runtime);
  assert.equal(store.getState().twinLayout.confirmed.rooms[0].x, action === 'save' ? 0.3 : 0.05);
  assert.match(render(store), /30 °C/); assert.match(render(store), /OFF · ONLINE/);
});

test('runtime resync leaves unsaved geometry untouched and does not reload layout', async () => {
  const store = await ready(); edit(store); moveRoom(store);
  const before = store.getState().twinLayout;
  await store.dispatch(twin.loadTwinSnapshot(homeId));
  assert.equal(store.getState().twinLayout, before);
  assert.equal(requests.filter((request) => request.url.endsWith('/twin-layout')).length, 1);
});

for (const status of [403, 409, 500]) test(`HTTP ${status} preserves draft, exposes useful recovery and never retries automatically`, async () => {
  const store = await ready(); edit(store); moveRoom(store); const before = draft(store);
  apiClient.defaults.adapter = async (config) => { requests.push(config); throw { response: { status, data: { code: status === 409 ? 1130 : 1005, message: 'Save failed' } } }; };
  await store.dispatch(layout.saveTwinLayout(homeId));
  assert.equal(draft(store), before); assert.equal(store.getState().twinLayout.confirmed.revision, 3);
  assert.equal(puts().length, 1); assert.match(render(store), /role="alert"/);
  if (status === 409) { assert.match(render(store), /phiên khác/); assert.match(render(store), /Tải sơ đồ mới nhất/); }
  if (status === 403) assert.match(render(store), /không có quyền/);
  if (status !== 500) { await store.dispatch(layout.saveTwinLayout(homeId)); assert.equal(puts().length, 1); }
  apiClient.defaults.adapter = adapter;
  await store.dispatch(layout.loadTwinLayout(homeId));
  assert.equal(draft(store), null);
});

test('layout load failure retries independently; members see saved layout but cannot start editing', async () => {
  role = 'MEMBER'; const store = await ready();
  assert.doesNotMatch(render(store), /Chỉnh sửa sơ đồ/);
  assert.match(render(store), /Chỉ xem sơ đồ/); assert.match(render(store), /Ceiling light/);
  edit(store); assert.equal(draft(store), null);
  const runtime = store.getState().twin;
  apiClient.defaults.adapter = async () => { throw new Error('Network unavailable'); };
  await store.dispatch(layout.loadTwinLayout(homeId));
  assert.match(render(store), /Thử tải lại sơ đồ/); assert.equal(store.getState().twin, runtime);
  apiClient.defaults.adapter = adapter; await store.dispatch(layout.loadTwinLayout(homeId));
  assert.equal(store.getState().twinLayout.error, null);
});

test('late Home A GET/PUT/role results cannot overwrite Home B or a newer Home A visit', async () => {
  const store = await ready(); edit(store); moveRoom(store);
  const pending = [];
  apiClient.defaults.adapter = (config) => new Promise((resolve) => pending.push({ config, resolve }));
  const saving = store.dispatch(layout.saveTwinLayout(homeId)); await new Promise(setImmediate);
  open(store, 'home-b'); assert.equal(store.getState().twinLayout.confirmed, null); assert.equal(draft(store), null);
  const loadingB = store.dispatch(layout.loadTwinLayout('home-b')); await new Promise(setImmediate);
  pending[1].resolve(response(pending[1].config, { ...empty, homeId: 'home-b' })); await loadingB;
  pending[0].resolve(response(pending[0].config, { ...saved, revision: 4 })); await saving;
  assert.equal(store.getState().twinLayout.confirmed.homeId, 'home-b');
  open(store); const oldA = store.dispatch(layout.loadTwinLayout(homeId)); const oldRole = store.dispatch(layout.loadLayoutRole(homeId)); await new Promise(setImmediate);
  open(store, 'home-b'); open(store);
  const newA = store.dispatch(layout.loadTwinLayout(homeId)); await new Promise(setImmediate);
  pending[4].resolve(response(pending[4].config, { ...saved, revision: 10 })); await newA;
  pending[2].resolve(response(pending[2].config, saved)); pending[3].resolve(response(pending[3].config, [{ homeId, role: 'OWNER' }])); await Promise.all([oldA, oldRole]);
  assert.equal(store.getState().twinLayout.confirmed.revision, 10); assert.equal(store.getState().twinLayout.role, null);
  store.dispatch(sessionEnded()); assert.deepEqual(store.getState().twinLayout, layout.emptyLayoutState());
});

