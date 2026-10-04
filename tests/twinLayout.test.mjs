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
const viewport2d = loadSource('src/components/twin/twin2dViewport.ts');
const geo3d = loadSource('src/components/twin/twin3dGeometry.ts');
const camera3d = loadSource('src/components/twin/twin3dCamera.ts');
const { Twin3DCameraControls } = loadSource('src/components/twin/Twin3DCameraControls.tsx');
const drafting = loadSource('src/components/twin/twinDrafting.ts');
const { supportsWebGL } = loadSource('src/components/twin/twin3dSupport.ts');
const { TwinViewSwitcher } = loadSource('src/components/twin/TwinViewSwitcher.tsx');
const { Twin3DInspector } = loadSource('src/components/twin/Twin3DInspector.tsx');
const { TwinLayoutInspector } = loadSource('src/components/twin/TwinLayoutInspector.tsx');
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

test('editor groups physical sensor types under sensors even without readings and keeps valid layout identities', () => {
  const { paletteGroup, placePaletteItem } = loadSource('src/components/twin/layoutPalette.ts');
  const state = twin.normalizeTwinSnapshot(snapshot);
  state.sensorsById = {};
  state.sensorIds = [];
  const { DEVICE_TYPES } = loadSource('src/types/deviceVocabulary.ts');
  const sensorTypes = [DEVICE_TYPES.TEMP_HUMID_SENSOR, DEVICE_TYPES.MOTION_SENSOR, DEVICE_TYPES.SMOKE_SENSOR, 'SENSOR'];
  const deviceTypes = [
    ...Object.values(DEVICE_TYPES).filter((type) => !sensorTypes.includes(type)),
    'FAN', 'AC', 'SOCKET', 'LOCK', 'CAMERA', 'MICROPHONE',
  ];
  for (const type of [...sensorTypes, ...deviceTypes]) {
    const id = `physical-${type}`;
    state.devicesById[id] = { ...deviceEvent.data, deviceId: id, deviceType: type, currentState: {} };
    const item = { kind: 'DEVICE', id };
    assert.equal(paletteGroup(item, state.devicesById), sensorTypes.includes(type) ? 'SENSOR' : 'DEVICE', type);
    const placed = placePaletteItem({ rooms: [], nodes: [] }, item, 0.5, 0.5);
    assert.equal(placed.nodes[0].nodeType, 'DEVICE');
    assert.equal(placed.nodes[0].nodeId, id);
    assert.equal(placePaletteItem(placed, item, 0.2, 0.2).nodes.length, 1);
  }
  const metric = { kind: 'SENSOR', id: sensorId };
  assert.equal(paletteGroup(metric, state.devicesById), 'SENSOR');
  assert.equal(placePaletteItem({ rooms: [], nodes: [] }, metric, 0.5, 0.5).nodes[0].nodeType, 'SENSOR');
  assert.equal(paletteGroup({ kind: 'room', id: roomId }, state.devicesById), 'room');
});
const saved = { homeId, revision: 3,
  rooms: [{ roomId, floor: 1, x: 0.05, y: 0.05, width: 0.45, height: 0.4 }],
  nodes: [
    { nodeType: 'DEVICE', nodeId: deviceId, roomId, x: 0.25, y: 0.2 },
    { nodeType: 'SENSOR', nodeId: sensorId, roomId: null, x: 0.7, y: 0.4 },
  ],
};

