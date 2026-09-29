import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { getTwinSnapshot } from '../services/twinApi';
import type { TwinDeviceSnapshotResponse, TwinHealthStatusChangedPayload, TwinHomeSnapshotResponse, TwinRoomSnapshotResponse, TwinSensorSnapshotResponse } from '../types/twin';
import { isTwinEvent, type TwinEvent } from '../realtime/twinEvents';
import { realtimeEventReceived } from './realtimeSlice';
import { currentHomeChanged, currentHomeCleared } from './homeSlice';
import { sessionEnded } from './authSlice';

export interface TwinRoom extends Omit<TwinRoomSnapshotResponse, 'devices' | 'sensors'> {
  deviceIds: string[];
  sensorIds: string[];
}

export interface TwinState {
  homeId: string | null;
  home: { homeId: string; name: string } | null;
  roomIds: string[];
  roomsById: Record<string, TwinRoom>;
  deviceIds: string[];
  devicesById: Record<string, TwinDeviceSnapshotResponse>;
  sensorIds: string[];
  sensorsById: Record<string, TwinSensorSnapshotResponse>;
  unassignedDeviceIds: string[];
  unassignedSensorIds: string[];
  loading: boolean;
  error: string | null;
  initialized: boolean;
  requestId: string | null;
  pendingEvents: TwinEvent[];
  healthUpdates: Record<string, TwinHealthStatusChangedPayload>;
}

export const emptyTwinState = (homeId: string | null = null): TwinState => ({
  homeId, home: null, roomIds: [], roomsById: {}, deviceIds: [], devicesById: {},
  sensorIds: [], sensorsById: {}, unassignedDeviceIds: [], unassignedSensorIds: [],
  loading: false, error: null, initialized: false, requestId: null, pendingEvents: [], healthUpdates: {},
});

function membership(state: TwinState, kind: 'deviceIds' | 'sensorIds', roomId: string | null) {
  return (roomId && state.roomsById[roomId]?.[kind])
    || (kind === 'deviceIds' ? state.unassignedDeviceIds : state.unassignedSensorIds);
}

function moveNode(state: TwinState, kind: 'deviceIds' | 'sensorIds', id: string, oldRoom: string | null | undefined, newRoom: string | null) {
  const next = membership(state, kind, newRoom);
  if (oldRoom !== undefined) {
    const previous = membership(state, kind, oldRoom);
    if (previous === next) return;
    const index = previous.indexOf(id);
    if (index !== -1) previous.splice(index, 1);
  }
  if (!next.includes(id)) next.push(id);
}

export function normalizeTwinSnapshot(snapshot: TwinHomeSnapshotResponse): TwinState {
  const state = emptyTwinState(snapshot.homeId);
  state.home = { homeId: snapshot.homeId, name: snapshot.name };
  for (const { roomId, homeId, name, icon } of snapshot.rooms) {
    state.roomIds.push(roomId);
    state.roomsById[roomId] = { roomId, homeId, name, icon, deviceIds: [], sensorIds: [] };
  }
  for (const group of [...snapshot.rooms, { devices: snapshot.unassignedDevices, sensors: snapshot.unassignedSensors }]) {
    for (const device of group.devices) {
      state.deviceIds.push(device.deviceId);
      state.devicesById[device.deviceId] = device;
      membership(state, 'deviceIds', device.roomId).push(device.deviceId);
    }
    for (const sensor of group.sensors) {
      state.sensorIds.push(sensor.sensorId);
      state.sensorsById[sensor.sensorId] = sensor;
      membership(state, 'sensorIds', sensor.roomId).push(sensor.sensorId);
    }
  }
  state.initialized = true;
  return state;
}

// Java/PostgreSQL timestamps can carry sub-millisecond precision that Date.parse drops.
const subMilliseconds = (value: string) =>
  (value.match(/\.(\d+)(?:Z|[+-]\d{2}:\d{2})$/)?.[1] ?? '').padEnd(9, '0').slice(3, 9);
function older(incoming: string | null, current: string | null) {
  if (current === null) return false;
  if (incoming === null) return true;
  const delta = Date.parse(incoming) - Date.parse(current);
  return delta < 0 || (delta === 0 && subMilliseconds(incoming) < subMilliseconds(current));
}

