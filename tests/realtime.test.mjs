import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const modules = new Map();

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
  runInThisContext(`(function(require, module, exports) { ${outputText}\n})`, { filename })(
    sourceRequire,
    module,
    module.exports,
  );
  return module.exports;
}

globalThis.__viteEnv = {};
const { SharedRealtimeClient, homeEventsDestination } = loadSource('src/realtime/realtimeClient.ts');
const { RealtimeEventDispatcher } = loadSource('src/realtime/realtimeEvents.ts');
const { parseRealtimeEvent } = loadSource('src/realtime/realtimeTypes.ts');
const {
  connectionStatusChanged,
  homeSubscriptionChanged,
  realtimeEventReceived,
  realtimeReducer,
  realtimeReset,
} = loadSource('src/store/realtimeSlice.ts');

class FakeStompClient {
  active = false;
  connected = false;
  subscriptions = [];
  deactivateCalls = 0;

  constructor(config) {
    this.config = config;
  }

  activate() {
    this.active = true;
  }

  async deactivate() {
    this.deactivateCalls += 1;
    this.active = false;
    this.connected = false;
    this.config.onDisconnect?.({});
  }

  subscribe(destination, callback) {
    const subscription = {
      destination,
      callback,
      unsubscribed: false,
      unsubscribe() {
        this.unsubscribed = true;
      },
    };
    this.subscriptions.push(subscription);
    return subscription;
  }

  open() {
    this.connected = true;
    this.config.onConnect?.({});
  }

  loseConnection() {
    this.connected = false;
    this.config.onWebSocketClose?.({});
  }

  emit(subscriptionIndex, event) {
    this.subscriptions[subscriptionIndex].callback({ body: JSON.stringify(event) });
  }
}

function createHarness() {
  const statuses = [];
  const homes = [];
  const events = [];
  const errors = [];
  const stompClients = [];
  const client = new SharedRealtimeClient({
    brokerUrl: () => 'ws://backend.test/ws',
    createStompClient: (config) => {
      const stompClient = new FakeStompClient(config);
      stompClients.push(stompClient);
      return stompClient;
    },
    callbacks: {
      onStatusChange: (status) => statuses.push(status),
      onHomeSubscriptionChange: (homeId) => homes.push(homeId),
      onEvent: (event) => events.push(event),
      onError: (message) => errors.push(message),
    },
  });
  return { client, errors, events, homes, statuses, stompClients };
}

const validEvent = {
  eventId: 'evt-1',
  type: 'DEVICE_STATE_CHANGED',
  homeId: 'home-1',
  deviceId: 'device-1',
  data: { power: true },
  timestamp: '2026-09-12T08:00:00Z',
};

test('parses the shared backend event contract and rejects malformed payloads', () => {
  assert.deepEqual(parseRealtimeEvent(JSON.stringify(validEvent)), validEvent);
  assert.throws(() => parseRealtimeEvent('{broken'), /valid JSON/);
  assert.throws(() => parseRealtimeEvent({ ...validEvent, type: 'RENAMED_EVENT' }), /unsupported/);
  assert.throws(() => parseRealtimeEvent({ ...validEvent, data: null }), /data/);
});

test('derives the exact home-scoped destination', () => {
  assert.equal(homeEventsDestination('home-1'), '/topic/homes/home-1/events');
  assert.throws(() => homeEventsDestination('home/escape'), /valid homeId/);
});

test('publishes connection and infrastructure state through the realtime Redux slice', () => {
  let state = realtimeReducer(undefined, { type: 'init' });
  assert.equal(state.status, 'disconnected');
  state = realtimeReducer(state, connectionStatusChanged('connecting'));
  state = realtimeReducer(state, connectionStatusChanged('connected'));
  state = realtimeReducer(state, homeSubscriptionChanged('home-1'));
  state = realtimeReducer(state, realtimeEventReceived(validEvent));
  assert.deepEqual(state, {
    status: 'connected',
    activeHomeId: 'home-1',
    lastEventAt: validEvent.timestamp,
    error: null,
  });
  assert.equal(realtimeReducer(state, realtimeReset()).status, 'disconnected');
});