test('camera presets cover every side and overhead while staying above the floor', () => {
  assert.deepEqual(camera3d.cameraViews.map(view => view.id), ['isometric', 'top', 'front', 'right', 'back', 'left']);
  for (const view of camera3d.cameraViews) {
    const result = camera3d.cameraAngles(view.id, 3.05, 1);
    assert.ok(Math.abs(result.theta - 3.05) <= Math.PI);
    assert.ok(Math.abs(Math.sin(result.theta) - Math.sin(view.theta)) < 1e-10);
    assert.ok(Math.abs(Math.cos(result.theta) - Math.cos(view.theta)) < 1e-10);
    assert.ok(result.phi >= camera3d.CAMERA_MIN_POLAR && result.phi <= camera3d.CAMERA_MAX_POLAR);
  }
  assert.ok(camera3d.cameraAngles('top', 0, 1).phi < .1);
  const right = camera3d.cameraAngles('turn-right', 3.05, .7);
  assert.ok(Math.abs(right.theta - 3.05 - Math.PI / 2) < 1e-10);
  assert.equal(right.phi, .7);
  const left = camera3d.cameraAngles('turn-left', right.theta, right.phi);
  assert.ok(Math.abs(left.theta - 3.05) < 1e-10);
  assert.equal(camera3d.cameraTransitionProgress(0, false), 0);
  assert.equal(camera3d.cameraTransitionProgress(.25, false), .5);
  assert.equal(camera3d.cameraTransitionProgress(.5, false), 1);
  assert.equal(camera3d.cameraTransitionProgress(0, true), 1);
});

test('camera toolbar exposes keyboard buttons and only the selected preset is pressed', () => {
  const markup = renderToString(React.createElement(Twin3DCameraControls, { activeView: 'top', onChange: () => {} }));
  assert.equal((markup.match(/aria-pressed="true"/g) ?? []).length, 1);
  assert.match(markup, /aria-label="Góc nhìn Từ trên" aria-pressed="true"/);
  assert.match(markup, /aria-label="Xoay trái 90°"/);
  assert.match(markup, /aria-label="Xoay phải 90°"/);
  assert.equal((markup.match(/type="button"/g) ?? []).length, 8);
  const custom = renderToString(React.createElement(Twin3DCameraControls, { activeView: null, onChange: () => {} }));
  assert.equal((custom.match(/aria-pressed="true"/g) ?? []).length, 0);
});

test('2D fit centers room bounds at 82% of the viewport without changing geometry', () => {
  const geometry = { rooms: [{ roomId, x: .1, y: .2, width: .4, height: .3 }], nodes: [] };
  const before = JSON.stringify(geometry);
  const bounds = viewport2d.layoutViewportBounds(geometry);
  for (const [width, height] of [[900, 600], [288, 448]]) {
    const fit = viewport2d.fitLayoutViewport(bounds, width, height);
    assert.ok(Math.abs(.4 * fit.canvasWidth / width - .82) < .001);
    assert.ok(Math.abs(.3 * fit.canvasHeight / height - .615) < .001);
    assert.ok(Math.abs((bounds.left + bounds.right) / 2 * fit.canvasWidth + fit.left - fit.scrollLeft - width / 2) < .001);
    assert.ok(Math.abs((bounds.top + bounds.bottom) / 2 * fit.canvasHeight + fit.top - fit.scrollTop - height / 2) < .001);
    assert.ok(Math.abs(viewport2d.fitLayoutViewport(bounds, width, height, 1.25).canvasWidth - fit.canvasWidth * 1.25) < .001);
  }
  assert.equal(JSON.stringify(geometry), before);
  assert.deepEqual(viewport2d.layoutViewportBounds({ rooms: [], nodes: [] }), { left: 0, top: 0, right: 1, bottom: 1 });
  assert.equal(viewport2d.layoutViewportBounds({ ...geometry, nodes: [{ ...saved.nodes[0], x: .95, y: .9 }] }).right, .95);
});

test('2D header offsets marker display only, preserves exact IDs, and leaves body positions intact', () => {
  const room = { roomId, x: .1, y: .1, width: .5, height: .6 };
  const headerNode = { ...saved.nodes[0], x: .25, y: .11 };
  const before = JSON.stringify(headerNode);
  const display = viewport2d.nodeDisplayPosition(headerNode, [room], 1000, 600);
  assert.equal(display.x, 250);
  assert.ok(display.y - 18 >= 60 + viewport2d.roomHeaderHeight(360));
  assert.ok(display.y + 18 <= 420);
  const body = viewport2d.nodeDisplayPosition({ ...headerNode, y: .5 }, [room], 1000, 600);
  assert.deepEqual(body, { x: 250, y: 300 });
  assert.deepEqual(viewport2d.nodeDisplayPosition({ ...headerNode, x: .9, y: .11 }, [room], 1000, 600), { x: 900, y: 66 });
  assert.equal(JSON.stringify(headerNode), before);
  assert.equal(geo.layoutRequest({ rooms: [room], nodes: [headerNode] }, 3).nodes[0].y, .11);
});

