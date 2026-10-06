// Development-only fixture server adapter; never imported by the production app.
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { _roots } from '@react-three/fiber';
import { Box3, Mesh, PointLight, Vector3 } from 'three';
import { Provider } from 'react-redux';
import { createHashRouter, Link, Navigate, Outlet, RouterProvider } from 'react-router';
import { createAppStore } from '../src/store/store';
import { apiClient } from '../src/services/apiClient';
import { DigitalTwinPage } from '../src/components/twin/DigitalTwinPage';
import { connectionStatusChanged, homeSubscriptionChanged, realtimeEventReceived } from '../src/store/realtimeSlice';
import { parseRealtimeEvent } from '../src/realtime/realtimeTypes';
import { loadLayoutRole } from '../src/store/twinLayoutSlice';
import type { TwinLayout } from '../src/types/twinLayout';
import snapshotFixture from './fixtures/twin/twin-snapshot.json';
import sensorFixture from './fixtures/twin/twin-sensor-event.json';
import deviceFixture from './fixtures/twin/twin-device-event.json';
import healthFixture from './fixtures/twin/twin-health-event.json';
import '../src/index.css';
import { referenceLayout, referenceSnapshot } from './twin-reference-fixture';
import { multiFloorLayout, multiFloorSnapshot } from './twin-multifloor-fixture';