test('connects with a native bearer header and reports connection/reconnection state', async () => {
  const harness = createHarness();
  await harness.client.connect('test-access-token');
  const stompClient = harness.stompClients[0];

  assert.equal(stompClient.config.brokerURL, 'ws://backend.test/ws');
  assert.equal(stompClient.config.connectHeaders.Authorization, 'Bearer test-access-token');
  assert.equal(new URL(stompClient.config.brokerURL).search, '');
  assert.deepEqual(harness.statuses, ['connecting']);

  stompClient.open();
  stompClient.loseConnection();
  stompClient.open();
  assert.deepEqual(harness.statuses, ['connecting', 'connected', 'reconnecting', 'connected']);
  assert.equal(stompClient.config.heartbeatIncoming, 20_000);
  assert.equal(stompClient.config.heartbeatOutgoing, 20_000);
});

test('replaces Home A with Home B, prevents duplicates, and restores Home B after reconnect', async () => {
  const harness = createHarness();
  harness.client.subscribeToHome('home-a');
  await harness.client.connect('test-access-token');
  const stompClient = harness.stompClients[0];
  stompClient.open();

  assert.equal(stompClient.subscriptions[0].destination, '/topic/homes/home-a/events');
  harness.client.subscribeToHome('home-a');
  assert.equal(stompClient.subscriptions.length, 1);

  harness.client.subscribeToHome('home-b');
  assert.equal(stompClient.subscriptions[0].unsubscribed, true);
  assert.equal(stompClient.subscriptions[1].destination, '/topic/homes/home-b/events');

  stompClient.loseConnection();
  stompClient.open();
  assert.equal(stompClient.subscriptions[2].destination, '/topic/homes/home-b/events');
  assert.equal(harness.homes.at(-1), 'home-b');
});

test('routes all supported event types through one dispatcher', () => {
  const dispatcher = new RealtimeEventDispatcher();
  const received = [];
  const unregister = [
    'SENSOR_READING_UPDATED',
    'DEVICE_STATE_CHANGED',
    'NOTIFICATION_CREATED',
  ].map((type) => dispatcher.register(type, (event) => received.push(event.type)));

  for (const type of ['SENSOR_READING_UPDATED', 'DEVICE_STATE_CHANGED', 'NOTIFICATION_CREATED']) {
    dispatcher.dispatch({ ...validEvent, eventId: `evt-${type}`, type });
  }
  assert.deepEqual(received, [
    'SENSOR_READING_UPDATED',
    'DEVICE_STATE_CHANGED',
    'NOTIFICATION_CREATED',
  ]);
  unregister.forEach((remove) => remove());
});

test('parses received messages, ignores duplicate event IDs, and disconnects cleanly', async () => {
  const harness = createHarness();
  harness.client.subscribeToHome('home-1');
  await harness.client.connect('test-access-token');
  const stompClient = harness.stompClients[0];
  stompClient.open();
  stompClient.emit(0, validEvent);
  stompClient.emit(0, validEvent);

  assert.deepEqual(harness.events, [validEvent]);
  await harness.client.disconnect();
  assert.equal(stompClient.deactivateCalls, 1);
  assert.equal(stompClient.subscriptions[0].unsubscribed, true);
  assert.equal(harness.homes.at(-1), null);
  assert.equal(harness.statuses.at(-1), 'disconnected');
  assert.deepEqual(harness.errors, []);
});

test('a changed access token replaces the active STOMP connection', async () => {
  const harness = createHarness();
  await harness.client.connect('old-token');
  const firstClient = harness.stompClients[0];
  firstClient.open();

  await harness.client.connect('new-token');
  assert.equal(firstClient.deactivateCalls, 1);
  assert.equal(harness.stompClients.length, 2);
  assert.equal(harness.stompClients[1].config.connectHeaders.Authorization, 'Bearer new-token');
});