test('3D floor segments expose every floor with an explicit selected state', () => {
  const { TwinFloorSelect } = loadSource('src/components/twin/TwinFloorSelect.tsx');
  const html = renderToString(React.createElement(TwinFloorSelect, { floors: [1, 2, 3], value: 2, variant: 'segmented', onChange() {} }));
  assert.match(html, /Toàn nhà/);
  assert.match(html, /data-value="2" aria-label="Tầng 2" aria-pressed="true"/);
  assert.match(html, />T1</); assert.match(html, />T3</);
  assert.doesNotMatch(html, /role="combobox"/);
});
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
const render = (store) => renderToString(React.createElement(Provider, { store }, React.createElement(MemoryRouter, null, React.createElement(TwinLayoutEditor, { homeId, initialMode: '2d' }))));
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

test('3D conversion maps normalized x to world X, normalized y to world Z, and reserves Y for elevation', () => {
  assert.deepEqual(geo3d.normalizedToWorld(0, 0), { x: -geo3d.TWIN_WORLD_WIDTH / 2, y: 0, z: -geo3d.TWIN_WORLD_DEPTH / 2 });
  assert.deepEqual(geo3d.normalizedToWorld(1, 1, 0.75), { x: geo3d.TWIN_WORLD_WIDTH / 2, y: 0.75, z: geo3d.TWIN_WORLD_DEPTH / 2 });
  const room = geo3d.roomToWorld({ roomId, x: 0.1, y: 0.2, width: 0.4, height: 0.5 });
  assert.equal(room.roomId, roomId); assert.equal(room.y, 0); assert.equal(room.width, 7.2); assert.equal(room.depth, 6);
  assert.ok(Math.abs(room.x + 3.6) < 1e-9 && Math.abs(room.z + 0.6) < 1e-9);
  assert.equal(geo3d.TWIN_ROOM_WALL_HEIGHT, 2.25);
});

