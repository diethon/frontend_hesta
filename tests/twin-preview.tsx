// Development-only fixture harness. Not imported by the application or production build.
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createHashRouter, Link, Navigate, Route, RouterProvider, Routes } from 'react-router';
import { createAppStore } from '../src/store/store';
import { apiClient } from '../src/services/apiClient';
import { DigitalTwinPage } from '../src/components/twin/DigitalTwinPage';
import { connectionStatusChanged, homeSubscriptionChanged, realtimeEventReceived } from '../src/store/realtimeSlice';
import { parseRealtimeEvent } from '../src/realtime/realtimeTypes';
import snapshotFixture from './fixtures/twin/twin-snapshot.json';
import sensorFixture from './fixtures/twin/twin-sensor-event.json';
import deviceFixture from './fixtures/twin/twin-device-event.json';
import healthFixture from './fixtures/twin/twin-health-event.json';
import '../src/index.css';

const store = createAppStore();
const homeId = snapshotFixture.result.homeId;
let count = 0;
let fail = false;
apiClient.defaults.adapter = async (config) => {
  count += 1;
  if (fail) throw new Error('Fixture error');
  if (config.url?.endsWith('/my-homes')) return { data: { code: 1000, result: [{ homeId, role: 'OWNER' }] }, status: 200, statusText: 'OK', headers: {}, config };
  if (config.url?.endsWith('/twin-layout')) return { data: { code: 1000, result: { homeId: config.url.includes('/home-b/') ? 'home-b' : homeId, revision: 0, rooms: [], nodes: [] } }, status: 200, statusText: 'OK', headers: {}, config };
  const isOther = config.url?.includes('/home-b/');
  const result = isOther ? { ...snapshotFixture.result, homeId: 'home-b', name: 'Nhà B', rooms: [] } : snapshotFixture.result;
  store.dispatch(connectionStatusChanged('connected'));
  store.dispatch(homeSubscriptionChanged(result.homeId));
  return { data: { code: 1000, result }, status: 200, statusText: 'OK', headers: {}, config };
};
export function FixtureControls() {
  const [shownCount, setShownCount] = useState(0);
  const emit = (event: unknown) => { store.dispatch(realtimeEventReceived(parseRealtimeEvent(event))); setShownCount(count); };
  return <div className="flex flex-wrap items-center gap-3 border-b border-line bg-warning-soft p-4 text-sm text-text lg:ml-64">
    <strong>Fixture test only</strong>
    <button onClick={() => { setShownCount(count); }}>Count REST requests</button><output>REST requests: {shownCount}</output>
    <button onClick={() => emit({ ...sensorFixture, data: { ...sensorFixture.data, latestValue: 30, observedAt: '2026-09-17T09:01:00Z' }, timestamp: '2026-09-17T09:01:00Z' })}>Sensor → 30</button>
    <button onClick={() => emit({ ...deviceFixture, data: { ...deviceFixture.data, currentState: { power: 'OFF' } } })}>Device → OFF</button>
    {(['STALE', 'OFFLINE', 'ACTIVE'] as const).map((healthStatus, index) => <button key={healthStatus} onClick={() => emit({ ...healthFixture, data: { ...healthFixture.data, healthStatus, referenceTime: '2026-09-17T09:01:00Z', evaluatedAt: `2026-09-17T09:0${index + 2}:00Z` } })}>{healthStatus}</button>)}
    <button onClick={() => store.dispatch(connectionStatusChanged('reconnecting'))}>Disconnect</button>
    <button onClick={() => store.dispatch(connectionStatusChanged('connected'))}>Reconnect</button>
    <button onClick={() => { fail = !fail; }}>Toggle API error</button>
    <Link to={`/home/${homeId}/digital-twin`}>Home A</Link><Link to="/home/home-b/digital-twin">Home B</Link>
  </div>;
}
const root = createRoot(document.getElementById('root')!);
import.meta.hot?.dispose(() => root.unmount());
const router = createHashRouter([{ path: '*', element: <>
  <FixtureControls /><Routes>
    <Route path="/home/:homeId/digital-twin" element={<DigitalTwinPage />} />
    <Route path="*" element={<Navigate to={`/home/${homeId}/digital-twin`} replace />} />
  </Routes>
</> }]);
root.render(<StrictMode><Provider store={store}><RouterProvider router={router} /></Provider></StrictMode>);
