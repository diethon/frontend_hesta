import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, beforeEach, test } from 'node:test';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

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
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      target: ts.ScriptTarget.ES2022,
    },
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
    module.exports
  );
  return module.exports;
}

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const storage = new Map([['accessToken', 'device-test-token']]);
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, val) => storage.set(key, String(val)),
    removeItem: (key) => storage.delete(key),
  },
});

const { apiClient, ApiError } = loadSource('src/services/apiClient.ts');
const deviceApi = loadSource('src/services/deviceApi.ts');
const { mapDeviceToUI } = loadSource('src/components/device/devicePageHelpers.ts');
const originalAdapter = apiClient.defaults.adapter;

beforeEach(() => {
  apiClient.defaults.adapter = originalAdapter;
});

after(() => {
  apiClient.defaults.adapter = originalAdapter;
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else delete globalThis.localStorage;
});

function loadHomeFavoriteDevices({ onSendCommand } = {}) {
  const filename = resolve(root, 'src/components/home/HomeFavoriteDevices.tsx');
  const source = readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  const mod = { exports: {} };
  const customRequire = (id) => {
    if (id === 'react') {
      return {
        ...React,
        default: React,
        useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
      };
    }
    if (id === 'react-router') {
      return { useNavigate: () => () => {} };
    }
    if (id === './HomeIcons') {
      return {
        Icon: ({ name }) => React.createElement('svg', { 'data-icon': name }),
        IconButton: (props) =>
          React.createElement('button', { type: 'button', 'aria-label': props.label, onClick: props.onClick }),
      };
    }
    if (id === '../../services/deviceApi') {
      return {
        sendManualPowerCommand: async (...args) => onSendCommand?.('sendManualPowerCommand', args),
        setAcPower: async (...args) => onSendCommand?.('setAcPower', args),
        setAcTemperature: async (...args) => onSendCommand?.('setAcTemperature', args),
        sendDeviceCommand: async (...args) => onSendCommand?.('sendDeviceCommand', args),
      };
    }
    if (id === '../ui/notify') {
      return {
        notify: {
          success: () => {},
          error: () => {},
          info: () => {},
        },
      };
    }
    if (id === '../../utils/errors') {
      return loadSource('src/utils/errors.ts');
    }
    if (id === '../../services/apiClient') {
      // HomeFavoriteDevices only checks `instanceof ApiError`; the real module pulls in the HTTP client.
      return { ApiError: class ApiError extends Error {} };
    }
    if (id === '../../services/queryCache') {
      return { invalidateCache: () => {} };
    }
    if (id === '../device/DeviceDetailModal') {
      return { DeviceDetailModal: () => null };
    }
    if (id === '../device/devicePageHelpers') {
      return { mapDeviceToUI };
    }
    throw new Error(`Unexpected require from HomeFavoriteDevices.tsx: ${id}`);
  };
  runInThisContext(`(function(require, module, exports) { ${outputText}\n})`, { filename })(
    customRequire,
    mod,
    mod.exports
  );
  return mod.exports.HomeFavoriteDevices;
}

function findElements(node, predicate, acc = []) {
  if (!node || typeof node !== 'object') return acc;
  if (Array.isArray(node)) {
    for (const child of node) findElements(child, predicate, acc);
    return acc;
  }
  if (predicate(node)) acc.push(node);
  if (node.props?.children) findElements(node.props.children, predicate, acc);
  return acc;
}

test('deviceApi single-device commands throw ApiError with errorCode and message on HTTP 200 failure while sendRoomCommand returns list', async () => {
  const offlineResult = {
    success: false,
    status: 'FAILED',
    errorCode: 'DEVICE_OFFLINE',
    message: 'Thiết bị đang ngoại tuyến hoặc chưa kết nối',
  };

  apiClient.defaults.adapter = async (config) => ({
    data: { code: 1000, result: offlineResult },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
    request: {},
  });

  for (const call of [
    () => deviceApi.sendDeviceCommand('dev-1', 'SET_BRIGHTNESS', { brightness: 50 }),
    () => deviceApi.setAcPower('dev-2', true),
    () => deviceApi.openGate('dev-3'),
  ]) {
    await assert.rejects(call, (err) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.errorCode, 'DEVICE_OFFLINE');
      assert.equal(err.message, 'Thiết bị đang ngoại tuyến hoặc chưa kết nối');
      return true;
    });
  }

  apiClient.defaults.adapter = async (config) => ({
    data: { code: 1000, result: [offlineResult] },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
    request: {},
  });

  const roomResults = await deviceApi.sendRoomCommand('room-1', 'TURN_OFF');
  assert.deepEqual(roomResults, [offlineResult]);
});