test('room shape templates support rectangle, L, U and custom outlines with editable concave space', () => {
  const metadata = drafting.createTwinDraftingMetadata();
  const shapes = ['RECTANGLE', 'L_SHAPE', 'U_SHAPE', 'CUSTOM'];
  for (const shape of shapes) {
    const changed = drafting.changeRoomShape(metadata, roomId, shape);
    assert.equal(changed.rooms[roomId].shape, shape);
    assert.ok(changed.rooms[roomId].points.length >= 4);
    assert.match(drafting.polygonCss(changed.rooms[roomId].points), /^polygon\(/);
  }
  const lShape = drafting.roomShapePoints('L_SHAPE');
  assert.equal(drafting.pointInPolygon({ x: 0.2, y: 0.8 }, lShape), true);
  assert.equal(drafting.pointInPolygon({ x: 0.8, y: 0.8 }, lShape), false);
  const custom = drafting.changeRoomDrafting(drafting.changeRoomShape(metadata, roomId, 'CUSTOM'), roomId, {
    shape: 'CUSTOM', points: [{ x: -.4, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], widthMeters: 4.2,
  });
  assert.equal(custom.rooms[roomId].points[0].x, 0);
  assert.equal(custom.rooms[roomId].widthMeters, 4.2);
  assert.equal(drafting.sameTwinDrafting(metadata, custom), false);

  const rotated = drafting.transformRoomPoints(lShape, 'ROTATE_RIGHT');
  assert.deepEqual(rotated[0], { x: 1, y: 0 });
  assert.equal(drafting.pointInPolygon({ x: 0.2, y: 0.2 }, rotated), true);
  assert.equal(drafting.pointInPolygon({ x: 0.2, y: 0.8 }, rotated), false);
  assert.deepEqual(drafting.transformRoomPoints(rotated, 'ROTATE_LEFT'), lShape);
  assert.deepEqual(drafting.transformRoomPoints(drafting.transformRoomPoints(lShape, 'FLIP_HORIZONTAL'), 'FLIP_HORIZONTAL'), lShape);
});

test('grid and edge snapping align rooms while overlap warnings remain floor-scoped', () => {
  const anchor = { roomId: 'anchor', floor: 1, x: .1, y: .1, width: .3, height: .3 };
  const moving = { roomId: 'moving', floor: 1, x: .405, y: .101, width: .2, height: .2 };
  const result = geo.snapRoom(moving, [anchor], { grid: false, edges: true });
  assert.equal(result.room.x, .4);
  assert.deepEqual(result.guides.x, [.4]);
  assert.deepEqual([...geo.overlappingRoomIds([anchor, { ...moving, x: .35 }])].sort(), ['anchor', 'moving']);
  assert.equal(geo.overlappingRoomIds([anchor, { ...moving, x: .35, floor: 2 }]).size, 0);
  assert.equal(geo.snapPoint(.113, true), .125);
});

test('shape-aware placement excludes missing corners and the 3D room uses the same outline metadata', () => {
  const room = { roomId, floor: 1, x: .1, y: .1, width: .5, height: .5 };
  const lShape = { shape: 'L_SHAPE', points: drafting.roomShapePoints('L_SHAPE'), floorHeightMeters: 3.1, wallThicknessMeters: .2 };
  assert.equal(geo.roomContainsPoint(room, .2, .5, lShape.points), true);
  assert.equal(geo.roomContainsPoint(room, .52, .52, lShape.points), false);
  const world = geo3d.roomToWorldWithDrafting(room, lShape, .8);
  assert.equal(world.outline.length, lShape.points.length);
  assert.equal(world.wallHeight, 3.1);
  assert.equal(world.wallThickness, .2);
  assert.equal(world.customShape, true);
  assert.equal(world.y, .8);
});

test('2D editor exposes quick draw, shape, snapping and blueprint tools; precise room inspector is optional', async () => {
  const store = await ready();
  edit(store);
  const editor = render(store);
  for (const label of ['Vẽ nhanh', 'Nhập kích thước', 'Chữ nhật', 'Chữ L', 'Chữ U', 'Tự vẽ', 'Bắt lưới', 'Bắt cạnh', 'Chọn ảnh bản vẽ từ máy']) assert.ok(editor.includes(label), label);
  const metadata = drafting.changeRoomShape(drafting.createTwinDraftingMetadata(), roomId, 'L_SHAPE');
  const inspector = renderToString(React.createElement(Provider, { store }, React.createElement(TwinLayoutInspector, {
    geometry: draft(store), drafting: metadata, mode: 'precise', selection: { kind: 'room', id: roomId }, editable: true,
    onChange: () => {}, onDraftingChange: () => {},
  })));
  for (const label of ['Kích thước thực tế tùy chọn', 'Chiều rộng (m)', 'Chiều sâu (m)', 'Chiều cao tầng (m)', 'Độ dày tường (m)', 'Chữ L']) assert.ok(inspector.includes(label), label);
});

test('multi-floor presentation groups rooms, filters a floor, and persists floor metadata in Backend writes', () => {
  const rooms = [
    { roomId: 'f1', floor: 1, x: .05, y: .05, width: .4, height: .4 },
    { roomId: 'f2', floor: 2, x: .05, y: .05, width: .4, height: .4 },
    { roomId: 'f3', floor: 3, x: .05, y: .05, width: .4, height: .4 },
  ];
  const geometry = { rooms, nodes: [
    { nodeType: 'DEVICE', nodeId: 'd1', roomId: 'f1', x: .2, y: .2 },
    { nodeType: 'SENSOR', nodeId: 's2', roomId: 'f2', x: .2, y: .2 },
  ] };
  assert.deepEqual(geo3d.layoutFloors(rooms), [1, 2, 3]);
  assert.equal(geo3d.floorElevation(3, false), geo3d.TWIN_STOREY_HEIGHT * 2);
  assert.equal(geo3d.floorElevation(3, true), geo3d.TWIN_EXPLODED_STOREY_HEIGHT * 2);
  assert.deepEqual(geo3d.geometryForFloor(geometry, 2), { rooms: [rooms[1]], nodes: [geometry.nodes[1]] });
  const roomElevation = geo3d.floorElevation(2, true);
  assert.equal(geo3d.roomToWorld(rooms[1], roomElevation).y, roomElevation);
  const placed = geo3d.resolvePlacedNodes(geometry, ['d1'], ['s2'], new Map([['f2', roomElevation]]));
  assert.equal(placed[1].y, roomElevation + geo3d.TWIN_MARKER_ELEVATION);
  assert.deepEqual(geo.layoutRequest(geometry, 1).rooms.map((room) => room.floor), [1, 2, 3]);
});

test('3D placement resolves DEVICE/SENSOR identities exactly and never invents positions for unplaced runtime nodes', () => {
  const exactSensorId = 'device:TeMp:stream';
  const geometry = { rooms: saved.rooms, nodes: [
    saved.nodes[0],
    { nodeType: 'SENSOR', nodeId: exactSensorId, roomId, x: 0.3, y: 0.45 },
    { nodeType: 'SENSOR', nodeId: 'not-in-runtime', roomId, x: 0.4, y: 0.4 },
  ] };
  const placed = geo3d.resolvePlacedNodes(geometry, [deviceId, 'unplaced-device'], [exactSensorId, 'unplaced-sensor']);
  assert.deepEqual(placed.map((node) => `${node.nodeType}:${node.nodeId}`), [`DEVICE:${deviceId}`, `SENSOR:${exactSensorId}`]);
  assert.deepEqual({ nodeType: placed[1].nodeType, nodeId: placed[1].nodeId, roomId: placed[1].roomId, y: placed[1].y }, { nodeType: 'SENSOR', nodeId: exactSensorId, roomId, y: geo3d.TWIN_MARKER_ELEVATION });
  assert.ok(Math.abs(placed[1].x + 3.6) < 1e-9 && Math.abs(placed[1].z + 0.6) < 1e-9);
  assert.deepEqual(geo3d.resolveUnplacedNodes(geometry, [deviceId, 'unplaced-device'], [exactSensorId, 'unplaced-sensor']), { deviceIds: ['unplaced-device'], sensorIds: ['unplaced-sensor'] });
});

test('3D camera bounds fit the current room geometry rather than one hard-coded fixture', () => {
  const bounds = geo3d.homeBounds([{ roomId: 'a', x: 0.2, y: 0.1, width: 0.3, height: 0.4 }, { roomId: 'b', x: 0.6, y: 0.5, width: 0.2, height: 0.25 }]);
  assert.ok(Math.abs(bounds.centerX) < 1e-9 && Math.abs(bounds.centerZ + 0.9) < 1e-9);
  assert.equal(bounds.width, 10.8); assert.equal(bounds.depth, 7.8);
  const pose = geo3d.cameraPoseForBounds(bounds);
  assert.ok(Math.abs(pose.target[0]) < 1e-9 && pose.target[1] === 0 && Math.abs(pose.target[2] + 0.9) < 1e-9);
  assert.ok(pose.maxDistance > pose.minDistance && pose.position[1] > 0);
});

test('2D/3D switcher exposes stable pressed state without mutating layout', () => {
  const noop = () => {};
  const twoD = renderToString(React.createElement(TwinViewSwitcher, { mode: '2d', onChange: noop }));
  const threeD = renderToString(React.createElement(TwinViewSwitcher, { mode: '3d', onChange: noop }));
  assert.match(twoD, /aria-label="Chế độ 2D" aria-pressed="true"/);
  assert.match(twoD, /aria-label="Chế độ 3D" aria-pressed="false"/);
  assert.match(threeD, /aria-label="Chế độ 3D" aria-pressed="true"/);
  const overview = renderToString(React.createElement(TwinViewSwitcher, { mode: 'overview', onChange: noop }));
  assert.match(overview, /aria-label="Chế độ Overview" aria-pressed="true"/);
  for (const label of ['Overview', '2D Layout', '3D Live']) assert.ok(overview.includes(label));
  assert.deepEqual(saved.rooms[0], { roomId, floor: 1, x: 0.05, y: 0.05, width: 0.45, height: 0.4 });
});

test('presentation maps real types and metrics, falls back safely, and preserves identifiers', () => {
  const { deviceVisualKind, sensorVisualKind, knownPower, healthSymbols, summarizeState } = loadSource('src/components/twin/twinPresentation.ts');
  for (const [type, expected] of [['LIGHT', 'light'], ['FAN', 'fan'], ['AC', 'ac'], ['IR_REMOTE', 'remote'], ['SMART_PLUG', 'plug'], ['TV', 'generic'], ['UNKNOWN', 'generic']]) assert.equal(deviceVisualKind(type), expected);
  for (const [metric, expected] of [['TEMPERATURE', 'temperature'], ['humidity', 'humidity'], ['LIGHT', 'light'], ['MOTION', 'motion'], ['AIR_QUALITY', 'air'], ['CO2', 'gas'], ['unknown', 'generic']]) assert.equal(sensorVisualKind(metric), expected);
  for (const state of [null, [], 'ON', {}, { power: 'maybe' }, { power: 1 }, { nested: { power: true } }]) assert.equal(knownPower(state), null);
  for (const state of [{ power: true }, { power: 'ON' }]) assert.equal(knownPower(state), true);
  for (const state of [{ power: false }, { power: 'OFF' }]) assert.equal(knownPower(state), false);
  assert.deepEqual(healthSymbols, { ACTIVE: 'A', STALE: '!', OFFLINE: '×' });
  assert.equal(summarizeState(null), 'Chưa có dữ liệu');
  assert.match(summarizeState({ nested: { values: [null, true, 3] } }), /nested: values: 3 giá trị/);
});

test('decor recognizes Vietnamese and English offices and keeps unknown rooms neutral', () => {
  const { roomKind } = loadSource('src/components/twin/roomKind.ts');
  for (const [names, kind] of [[['Phòng khách', 'Living Room'], 'living'], [['Phòng ngủ', 'Bedroom'], 'bedroom'], [['Nhà bếp', 'Bếp', 'Kitchen'], 'kitchen'], [['Phòng tắm', 'Bathroom'], 'bathroom'], [['Phòng làm việc', 'Office', 'Study Room'], 'office']]) for (const name of names) assert.equal(roomKind(name), kind);
  assert.equal(roomKind('Kho'), 'other');
});

test('Overview derives health and all unplaced objects from confirmed layout without an API', async () => {
  const store = await ready();
  const { TwinOverview } = loadSource('src/components/twin/TwinOverview.tsx');
  const { selectTwinHealthCounts } = loadSource('src/store/twinSelectors.ts');
  const renderOverview = () => renderToString(React.createElement(Provider, { store }, React.createElement(TwinOverview, { geometry: saved })));
  const requestsBefore = requests.length;
  const counts = selectTwinHealthCounts(store.getState());
  assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), store.getState().twin.deviceIds.length + store.getState().twin.sensorIds.length);
  const html = renderOverview();
  for (const text of ['My Home', 'Chưa đặt', 'ACTIVE', 'STALE', 'OFFLINE']) assert.ok(html.includes(text));
  const unplaced = geo3d.resolveUnplacedNodes(saved, store.getState().twin.deviceIds, store.getState().twin.sensorIds);
  const count = snapshot.rooms.length - saved.rooms.length + unplaced.deviceIds.length + unplaced.sensorIds.length;
  assert.match(html, new RegExp('Chưa đặt</dt><dd[^>]*>' + count + '</dd>'));
  assert.equal(requests.length, requestsBefore);
  assert.strictEqual(selectTwinHealthCounts(store.getState()), counts);
});