const store = createAppStore();
declare global { interface Window { __twinFixtureScene: () => unknown; __twinFixtureEmitDevice: (id: string, state: import('../src/types/twin').JsonValue) => void; } }
let deviceEventIndex = 10;
window.__twinFixtureEmitDevice = (id, currentState) => {
  const device = store.getState().twin.devicesById[id];
  if (!device) throw new Error('Unknown fixture device');
  const timestamp = new Date(Date.UTC(2026, 9, 4, 10, deviceEventIndex++)).toISOString();
  store.dispatch(realtimeEventReceived(parseRealtimeEvent({ ...deviceFixture, eventId: `fixture-device-${deviceEventIndex}`, deviceId: id, timestamp, data: { ...device, currentState, lastSeen: timestamp } })));
};
// Test-only access to actual WebGL objects; never imported by the production application.
window.__twinFixtureScene = () => {
  const canvas = document.querySelector('.twin-3d-stage canvas') as HTMLCanvasElement | null;
  const state = canvas ? _roots.get(canvas)?.store.getState() : undefined;
  if (!state) return null;
  const meshes: { geometry: string; positions: number; material: string; masks?: unknown; role?: string; bounds?: number[][] }[] = [];
  const lights: { intensity: number; color: string }[] = [];
  const floors: { name: string; y: number; bounds: number[][] }[] = [];
  const roomSurfaces: { id: string; color: string; opacity: number }[] = [];
  const deviceModels: { id: string; world: number[]; screen: number[]; geometry: string[]; meshes: number; emissive: number; animation: number[] }[] = [];
  const projected: number[][] = [];
  state.scene.traverse((object) => {
    if (object.name.includes(':floor:')) { const box = new Box3().setFromObject(object); floors.push({ name: object.name, y: object.position.y, bounds: [box.min.toArray(), box.max.toArray()] }); }
    if (object.name.startsWith('room:')) { const mesh = object.children.find((child) => child instanceof Mesh); if (mesh instanceof Mesh && !Array.isArray(mesh.material) && 'color' in mesh.material && 'opacity' in mesh.material) roomSurfaces.push({ id: object.name.slice(5), color: (mesh.material.color as import('three').Color).getHexString(), opacity: mesh.material.opacity }); }
    if (object.name.startsWith('DEVICE:') || object.name.startsWith('SENSOR:')) {
      let meshCount = 0, emissive = 0;
      const animation: number[] = [];
      const geometry: string[] = [];
      object.traverse((child) => { animation.push(child.rotation.y); if (child instanceof Mesh) { meshCount++; const m = Array.isArray(child.material) ? child.material[0] : child.material; if ('emissiveIntensity' in m) emissive = Math.max(emissive, Number(m.emissiveIntensity)); } });
      object.traverse((child) => { if (child instanceof Mesh) geometry.push(child.geometry.uuid); });
      const center = new Box3().setFromObject(object).getCenter(new Vector3()).project(state.camera);
      deviceModels.push({ id: object.name, world: object.getWorldPosition(new Vector3()).toArray(), screen: [(center.x + 1) * state.size.width / 2, (1 - center.y) * state.size.height / 2], geometry, meshes: meshCount, emissive, animation });
    }
    if (object instanceof PointLight) lights.push({ intensity: object.intensity, color: object.color.getHexString() });
    if (object instanceof Mesh) {
      const material = Array.isArray(object.material) ? object.material[0] : object.material;
      meshes.push({ geometry: object.geometry.uuid, positions: object.geometry.getAttribute('position')?.count ?? 0, material: material.type, ...(material.userData.twinFoldMasks ? { masks: material.userData.twinFoldMasks, role: material.userData.twinFoldRole } : {}) });
      // Project visible structural geometry, excluding the ground plane and HTML overlays.
      if (object.parent?.name.includes(':floor:') && object.geometry.getAttribute('position')) {
        const positions = object.geometry.getAttribute('position'), folds = object.geometry.getAttribute('fold'), masks = material.userData.twinFoldMasks;
        for (let i = 0; i < positions.count; i++) {
          if (folds && masks) { const f = folds.getX(i), kind = Math.floor(f / 16), bucket = f % 16, standing = !!(masks.standing.value & (1 << bucket)); if (f >= 0 && (kind === 0 ? !standing : kind === 1 || kind === 3 ? standing : false)) continue; }
          const p = new Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).project(state.camera);
          projected.push([p.x, p.y]);
        }
      }
    }
  });
  const controls = state.controls && 'target' in state.controls ? state.controls as unknown as { target: Vector3 } : null;
  const extent = projected.length ? { width: (Math.max(...projected.map((p) => p[0])) - Math.min(...projected.map((p) => p[0]))) / 2, height: (Math.max(...projected.map((p) => p[1])) - Math.min(...projected.map((p) => p[1]))) / 2 } : null;
  return { background: state.scene.background && 'getHexString' in state.scene.background ? state.scene.background.getHexString() : null, dpr: state.gl.getPixelRatio(), meshes, lights, floors, roomSurfaces, deviceModels, extent, camera: state.camera.position.toArray(), target: controls?.target.toArray(), render: state.gl.info.render, size: state.size, devices: store.getState().twin.devicesById, snapshotRequests: requests.filter((r) => r.url?.endsWith('/twin')).length };
};
const homeId = snapshotFixture.result.homeId;
const initial: TwinLayout = { homeId, revision: 3,
  rooms: snapshotFixture.result.rooms.map((room, index) => ({ roomId: room.roomId, x: index ? 0.53 : 0.03, y: 0.04, width: 0.44, height: 0.88 })),
  nodes: [
    { nodeType: 'DEVICE', nodeId: deviceFixture.data.deviceId, roomId: snapshotFixture.result.rooms[0].roomId, x: 0.23, y: 0.35 },
    { nodeType: 'SENSOR', nodeId: sensorFixture.data.sensorId, roomId: snapshotFixture.result.rooms[1].roomId, x: 0.75, y: 0.55 },
  ],
};
const query = new URLSearchParams(location.search);
const multiFloor = query.has('multifloor');
const reference = query.has('reference');
const demo = reference || multiFloor;
const extraModels = query.has('models');
const modelDevices = [
  { deviceId: 'fan', name: 'Quạt trần', deviceType: 'FAN', roomId: 'living' },
  { deviceId: 'camera', name: 'Camera phòng khách', deviceType: 'CAMERA', roomId: 'living' },
  { deviceId: 'tv', name: 'TV phòng khách', deviceType: 'TV', roomId: 'living' },
  { deviceId: 'door', name: 'Cửa thông minh', deviceType: 'DOOR', roomId: 'living' },
  { deviceId: 'window', name: 'Cửa sổ thông minh', deviceType: 'WINDOW', roomId: 'bedroom' },
  { deviceId: 'blind', name: 'Rèm thông minh', deviceType: 'BLIND', roomId: 'kitchen' },
].map((d) => ({ ...d, icon: null, status: 'ONLINE' as const, currentState: { power: 'ON', open: false, position: 0, speed: 30 }, lastSeen: '2026-09-18T08:00:00Z', healthStatus: 'ACTIVE' as const }));
const demoSnapshot = multiFloor ? multiFloorSnapshot : extraModels ? { ...referenceSnapshot, rooms: referenceSnapshot.rooms.map((room) => ({ ...room, devices: [...room.devices, ...modelDevices.filter((d) => d.roomId === room.roomId)] })) } : referenceSnapshot;
const demoLayout = multiFloor ? multiFloorLayout : extraModels ? { ...referenceLayout, nodes: [...referenceLayout.nodes, ...modelDevices.map((d, index) => ({ nodeType: 'DEVICE' as const, nodeId: d.deviceId, roomId: d.roomId, x: d.roomId === 'bedroom' ? .75 : .15 + index % 3 * .12, y: d.roomId === 'kitchen' ? .7 : .22 + index % 2 * .14 }))] } : referenceLayout;
const referenceRoomIds = demoSnapshot.rooms.map((room) => room.roomId);
const runtimeSensorFixture = demo ? { ...sensorFixture, deviceId: 'temperature', data: { ...sensorFixture.data, sensorId: 'temperature', deviceId: 'temperature', roomId: referenceRoomIds[0] } } : sensorFixture;
const runtimeDeviceFixture = demo ? { ...deviceFixture, deviceId: 'main-light', data: { ...deviceFixture.data, deviceId: 'main-light', roomId: referenceRoomIds[0], name: multiFloor ? 'Đèn phòng khách' : 'Đèn chính', deviceType: 'LIGHT' as const } } : deviceFixture;
const runtimeHealthFixture = demo ? { ...healthFixture, deviceId: 'temperature', data: { ...healthFixture.data, nodeId: 'temperature', deviceId: 'temperature', roomId: referenceRoomIds[0] } } : healthFixture;
const key = multiFloor ? 'hesta-layout-multifloor-only' : reference ? 'hesta-layout-reference-only' : 'hesta-layout-fixture-only';
// Browser storage here emulates the fixture server, never the production persistence layer.
let saved: TwinLayout = JSON.parse(localStorage.getItem(key) ?? 'null') ?? (demo ? demoLayout : initial);
let role: 'OWNER' | 'MEMBER' = 'OWNER';
let fail = false;
let forbidden = false;
const requests: { method?: string; url?: string; body?: unknown }[] = [];
apiClient.defaults.adapter = async (config) => {
  requests.push({ method: config.method, url: config.url, body: config.data ? JSON.parse(config.data) : undefined });
  if (config.url?.startsWith('/devices/')) {
    const deviceId = decodeURIComponent(config.url.split('/')[2]);
    const snapshot = demo ? demoSnapshot : snapshotFixture.result;
    const device = [...snapshot.rooms.flatMap((room) => room.devices), ...snapshot.unassignedDevices].find((item) => item.deviceId === deviceId);
    if (config.method === 'get') return { config, data: { code: 1000, result: device ? { id: deviceId, homeId, name: device.name, deviceType: device.deviceType, capabilities: { POWER: ['TURN_ON', 'TURN_OFF'], LIGHT: ['SET_BRIGHTNESS', 'SET_COLOR'] } } : null }, status: 200, statusText: 'OK', headers: {} };
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { config, data: { code: 1000, result: config.url.endsWith('/commands') ? { command: { success: true, status: 'SUCCESS' } } : { success: true, status: 'SUCCESS' } }, status: 200, statusText: 'OK', headers: {} };
  }
  if (config.url?.endsWith('/my-homes')) return { config, data: { code: 1000, result: [{ homeId, role }, { homeId: 'home-b', role }] }, status: 200, statusText: 'OK', headers: {} };
  const id = config.url?.includes('/home-b/') ? 'home-b' : homeId;
  let result: unknown;
  if (config.url?.endsWith('/twin-layout')) {
    if (fail) throw new Error('Fixture network error');
    if (config.method === 'put') {
      const body = JSON.parse(config.data);
      if (forbidden || role === 'MEMBER') throw { response: { status: 403, data: { code: 1005, message: 'Forbidden' } } };
      if (body.expectedRevision !== saved.revision) throw { response: { status: 409, data: { code: 1130, message: 'Revision conflict' } } };
      saved = { homeId, revision: saved.revision + 1, rooms: body.rooms, nodes: body.nodes, architecture: body.architecture ?? saved.architecture };
      localStorage.setItem(key, JSON.stringify(saved));
    }
    result = id === homeId ? saved : { homeId: id, revision: 0, rooms: [], nodes: [] };
  } else {
    result = id === homeId ? demo ? demoSnapshot : snapshotFixture.result : { ...snapshotFixture.result, homeId: id, name: 'Nhà B', rooms: [], unassignedDevices: [], unassignedSensors: [] };
    store.dispatch(connectionStatusChanged('connected'));
    store.dispatch(homeSubscriptionChanged(id));
  }
  return { config, data: { code: 1000, result }, status: 200, statusText: 'OK', headers: {} };
};