test('mapDeviceToUI marks OFFLINE, UNKNOWN, ERROR, UNCLAIMED as offline with Vietnamese status text and ONLINE as online', () => {
  const baseLight = {
    id: 'light-1',
    homeId: 'home-1',
    roomId: 'room-1',
    roomName: 'Phòng khách',
    name: 'Đèn trần',
    deviceType: 'LIGHT',
    currentState: { power: 'ON', brightness: 80 },
  };

  const cases = [
    { status: 'OFFLINE', expectedOffline: true, expectedStatus: 'Ngoại tuyến' },
    { status: 'UNKNOWN', expectedOffline: true, expectedStatus: 'Không xác định' },
    { status: 'ERROR', expectedOffline: true, expectedStatus: 'Lỗi thiết bị' },
    { status: 'UNCLAIMED', expectedOffline: true, expectedStatus: 'Ngoại tuyến' },
    { status: 'ONLINE', expectedOffline: false, expectedStatus: 'Đang bật · 80%' },
  ];

  for (const c of cases) {
    const mapped = mapDeviceToUI({ ...baseLight, status: c.status }, {}, {});
    assert.equal(mapped.offline, c.expectedOffline, `status=${c.status}`);
    assert.equal(mapped.status, c.expectedStatus, `status=${c.status}`);
  }
});

test('HomeFavoriteDevices renders offline Light, AC, and Gate with disabled controls and ignores brightness clicks when offline', () => {
  const commandCalls = [];
  const HomeFavoriteDevices = loadHomeFavoriteDevices({
    onSendCommand: (fn, args) => commandCalls.push({ fn, args }),
  });

  const devices = [
    {
      id: 'light-offline',
      homeId: 'home-1',
      roomId: 'room-1',
      roomName: 'Phòng khách',
      name: 'Đèn ngủ',
      deviceType: 'LIGHT',
      status: 'OFFLINE',
      currentState: { power: 'ON', brightness: 65 },
    },
    {
      id: 'ac-offline',
      homeId: 'home-1',
      roomId: 'room-1',
      roomName: 'Phòng ngủ',
      name: 'Điều hòa Casper',
      deviceType: 'AIR_CONDITIONER',
      status: 'OFFLINE',
      currentState: { power: 'ON', temperature: 24, mode: 'Lạnh' },
    },
    {
      id: 'gate-offline',
      homeId: 'home-1',
      roomId: 'room-1',
      roomName: 'Sân',
      name: 'Cổng chính',
      deviceType: 'GATE',
      status: 'ERROR',
      currentState: { state: 'STOP' },
    },
  ];

  const html = renderToStaticMarkup(
    React.createElement(HomeFavoriteDevices, {
      homeId: 'home-1',
      devices,
      selectedRoomId: null,
    })
  );

  assert.match(html, /Ngoại tuyến/);
  assert.doesNotMatch(html, /Đang bật · 65%/);
  assert.match(html, /class="brightness disabled"/);
  assert.match(html, /aria-disabled="true"/);
  assert.match(html, /<button[^>]*disabled=""[^>]*title="Giảm nhiệt độ"/);
  assert.match(html, /<button[^>]*disabled=""[^>]*title="Tăng nhiệt độ"/);
  for (const label of ['Lạnh', 'Hút ẩm', 'Sưởi', 'Tự động', 'Mở', 'Dừng', 'Đóng']) {
    const btnRegex = new RegExp(`<button[^>]*disabled=""[^>]*>${label}</button>`);
    assert.match(html, btnRegex, `Expected offline button "${label}" to be disabled`);
  }

  // Also simulate clicking the offline brightness slider directly via rendered React tree
  const tree = HomeFavoriteDevices({
    homeId: 'home-1',
    devices,
    selectedRoomId: null,
  });
  const sliders = findElements(
    tree,
    (el) => el.props?.role === 'slider' && typeof el.props?.className === 'string' && el.props.className.includes('brightness')
  );
  assert.equal(sliders.length, 1);
  assert.equal(sliders[0].props['aria-disabled'], true);

  let stopped = false;
  sliders[0].props.onClick({
    stopPropagation: () => {
      stopped = true;
    },
    currentTarget: {
      getBoundingClientRect: () => ({ left: 0, width: 100 }),
    },
    clientX: 40,
  });
  assert.equal(stopped, true);
  assert.equal(commandCalls.length, 0);
});