test('empty Home never mounts an editor canvas and defaults to 3D Live', async () => {
  const store = await ready();
  store.dispatch(twin.loadTwinSnapshot.pending('empty-home-request', homeId));
  store.dispatch(twin.loadTwinSnapshot.fulfilled({ ...snapshot, rooms: [], unassignedDevices: [], unassignedSensors: [] }, 'empty-home-request', homeId));
  const html = renderToString(React.createElement(Provider, { store }, React.createElement(TwinLayoutEditor, { homeId })));
  assert.match(html, /aria-label="Chế độ 3D" aria-pressed="true"/);
  assert.match(html, /Hãy tạo phòng cho ngôi nhà/);
  assert.doesNotMatch(html, /data-room-id=|twin-3d-stage|twin-canvas /);
});

test('rooms without layout show OWNER design action, MEMBER empty message, and unplaced counts', async () => {
  const store = await ready();
  const { Twin3DView } = loadSource('src/components/twin/Twin3DView.tsx');
  const renderView = (role) => renderToString(React.createElement(Provider, { store }, React.createElement(Twin3DView, { geometry: empty, drafting: drafting.createTwinDraftingMetadata(), role, onEdit2D: () => {} })));
  const owner = renderView('OWNER');
  assert.match(owner, /Chưa có sơ đồ nhà/);
  assert.match(owner, /Thiết kế sơ đồ/);
  assert.match(owner, /Unplaced/);
  const member = renderView('MEMBER');
  assert.match(member, /Chủ nhà chưa thiết lập sơ đồ Digital Twin/);
  assert.doesNotMatch(member, />Thiết kế sơ đồ</);
  assert.doesNotMatch(owner, /twin-3d-stage/);
});