function applyEvent(state: TwinState, event: TwinEvent) {
  if (event.type === 'TWIN_HEALTH_STATUS_CHANGED') {
    const data = event.data;
    const node = data.nodeType === 'DEVICE' ? state.devicesById[data.nodeId] : state.sensorsById[data.nodeId];
    if (!node) return;
    const reference = 'lastSeen' in node ? node.lastSeen : node.observedAt;
    const key = `${data.nodeType}:${data.nodeId}`;
    const previous = state.healthUpdates[key];
    if (older(data.referenceTime, reference) || (previous && older(data.evaluatedAt, previous.evaluatedAt))) return;
    node.healthStatus = data.healthStatus;
    state.healthUpdates[key] = data;
    return;
  }
  if (event.type === 'DEVICE_STATE_CHANGED') {
    const data = event.data;
    const previous = state.devicesById[data.deviceId];
    // lastSeen is freshness, not a command sequence: accept equal timestamps.
    if (previous && older(data.lastSeen, previous.lastSeen)) return;
    moveNode(state, 'deviceIds', data.deviceId, previous?.roomId, data.roomId);
    if (!previous) state.deviceIds.push(data.deviceId);
    state.devicesById[data.deviceId] = { ...data };
    preserveNewerHealth(state, `DEVICE:${data.deviceId}`, state.devicesById[data.deviceId], data.lastSeen, event.timestamp);
  } else {
    const data = event.data;
    const previous = state.sensorsById[data.sensorId];
    if (previous && older(data.observedAt, previous.observedAt)) return;
    moveNode(state, 'sensorIds', data.sensorId, previous?.roomId, data.roomId);
    if (!previous) state.sensorIds.push(data.sensorId);
    state.sensorsById[data.sensorId] = { ...data };
    preserveNewerHealth(state, `SENSOR:${data.sensorId}`, state.sensorsById[data.sensorId], data.observedAt, event.timestamp);
  }
}

function preserveNewerHealth(state: TwinState, key: string, node: { healthStatus: TwinDeviceSnapshotResponse['healthStatus'] }, reference: string | null, timestamp: string) {
  const health = state.healthUpdates[key];
  if (!health) return;
  if (!older(health.referenceTime, reference) && older(timestamp, health.evaluatedAt)) node.healthStatus = health.healthStatus;
  else delete state.healthUpdates[key];
}

export const loadTwinSnapshot = createAsyncThunk<TwinHomeSnapshotResponse, string, { state: { twin: TwinState }; rejectValue: string }>(
  'twin/loadSnapshot',
  async (homeId, { signal, rejectWithValue }) => {
    try { return await getTwinSnapshot(homeId, signal); }
    catch { return rejectWithValue('Không thể tải Digital Twin. Vui lòng kiểm tra kết nối và quyền truy cập nhà, rồi thử lại.'); }
  },
  { condition: (homeId, { getState }) => getState().twin.homeId === homeId && !getState().twin.loading },
);

const twinSlice = createSlice({
  name: 'twin',
  initialState: emptyTwinState(),
  reducers: {
    twinOpened: (_state, action: PayloadAction<string>) => emptyTwinState(action.payload),
    twinClosed: () => emptyTwinState(),
  },
  extraReducers: (builder) => builder
    .addCase(currentHomeChanged, (state, action) => {
      if (state.homeId !== action.payload) return emptyTwinState();
    })
    .addCase(currentHomeCleared, () => emptyTwinState())
    .addCase(sessionEnded, () => emptyTwinState())
    .addCase(loadTwinSnapshot.pending, (state, action) => {
      state.loading = true;
      state.error = null;
      state.requestId = action.meta.requestId;
      state.pendingEvents = [];
    })
    .addCase(loadTwinSnapshot.fulfilled, (state, action) => {
      if (state.homeId !== action.meta.arg || state.requestId !== action.meta.requestId) return;
      const next = normalizeTwinSnapshot(action.payload);
      // Close the REST response race: replay events received while the snapshot was in flight.
      for (const event of state.pendingEvents) applyEvent(next, event);
      return next;
    })
    .addCase(loadTwinSnapshot.rejected, (state, action) => {
      if (state.homeId !== action.meta.arg || state.requestId !== action.meta.requestId) return;
      state.loading = false;
      state.requestId = null;
      state.pendingEvents = [];
      if (!action.meta.aborted) state.error = action.payload ?? 'Không thể tải Digital Twin. Vui lòng thử lại.';
    })
    .addCase(realtimeEventReceived, (state, action) => {
      const event = action.payload;
      if (event.homeId !== state.homeId || !isTwinEvent(event)) return;
      if (state.loading) state.pendingEvents.push(event);
      if (state.initialized) applyEvent(state, event);
    }),
});

export const { twinOpened, twinClosed } = twinSlice.actions;
export const twinReducer = twinSlice.reducer;