function createDevicePageHarness({ initialDevices = [], onSendCommand, onSendPower, onNotify } = {}) {
  const filename = resolve(root, 'src/components/device/DevicePage.tsx');
  const source = readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });

  const states = [];
  const refs = [];
  let stateCursor = 0;
  let refCursor = 0;

  const FakeIcon = (props) => React.createElement('svg', props);
  const customRequire = (id) => {
    if (id === 'react') {
      const hookReact = {
        ...React,
        default: React,
        useState: (initial) => {
          const idx = stateCursor++;
          if (!(idx in states)) {
            states[idx] = typeof initial === 'function' ? initial() : initial;
          }
          const setter = (next) => {
            states[idx] = typeof next === 'function' ? next(states[idx]) : next;
          };
          return [states[idx], setter];
        },
        useRef: (initial) => {
          const idx = refCursor++;
          if (!(idx in refs)) {
            refs[idx] = { current: initial };
          }
          return refs[idx];
        },
        useCallback: (fn) => fn,
        useMemo: (fn) => fn(),
        useEffect: () => {},
      };
      return hookReact;
    }
    if (id === 'react-router') {
      return {
        useNavigate: () => () => {},
        useParams: () => ({ homeId: 'home-1' }),
        Navigate: () => null,
      };
    }
    if (id === 'lucide-react') {
      return new Proxy({}, { get: () => FakeIcon });
    }
    if (id === '../home/HomeIcons') {
      return {
        Icon: ({ name }) => React.createElement('svg', { 'data-icon': name }),
        IconButton: (props) =>
          React.createElement('button', { type: 'button', 'aria-label': props.label, onClick: props.onClick }),
      };
    }
    if (id === '../home/DashboardNavRail') return { DashboardNavRail: () => null };
    if (id === '../home/DashboardBottomNav') return { DashboardBottomNav: () => null };
    if (id === '../automation/AutomationTopBar') {
      return {
        AutomationTopBar: (props) => React.createElement('header', { 'data-topbar': '1' }, props.title),
      };
    }
    if (id === './DeviceFilterDropdown') {
      return {
        DeviceFilterDropdown: () => null,
        DeviceMobileFilterModal: () => null,
      };
    }
    if (id === './AddDeviceModal') return { AddDeviceModal: () => null };
    if (id === './RoomManagementModal') return { RoomManagementModal: () => null };
    if (id === './DeviceDetailModal') {
      return {
        DeviceDetailModal: (props) => React.createElement('div', { 'data-detail-modal': props.device?.id, ...props }),
      };
    }
    if (id === './DeviceGroupSection') return { DeviceGroupSection: () => null };
    if (id === './DevicesOverviewStrip') return { DevicesOverviewStrip: () => null };
    if (id === '../../services/deviceApi') {
      return {
        getDevicesByHome: async () => initialDevices,
        sendDeviceCommand: async (...args) => onSendCommand?.(...args),
        sendManualPowerCommand: async (...args) =>
          onSendPower ? onSendPower(...args) : { command: { success: true } },
        homeDevicesKey: (homeId) => `devices:${homeId}`,
      };
    }
    if (id === '../../services/roomApi') return { getRooms: async () => [] };
    if (id === '../../services/energyApi') {
      return {
        getHomeEnergyAnalytics: async () => null,
        energyAnalyticsKey: (homeId, range) => `energy:${homeId}:${range}`,
      };
    }
    if (id === '../../services/queryCache') {
      return {
        peekCache: (key) => (key === 'devices:home-1' ? initialDevices : null),
      };
    }
    if (id === '../../utils/errors') return loadSource('src/utils/errors.ts');
    if (id === '../../store/homeSlice') {
      return {
        currentHomeChanged: (v) => ({ type: 'home/changed', payload: v }),
        currentHomeCleared: () => ({ type: 'home/cleared' }),
      };
    }
    if (id === '../../store/hooks') {
      return {
        useAppDispatch: () => () => {},
        useAppSelector: (selector) => selector({ auth: { user: { fullName: 'Minh Nguyen', platformRole: 'USER' } } }),
      };
    }
    if (id === '../ui/notify') {
      return {
        notify: {
          success: (...args) => onNotify?.('success', ...args),
          error: (...args) => onNotify?.('error', ...args),
          warning: (...args) => onNotify?.('warning', ...args),
          info: (...args) => onNotify?.('info', ...args),
        },
      };
    }
    if (id === '../../realtime/realtimeEvents') {
      return { realtimeEventDispatcher: { register: () => () => {} } };
    }
    if (id === './useOverrideCountdown') {
      return { useOverrideCountdown: () => ({ isOverrideActive: false, formattedTime: '' }) };
    }
    if (id === './devicePageHelpers') return loadSource('src/components/device/devicePageHelpers.ts');
    if (id === './devices-page.css') return {};
    throw new Error(`Unexpected require from DevicePage.tsx: ${id}`);
  };

  const mod = { exports: {} };
  runInThisContext(`(function(require, module, exports) { ${outputText}\n})`, { filename })(
    customRequire,
    mod,
    mod.exports
  );

  const renderTree = () => {
    stateCursor = 0;
    refCursor = 0;
    return mod.exports.DevicePage({});
  };

  const renderHtml = () => {
    stateCursor = 0;
    refCursor = 0;
    return renderToStaticMarkup(React.createElement(mod.exports.DevicePage));
  };

  return { renderTree, renderHtml, normalizeSearchText: mod.exports.normalizeSearchText };
}