export function LayoutFixtureShell() {
  const [count, setCount] = useState('');
  const [snapshotCount, setSnapshotCount] = useState(0);
  const [json, setJson] = useState('');
  const emit = (event: unknown) => store.dispatch(realtimeEventReceived(parseRealtimeEvent(event)));
  return <><details className="border-b border-line bg-warning-soft p-4 text-sm lg:ml-64"><summary>Fixture controls · Không dùng backend thật</summary><div className="mt-3 flex flex-wrap gap-4">
    <button onClick={() => { setCount(`${requests.length} REST; ${requests.filter((r) => r.method === 'put').length} PUT`); setSnapshotCount(requests.filter((request) => request.url?.endsWith('/twin')).length); }}>Count requests</button><output>{count}</output><output data-twin-snapshot-requests>{snapshotCount} snapshots</output>
    <button onClick={() => setJson(JSON.stringify({ layout: store.getState().twinLayout, requests }, null, 2))}>Inspect geometry / requests</button>
    <button onClick={() => emit({ ...runtimeSensorFixture, data: { ...runtimeSensorFixture.data, latestValue: 30, observedAt: '2026-09-19T10:00:00Z' }, timestamp: '2026-09-19T10:00:00Z' })}>Sensor → 30</button>
    <button onClick={() => emit({ ...runtimeSensorFixture, data: { ...runtimeSensorFixture.data, latestValue: 31, observedAt: '2026-09-19T10:04:00Z' }, timestamp: '2026-09-19T10:04:00Z' })}>Sensor → 31</button>
    <button onClick={() => emit({ ...runtimeDeviceFixture, data: { ...runtimeDeviceFixture.data, currentState: { power: 'OFF' }, lastSeen: '2026-09-19T10:00:00Z' }, timestamp: '2026-09-19T10:00:00Z' })}>Device → OFF</button>
    <button onClick={() => emit({ ...runtimeDeviceFixture, data: { ...runtimeDeviceFixture.data, currentState: { power: 'ON', brightness: 35, color: { r: 255, g: 100, b: 45 } }, lastSeen: '2026-09-19T10:05:00Z' }, timestamp: '2026-09-19T10:05:00Z' })}>Device → RGB 35%</button>
    {(['STALE', 'OFFLINE', 'ACTIVE'] as const).map((healthStatus, index) => <button key={healthStatus} onClick={() => emit({ ...runtimeHealthFixture, timestamp: `2026-09-19T10:0${index + 1}:00Z`, data: { ...runtimeHealthFixture.data, healthStatus, referenceTime: '2026-09-19T10:00:00Z', evaluatedAt: `2026-09-19T10:0${index + 1}:00Z` } })}>{healthStatus}</button>)}
    <button onClick={() => { saved = { ...saved, revision: saved.revision + 1 }; }}>Simulate concurrent save</button>
    <button onClick={() => { fail = !fail; }}>Toggle layout failure</button>
    <button onClick={() => { forbidden = !forbidden; }}>Toggle 403</button>
    <button onClick={() => { role = role === 'OWNER' ? 'MEMBER' : 'OWNER'; void store.dispatch(loadLayoutRole(store.getState().twinLayout.homeId ?? homeId)); }}>Toggle OWNER / MEMBER</button>
    <button onClick={() => { saved = { homeId, revision: 0, rooms: [], nodes: [] }; localStorage.setItem(key, JSON.stringify(saved)); }}>Empty fixture layout</button>
    <button onClick={() => { saved = demo ? demoLayout : initial; localStorage.setItem(key, JSON.stringify(saved)); }}>Restore fixture layout</button>
    <Link to={`/home/${homeId}/digital-twin`}>Home A</Link><Link to="/home/home-b/digital-twin">Home B</Link><a href="/tests/twin-layout-preview.html?reference=1">Mẫu 1 tầng</a><a href="/tests/twin-layout-preview.html?multifloor=1">Mẫu 3 tầng</a><Link to="/home">Leave Twin</Link>
  </div>{json ? <pre className="mt-3 max-h-80 overflow-auto text-xs">{json}</pre> : null}</details><Outlet /></>;
}
const router = createHashRouter([{ element: <LayoutFixtureShell />, children: [
  { path: '/home/:homeId/digital-twin', element: <DigitalTwinPage /> },
  { path: '/home', element: <p className="p-8 lg:ml-64">Home selection fixture</p> },
  { path: '*', element: <Navigate to={`/home/${homeId}/digital-twin`} replace /> },
] }]);
const root = createRoot(document.getElementById('root')!);
import.meta.hot?.dispose(() => { root.unmount(); router.dispose(); });
root.render(<StrictMode><Provider store={store}><RouterProvider router={router} /></Provider></StrictMode>);