test('inspector reads unplaced nodes, null and nested state, and business room independently of marker room', async () => {
  const store = await ready();
  emit(store, { ...deviceEvent, data: { ...deviceEvent.data, currentState: null } });
  const renderInspector = (id) => renderToString(React.createElement(Provider, { store }, React.createElement(Twin3DInspector, { geometry: empty, selection: { kind: 'node', id }, onSelect: () => {}, onEdit2D: () => {} })));
  assert.match(renderInspector(`DEVICE:${deviceId}`), /Chưa có dữ liệu/);
  assert.match(renderInspector(`DEVICE:${deviceId}`), /Chưa đặt vào layout/);
  emit(store, { ...deviceEvent, data: { ...deviceEvent.data, currentState: { power: true, nested: { array: [1, null, false] } } } });
  assert.match(renderInspector(`DEVICE:${deviceId}`), /nested/);
  assert.match(renderInspector(`SENSOR:${sensorId}`), /TEMPERATURE/);
  assert.match(renderInspector(`SENSOR:${sensorId}`), /Bedroom/);
});

test('3D inspector renders selected Room, Device and exact Sensor runtime state from Redux', async () => {
  const store = await ready();
  const inspector = (selection) => renderToString(React.createElement(Provider, { store }, React.createElement(Twin3DInspector, { geometry: saved, selection, onSelect: () => {}, onEdit2D: () => {} })));
  assert.match(inspector({ kind: 'room', id: roomId }), /Living Room/);
  assert.match(inspector({ kind: 'node', id: `DEVICE:${deviceId}` }), /Ceiling light/);
  assert.match(inspector({ kind: 'node', id: `SENSOR:${sensorId}` }), /TEMPERATURE/);
});

test('realtime runtime changes never alter 3D world position', async () => {
  const store = await ready();
  const before = geo3d.nodeToWorld(saved.nodes[1]);
  emit(store, { ...sensorEvent, data: { ...sensorEvent.data, latestValue: 30, observedAt: '2026-09-17T09:01:00Z' } });
  emit(store, { ...healthEvent, timestamp: '2026-09-17T09:02:00Z', data: { ...healthEvent.data, healthStatus: 'OFFLINE', referenceTime: '2026-09-17T09:01:00Z', evaluatedAt: '2026-09-17T09:02:00Z' } });
  assert.equal(store.getState().twin.sensorsById[sensorId].latestValue, 30);
  assert.equal(store.getState().twin.sensorsById[sensorId].healthStatus, 'OFFLINE');
  assert.deepEqual(geo3d.nodeToWorld(saved.nodes[1]), before);
});

test('WebGL support guard fails safely outside a browser', () => {
  assert.equal(supportsWebGL(), false);
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