test('DevicePage search bar filters with Vietnamese diacritic-insensitive matching and clears cleanly', () => {
  const sampleDevices = [
    {
      id: 'light-1',
      homeId: 'home-1',
      roomId: 'room-1',
      roomName: 'Phòng khách',
      name: 'Đèn trần chính',
      deviceType: 'LIGHT',
      model: 'HESTA-L1',
      status: 'ONLINE',
      currentState: { power: 'ON', brightness: 75 },
    },
    {
      id: 'ac-1',
      homeId: 'home-1',
      roomId: 'room-2',
      roomName: 'Phòng ngủ',
      name: 'Điều hòa Daikin',
      deviceType: 'AIR_CONDITIONER',
      model: 'DAIKIN-PRO',
      status: 'ONLINE',
      currentState: { power: 'OFF', temperature: 25 },
    },
    {
      id: 'gate-1',
      homeId: 'home-1',
      roomId: 'room-3',
      roomName: 'Sân vườn',
      name: 'Cổng chính',
      deviceType: 'GATE',
      model: 'GATE-X2',
      status: 'OFFLINE',
      currentState: { state: 'STOP' },
    },
  ];

  const harness = createDevicePageHarness({ initialDevices: sampleDevices });

  // Visible search input exists with aria-label="Tìm thiết bị"
  let tree = harness.renderTree();
  const searchInputs = findElements(
    tree,
    (el) => el.type === 'input' && el.props?.['aria-label'] === 'Tìm thiết bị'
  );
  assert.equal(searchInputs.length, 1);
  assert.equal(searchInputs[0].props.type, 'search');

  const getRenderedDeviceIds = (t) =>
    findElements(t, (el) => typeof el.type === 'function' && el.type.name === 'DevicesDeviceCard').map(
      (el) => el.props.device.id
    );

  assert.deepEqual(getRenderedDeviceIds(tree), ['light-1', 'ac-1', 'gate-1']);

  // Search by name without Vietnamese diacritics ("den tran")
  searchInputs[0].props.onChange({ target: { value: 'den tran' } });
  tree = harness.renderTree();
  assert.deepEqual(getRenderedDeviceIds(tree), ['light-1']);

  // Search by room without diacritics ("phong ngu")
  let input = findElements(tree, (el) => el.type === 'input' && el.props?.['aria-label'] === 'Tìm thiết bị')[0];
  input.props.onChange({ target: { value: 'phong ngu' } });
  tree = harness.renderTree();
  assert.deepEqual(getRenderedDeviceIds(tree), ['ac-1']);

  // Search by type ("cong") and model ("GATE-X2")
  input = findElements(tree, (el) => el.type === 'input' && el.props?.['aria-label'] === 'Tìm thiết bị')[0];
  input.props.onChange({ target: { value: 'cong' } });
  tree = harness.renderTree();
  assert.deepEqual(getRenderedDeviceIds(tree), ['gate-1']);

  input = findElements(tree, (el) => el.type === 'input' && el.props?.['aria-label'] === 'Tìm thiết bị')[0];
  input.props.onChange({ target: { value: 'daikin-pro' } });
  tree = harness.renderTree();
  assert.deepEqual(getRenderedDeviceIds(tree), ['ac-1']);

  // Clear button resets searchQuery and restores all devices
  const clearButtons = findElements(
    tree,
    (el) => el.type === 'button' && el.props?.['aria-label'] === 'Xóa tìm kiếm'
  );
  assert.equal(clearButtons.length, 1);
  clearButtons[0].props.onClick();
  tree = harness.renderTree();
  assert.deepEqual(getRenderedDeviceIds(tree), ['light-1', 'ac-1', 'gate-1']);
});

test('DevicePage hides brightness bar on offline lights, disables offline gate controls, and blocks offline commands', async () => {
  const commandCalls = [];
  const powerCalls = [];
  const notifyCalls = [];

  const devices = [
    {
      id: 'light-offline',
      homeId: 'home-1',
      roomId: 'room-1',
      roomName: 'Phòng khách',
      name: 'Đèn tắt mạng',
      deviceType: 'LIGHT',
      status: 'OFFLINE',
      currentState: { power: 'ON', brightness: 70 },
    },
    {
      id: 'light-online',
      homeId: 'home-1',
      roomId: 'room-1',
      roomName: 'Phòng khách',
      name: 'Đèn đang sáng',
      deviceType: 'LIGHT',
      status: 'ONLINE',
      currentState: { power: 'ON', brightness: 60 },
    },
    {
      id: 'gate-offline',
      homeId: 'home-1',
      roomId: 'room-2',
      roomName: 'Sân',
      name: 'Cổng tắt mạng',
      deviceType: 'GATE',
      status: 'OFFLINE',
      currentState: { state: 'STOP' },
    },
  ];

  const harness = createDevicePageHarness({
    initialDevices: devices,
    onSendCommand: async (deviceId, action, payload) => {
      commandCalls.push({ deviceId, action, payload });
      if (action === 'SET_BRIGHTNESS' && payload?.brightness === 99) {
        throw new Error('Brightness failed');
      }
      return { success: true };
    },
    onSendPower: async (deviceId, action) => {
      powerCalls.push({ deviceId, action });
      return { command: { success: true } };
    },
    onNotify: (tone, msg) => notifyCalls.push({ tone, msg }),
  });

  // Render full static HTML to inspect DevicesDeviceCard output
  const html = harness.renderHtml();
  assert.match(html, /aria-label="Tìm thiết bị"/);
  // Only one brightness bar (from light-online at 60%, NOT light-offline at 70%)
  assert.match(html, /aria-label="Độ sáng 60%"/);
  assert.doesNotMatch(html, /aria-label="Độ sáng 70%"/);
  // Offline gate buttons are disabled
  for (const label of ['Mở', 'Dừng', 'Đóng']) {
    const btnRegex = new RegExp(`<button[^>]*disabled=""[^>]*>${label}</button>`);
    assert.match(html, btnRegex, `Expected offline gate button "${label}" to be disabled`);
  }
  // Quick filter "Đang bật" counts only online active devices (1, not 2)
  assert.match(html, /Đang bật \(1\)/);

  // Also test interactive guards on DevicePage handlers
  let tree = harness.renderTree();
  const cards = findElements(
    tree,
    (el) => typeof el.type === 'function' && el.type.name === 'DevicesDeviceCard'
  );
  const offlineLightCard = cards.find((c) => c.props.device.id === 'light-offline');
  const onlineLightCard = cards.find((c) => c.props.device.id === 'light-online');
  const offlineGateCard = cards.find((c) => c.props.device.id === 'gate-offline');

  // Calling card callbacks for offline devices must not trigger API calls
  await offlineLightCard.props.onToggle();
  await offlineGateCard.props.onGateCommand('Mở');
  assert.equal(powerCalls.length, 0);
  assert.equal(commandCalls.length, 0);

  // Calling DevicesDeviceCard gate button onClick directly when offline must be guarded
  const renderedOfflineGate = offlineGateCard.type(offlineGateCard.props);
  const gateButtons = findElements(
    renderedOfflineGate,
    (el) => el.type === 'button' && ['Mở', 'Dừng', 'Đóng'].includes(el.props?.children)
  );
  assert.equal(gateButtons.length, 3);
  assert.ok(gateButtons.every((b) => b.props.disabled === true));
  gateButtons[0].props.onClick({ stopPropagation: () => {} });
  assert.equal(commandCalls.length, 0);

  // Open detail modal on offline light and attempt brightness/power/color -> blocked
  offlineLightCard.props.onOpen();
  tree = harness.renderTree();
  let detailModal = findElements(
    tree,
    (el) => typeof el.type === 'function' && el.type.name === 'DeviceDetailModal' && el.props?.device?.id === 'light-offline'
  )[0];
  assert.ok(detailModal);
  await detailModal.props.onTogglePower();
  await detailModal.props.onBrightnessChange(50);
  await detailModal.props.onColorChange(255, 0, 0);
  assert.equal(powerCalls.length, 0);
  assert.equal(commandCalls.length, 0);

  // Open detail modal on online light -> brightness failure rolls back & notifies error
  onlineLightCard.props.onOpen();
  tree = harness.renderTree();
  detailModal = findElements(
    tree,
    (el) => typeof el.type === 'function' && el.type.name === 'DeviceDetailModal' && el.props?.device?.id === 'light-online'
  )[0];
  assert.ok(detailModal);
  await detailModal.props.onBrightnessChange(99);
  assert.equal(commandCalls.length, 1);
  assert.ok(notifyCalls.some((n) => n.tone === 'error' && n.msg === 'Brightness failed'));

  tree = harness.renderTree();
  const updatedOnlineCard = findElements(
    tree,
    (el) => typeof el.type === 'function' && el.type.name === 'DevicesDeviceCard' && el.props.device.id === 'light-online'
  )[0];
  assert.equal(updatedOnlineCard.props.device.brightness, 60);

  // Trigger quickFilter === 'on' via QuickFilters and verify only ONLINE active light appears & "Tắt tất cả đèn" works
  const quickFiltersEl = findElements(
    tree,
    (el) => typeof el.type === 'function' && el.type.name === 'QuickFilters'
  )[0];
  assert.ok(quickFiltersEl);
  assert.equal(quickFiltersEl.props.activeCount, 1);
  assert.equal(quickFiltersEl.props.lightsOnCount, 1);
  quickFiltersEl.props.onChange('on');
  tree = harness.renderTree();
  // In "Đang bật" quick filter, only online active light-online should appear (not light-offline)
  const onCards = findElements(
    tree,
    (el) => typeof el.type === 'function' && el.type.name === 'DevicesDeviceCard'
  );
  assert.deepEqual(onCards.map((c) => c.props.device.id), ['light-online']);

  const updatedQuickFiltersEl = findElements(
    tree,
    (el) => typeof el.type === 'function' && el.type.name === 'QuickFilters'
  )[0];
  await updatedQuickFiltersEl.props.onTurnOffAllLights();
  assert.deepEqual(powerCalls, [{ deviceId: 'light-online', action: 'TURN_OFF' }]);
  assert.ok(notifyCalls.some((n) => n.tone === 'success' && n.msg === 'Đã tắt toàn bộ đèn'));
});
