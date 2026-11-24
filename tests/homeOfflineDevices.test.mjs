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
    const dependencyPath = ['', '.ts', '.tsx'].map((extension) => base + extension).find(existsSync);
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
        setAcMode: async (...args) => onSendCommand?.('setAcMode', args),
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
    if (id === '../device/DeviceVisual') {
      return loadSource('src/components/device/DeviceVisual.tsx');
    }
    if (id === '../device/deviceHelpers') {
      return loadSource('src/components/device/deviceHelpers.ts');
    }
    if (id === '../device/devicePageHelpers') {
      return { mapDeviceToUI };
    }
    if (id === '../../services/apiClient') {
      return { clearAllCache: () => {} };
    }
    if (id === '../../services/queryCache') {
      return { clearAllCache: () => {} };
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

test('HomeFavoriteDevices renders offline Light, AC, and Gate with read-only summaries and disabled aperture controls', () => {
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

  assert.match(html, /title="Ngoại tuyến"/);
  assert.doesNotMatch(html, /<p[^>]*>\s*Ngoại tuyến\s*<\/p>/);
  assert.ok(html.indexOf('<h3') !== -1 && html.indexOf('<h3') < html.indexOf('device-visual-center'));
  assert.doesNotMatch(html, /Đang bật · 65%/);
  assert.doesNotMatch(html, /class="brightness/);
  assert.doesNotMatch(html, /title="Giảm nhiệt độ"/);
  assert.doesNotMatch(html, /title="Tăng nhiệt độ"/);
  assert.match(html, /24°C/);
  for (const label of ['Mở', 'Dừng', 'Đóng']) {
    const btnRegex = new RegExp(`<button[^>]*disabled=""[^>]*>${label}</button>`);
    assert.match(html, btnRegex, `Expected offline button "${label}" to be disabled`);
  }

  // Offline cards omit top-right power toggles; detailed adjustments remain inside DeviceDetailModal
  const tree = HomeFavoriteDevices({
    homeId: 'home-1',
    devices,
    selectedRoomId: null,
  });
  const sliders = findElements(
    tree,
    (el) => el.props?.role === 'slider' && typeof el.props?.className === 'string' && el.props.className.includes('brightness')
  );
  assert.equal(sliders.length, 0);
  const toggles = findElements(
    tree,
    (el) => el.type === 'button' && typeof el.props?.className === 'string' && el.props.className.includes('toggle')
  );
  assert.equal(toggles.length, 0);
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
    if (id === './DeviceVisual') {
      return loadSource('src/components/device/DeviceVisual.tsx');
    }
    if (id === './DeviceGroupSection') return { DeviceGroupSection: () => null };
    if (id === './DevicesOverviewStrip') return { DevicesOverviewStrip: () => null };
    if (id === '../../services/deviceApi') {
      return {
        getDevicesByHome: async () => initialDevices,
        sendDeviceCommand: async (...args) => onSendCommand?.(...args),
        sendManualPowerCommand: async (...args) =>
          onSendPower ? onSendPower(...args) : { command: { success: true } },
        setAcTemperature: async (deviceId, temperature) =>
          onSendCommand?.(deviceId, 'SET_TEMPERATURE', { temperature }),
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
    if (id === './deviceHelpers') return loadSource('src/components/device/deviceHelpers.ts');
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
  // Online light shows its brightness summary in <p> while offline light omits it, and no inline brightness slider renders on the card
  assert.match(html, /Đang bật · 60%/);
  assert.doesNotMatch(html, /Đang bật · 70%/);
  assert.doesNotMatch(html, /class="brightness/);
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
  assert.equal(detailModal.props.onColorChange, undefined);
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

test('Online DOOR, ROLLING_DOOR, GATE, GATE_MOTOR, and CURTAIN enforce travel-limit interlock in HomeFavoriteDevices and DevicePage', async () => {
  const commandCalls = [];
  const HomeFavoriteDevices = loadHomeFavoriteDevices({
    onSendCommand: (fn, args) => commandCalls.push({ fn, args }),
  });

  const baseDevices = [
    {
      id: 'door-open',
      homeId: 'home-1',
      roomId: 'room-1',
      roomName: 'Phòng khách',
      name: 'Cửa chính',
      deviceType: 'DOOR',
      status: 'ONLINE',
      currentState: { state: 'OPEN' },
    },
    {
      id: 'roller-closed',
      homeId: 'home-1',
      roomId: 'room-2',
      roomName: 'Gara',
      name: 'Cửa cuốn',
      deviceType: 'ROLLING_DOOR',
      status: 'ONLINE',
      currentState: { state: 'CLOSED' },
    },
    {
      id: 'curtain-moving',
      homeId: 'home-1',
      roomId: 'room-1',
      roomName: 'Phòng ngủ',
      name: 'Rèm thông minh',
      deviceType: 'CURTAIN',
      status: 'ONLINE',
      currentState: { state: 'OPENING' },
    },
    {
      id: 'gate-closing',
      homeId: 'home-1',
      roomId: 'room-3',
      roomName: 'Sân',
      name: 'Motor cổng',
      deviceType: 'GATE_MOTOR',
      status: 'ONLINE',
      currentState: { state: 'CLOSING' },
    },
  ];

  // Check HomeFavoriteDevices maps all types cleanly & enforces disabled button states
  const homeTree = HomeFavoriteDevices({
    homeId: 'home-1',
    devices: baseDevices,
    selectedRoomId: null,
  });
  const homeCards = findElements(homeTree, (el) => el.type === 'article');
  assert.equal(homeCards.length, 4);

  const buttonsFor = (node) =>
    findElements(node, (el) => el.type === 'button' && ['Mở', 'Dừng', 'Đóng'].includes(el.props?.children));

  // DOM sort in HomeFavoriteDevices is createdAt/id order: curtain-moving, door-open, gate-closing, roller-closed
  const byId = Object.fromEntries(homeCards.map((card) => {
    const label = findElements(card, (el) => el.type === 'h3')[0].props.children;
    return [label, Object.fromEntries(buttonsFor(card).map((b) => [b.props.children, b.props.disabled]))];
  }));

  assert.deepEqual(byId['Cửa chính'], { Mở: true, Dừng: true, Đóng: false });
  assert.deepEqual(byId['Cửa cuốn'], { Mở: false, Dừng: true, Đóng: true });
  assert.deepEqual(byId['Rèm thông minh'], { Mở: true, Dừng: false, Đóng: true });
  assert.deepEqual(byId['Motor cổng'], { Mở: true, Dừng: false, Đóng: true });

  // Also check DevicePage DevicesDeviceCard + handleGateCommand guard
  const harness = createDevicePageHarness({
    initialDevices: baseDevices,
    onSendCommand: async (deviceId, action) => {
      commandCalls.push({ deviceId, action });
      return { success: true };
    },
  });
  const tree = harness.renderTree();
  const pageCards = findElements(
    tree,
    (el) => typeof el.type === 'function' && el.type.name === 'DevicesDeviceCard'
  );
  const doorCard = pageCards.find((c) => c.props.device.id === 'door-open');
  const movingCard = pageCards.find((c) => c.props.device.id === 'curtain-moving');
  assert.equal(doorCard.props.device.type, 'Cổng');
  assert.equal(movingCard.props.device.type, 'Cổng');

  // Blocked OPEN on already-OPEN door via handler & UI button
  await doorCard.props.onGateCommand('Mở');
  await movingCard.props.onGateCommand('Đóng');
  assert.equal(commandCalls.length, 0);
});

function loadControlTab({ onDeviceApiCall } = {}) {
  const filename = resolve(root, 'src/components/device/detail/ControlTab.tsx');
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
    if (id === 'react') return React;
    if (id === 'react-colorful') {
      return {
        HexColorPicker: (props) =>
          React.createElement('div', { 'data-testid': 'hex-color-picker', 'data-color': props.color }),
      };
    }
    if (id === 'lucide-react') return require('lucide-react');
    if (id === '../../home/HomeIcons') {
      return {
        Icon: ({ name }) => React.createElement('svg', { 'data-icon': name }),
      };
    }
    if (id === '../DeviceVisual') {
      return loadSource('src/components/device/DeviceVisual.tsx');
    }
    if (id === '../../../services/deviceApi') {
      return {
        sendDeviceCommand: async (...args) => {
          onDeviceApiCall?.('sendDeviceCommand', args);
          return { success: true };
        },
        updateDeviceConfig: async (...args) => {
          onDeviceApiCall?.('updateDeviceConfig', args);
          return {};
        },
        setAcTemperature: async (...args) => {
          onDeviceApiCall?.('setAcTemperature', args);
          return { success: true };
        },
        setAcMode: async (...args) => {
          onDeviceApiCall?.('setAcMode', args);
          return { success: true };
        },
        setAcFan: async (...args) => {
          onDeviceApiCall?.('setAcFan', args);
          return { success: true };
        },
        setAcSwing: async (...args) => {
          onDeviceApiCall?.('setAcSwing', args);
          return { success: true };
        },
        setAcTimer: async (...args) => {
          onDeviceApiCall?.('setAcTimer', args);
          return { success: true };
        },
        cancelAcTimer: async (...args) => {
          onDeviceApiCall?.('cancelAcTimer', args);
          return { success: true };
        },
      };
    }
    if (id === '../../ui/notify') {
      return { notify: { success: () => {}, error: () => {}, info: () => {} } };
    }
    if (id === '../deviceHelpers') return loadSource('src/components/device/deviceHelpers.ts');
    if (id === './detailTypes') return loadSource('src/components/device/detail/detailTypes.ts');
    throw new Error(`Unexpected require from ControlTab.tsx: ${id}`);
  };
  runInThisContext(`(function(require, module, exports) { ${outputText}\n})`, { filename })(
    customRequire,
    mod,
    mod.exports
  );
  return mod.exports.ControlTab;
}

test('LIGHT never shows or allows color adjustment while LED_RGB allows color across /home, /devices, ControlTab, and capability helpers', async () => {
  const { getDeviceCapabilityMap } = loadSource('src/components/device/deviceHelpers.ts');
  const { getDeviceActions } = loadSource('src/components/deviceActionOptions.ts');
  const { isFieldAllowedForDeviceType } = loadSource('src/components/device/DeviceStateVisualizer.tsx');

  // 1. Capability & action stripping for LIGHT vs LED_RGB (even with stale COLOR capabilities)
  const staleLightCaps = {
    POWER: ['TURN_ON', 'TURN_OFF', 'TOGGLE'],
    BRIGHTNESS: ['SET_BRIGHTNESS'],
    COLOR: ['SET_RGB', 'SET_COLOR'],
  };
  const lightCaps = getDeviceCapabilityMap({ deviceType: 'LIGHT', capabilities: staleLightCaps });
  assert.equal(lightCaps.hasColor, false);
  assert.deepEqual(lightCaps.colorActions, []);
  assert.equal(lightCaps.hasBrightness, true);

  const rgbCaps = getDeviceCapabilityMap({ deviceType: 'LED_RGB', capabilities: staleLightCaps });
  assert.equal(rgbCaps.hasColor, true);
  assert.ok(rgbCaps.colorActions.includes('SET_RGB'));

  const lightActionCodes = getDeviceActions({ deviceType: 'LIGHT', capabilities: staleLightCaps }).map((a) => a.code);
  assert.ok(!lightActionCodes.includes('SET_RGB'));
  assert.ok(!lightActionCodes.includes('SET_COLOR'));
  assert.ok(lightActionCodes.includes('SET_BRIGHTNESS'));

  const rgbActionCodes = getDeviceActions({ deviceType: 'LED_RGB', capabilities: staleLightCaps }).map((a) => a.code);
  assert.ok(rgbActionCodes.includes('SET_RGB'));
  assert.ok(rgbActionCodes.includes('SET_COLOR'));

  // 2. DeviceStateVisualizer field filtering
  for (const key of ['r', 'g', 'b', 'color', 'hex', 'rgbHex']) {
    assert.equal(isFieldAllowedForDeviceType(key, 'LIGHT'), false, `LIGHT must exclude ${key}`);
    assert.equal(isFieldAllowedForDeviceType(key, 'LED_RGB'), true, `LED_RGB must allow ${key}`);
  }

  // 3. HomeFavoriteDevices (/home): LIGHT with stale RGB state renders no RGB dot; LED_RGB (flat or nested) renders RGB dot
  const homeCommandCalls = [];
  const HomeFavoriteDevices = loadHomeFavoriteDevices({
    onSendCommand: (fn, args) => homeCommandCalls.push({ fn, args }),
  });

  const lightWithStaleRgb = {
    id: 'light-stale',
    homeId: 'home-1',
    roomId: 'room-1',
    roomName: 'Phòng khách',
    name: 'Đèn trần thường',
    deviceType: 'LIGHT',
    status: 'ONLINE',
    currentState: { power: 'ON', brightness: 70, r: 255, g: 0, b: 0, rgbHex: '#ff0000' },
  };
  const rgbFlat = {
    id: 'rgb-flat',
    homeId: 'home-1',
    roomId: 'room-1',
    roomName: 'Phòng khách',
    name: 'LED dây TV',
    deviceType: 'LED_RGB',
    status: 'ONLINE',
    currentState: { power: 'ON', brightness: 85, r: 12, g: 34, b: 56 },
  };
  const rgbNested = {
    id: 'rgb-nested',
    homeId: 'home-1',
    roomId: 'room-1',
    roomName: 'Phòng ngủ',
    name: 'LED ngủ',
    deviceType: 'LED_RGB',
    status: 'ONLINE',
    currentState: { power: 'ON', brightness: 50, color: { r: 200, g: 100, b: 50 } },
  };
  const rgbOffline = {
    id: 'rgb-offline',
    homeId: 'home-1',
    roomId: 'room-1',
    roomName: 'Ban công',
    name: 'LED ngoại tuyến',
    deviceType: 'LED_RGB',
    status: 'OFFLINE',
    currentState: { power: 'ON', brightness: 50, r: 10, g: 20, b: 30 },
  };

  const homeTree = HomeFavoriteDevices({
    homeId: 'home-1',
    devices: [lightWithStaleRgb, rgbFlat, rgbNested],
    selectedRoomId: null,
  });
  const homeCards = findElements(homeTree, (el) => el.type === 'article');
  assert.equal(homeCards.length, 3);
  const homeCardByName = Object.fromEntries(
    homeCards.map((card) => [findElements(card, (el) => el.type === 'h3')[0].props.children, card])
  );
  assert.equal(
    findElements(homeCardByName['Đèn trần thường'], (el) => el.props?.['data-rgb-indicator'] === 'true').length,
    0
  );
  assert.equal(
    findElements(homeCardByName['LED dây TV'], (el) => el.props?.['data-rgb-indicator'] === 'true').length,
    1
  );
  assert.equal(
    findElements(homeCardByName['LED ngủ'], (el) => el.props?.['data-rgb-indicator'] === 'true').length,
    1
  );

  // 4. DevicePage (/home/:homeId/devices): LIGHT has no RGB indicator & onColorChange === undefined; LED_RGB dispatches SET_RGB when online and blocks when offline
  const pageCommandCalls = [];
  const harness = createDevicePageHarness({
    initialDevices: [lightWithStaleRgb, rgbFlat, rgbOffline],
    onSendCommand: async (deviceId, action, payload) => {
      pageCommandCalls.push({ deviceId, action, payload });
      return { success: true };
    },
  });

  const pageHtml = harness.renderHtml();
  // LIGHT card should not show RGB dot, while online/offline LED_RGB cards do
  assert.equal((pageHtml.match(/data-rgb-indicator="true"/g) || []).length, 2);
  // Device cards place <h3> before centered visual and omit visible "Ngoại tuyến" <p>/footer labels (dot title remains)
  assert.ok(pageHtml.indexOf('<h3') !== -1 && pageHtml.indexOf('<h3') < pageHtml.indexOf('device-visual-center'));
  assert.doesNotMatch(pageHtml, /<p[^>]*>\s*Ngoại tuyến\s*<\/p>/);
  assert.doesNotMatch(pageHtml, /class="footer-time text-offline"/);
  assert.match(pageHtml, /title="Ngoại tuyến"/);

  let pageTree = harness.renderTree();
  let pageCards = findElements(
    pageTree,
    (el) => typeof el.type === 'function' && el.type.name === 'DevicesDeviceCard'
  );
  const pageLightCard = pageCards.find((c) => c.props.device.id === 'light-stale');
  const pageRgbCard = pageCards.find((c) => c.props.device.id === 'rgb-flat');
  const pageOfflineRgbCard = pageCards.find((c) => c.props.device.id === 'rgb-offline');

  // Open LIGHT detail -> onColorChange is undefined
  pageLightCard.props.onOpen();
  pageTree = harness.renderTree();
  let modal = findElements(
    pageTree,
    (el) => typeof el.type === 'function' && el.type.name === 'DeviceDetailModal' && el.props?.device?.id === 'light-stale'
  )[0];
  assert.ok(modal);
  assert.equal(modal.props.onColorChange, undefined);

  // Open offline LED_RGB detail -> onColorChange is defined, calling it sends 0 commands
  pageOfflineRgbCard.props.onOpen();
  pageTree = harness.renderTree();
  modal = findElements(
    pageTree,
    (el) => typeof el.type === 'function' && el.type.name === 'DeviceDetailModal' && el.props?.device?.id === 'rgb-offline'
  )[0];
  assert.ok(modal);
  assert.equal(typeof modal.props.onColorChange, 'function');
  await modal.props.onColorChange(10, 20, 30);
  assert.equal(pageCommandCalls.length, 0);

  // Open online LED_RGB detail -> onColorChange sends SET_RGB and updates RGB indicator
  pageRgbCard.props.onOpen();
  pageTree = harness.renderTree();
  modal = findElements(
    pageTree,
    (el) => typeof el.type === 'function' && el.type.name === 'DeviceDetailModal' && el.props?.device?.id === 'rgb-flat'
  )[0];
  assert.ok(modal);
  assert.equal(typeof modal.props.onColorChange, 'function');
  await modal.props.onColorChange(10, 20, 30);
  assert.deepEqual(pageCommandCalls, [
    { deviceId: 'rgb-flat', action: 'SET_RGB', payload: { r: 10, g: 20, b: 30, brightness: 80 } },
  ]);
  const updatedHtml = harness.renderHtml();
  assert.match(updatedHtml, /Màu RGB: rgb\(10, 20, 30\)/);

  // 5. ControlTab: renders Màu sắc & Màu đã lưu for LED_RGB, omits them for LIGHT while preserving Độ sáng
  const ControlTab = loadControlTab();
  const lightControlHtml = renderToStaticMarkup(
    React.createElement(ControlTab, {
      device: { id: 'light-stale', name: 'Đèn trần thường', deviceType: 'LIGHT', raw: lightWithStaleRgb },
      resolvedType: 'Đèn',
      disabled: false,
      isOn: true,
      lightLevel: 70,
      setLightLevel: () => {},
      acTemp: 24,
      setAcTemp: () => {},
      acMode: 'Lạnh',
      setAcMode: () => {},
      gateState: 'Dừng',
      setGateState: () => {},
    })
  );
  assert.match(lightControlHtml, /Độ sáng/);
  assert.doesNotMatch(lightControlHtml, /Màu sắc/);
  assert.doesNotMatch(lightControlHtml, /Màu đã lưu/);

  const rgbControlHtml = renderToStaticMarkup(
    React.createElement(ControlTab, {
      device: { id: 'rgb-flat', name: 'LED dây TV', deviceType: 'LED_RGB', raw: rgbFlat },
      resolvedType: 'Đèn',
      disabled: false,
      isOn: true,
      lightLevel: 85,
      setLightLevel: () => {},
      acTemp: 24,
      setAcTemp: () => {},
      acMode: 'Lạnh',
      setAcMode: () => {},
      gateState: 'Dừng',
      setGateState: () => {},
    })
  );
  assert.match(rgbControlHtml, /Độ sáng/);
  assert.match(rgbControlHtml, /Màu sắc/);
  assert.match(rgbControlHtml, /Màu đã lưu/);
  assert.match(lightControlHtml, /data-visual-kind="light"/);
  assert.match(rgbControlHtml, /data-visual-kind="led-rgb"/);
});

test('DeviceVisual renders 21 distinct studio product renders for all device types with reactive ON/OFF/RGB states', () => {
  const {
    DeviceVisual,
    resolveDeviceVisualKind,
    DEVICE_VISUAL_IMAGE_MAP,
  } = loadSource('src/components/device/DeviceVisual.tsx');

  // 1. All 21 distinct device types map to 21 unique kinds and existing PNG assets
  const expectedTypeMap = {
    LIGHT: 'light',
    LED_RGB: 'led-rgb',
    AIR_CONDITIONER: 'ac',
    TV: 'tv',
    FAN: 'fan',
    WATER_PUMP: 'pump',
    CAMERA_AI: 'camera',
    GATE: 'gate',
    ROLLING_DOOR: 'rolling-door',
    DOOR: 'door',
    CURTAIN: 'curtain',
    LOCK: 'lock',
    SMART_PLUG: 'plug',
    SWITCH: 'switch',
    IR_REMOTE: 'ir-remote',
    TEMP_HUMID_SENSOR: 'sensor-temp',
    LUX_SENSOR: 'sensor-lux',
    SMOKE_SENSOR: 'sensor-smoke',
    FLAME_SENSOR: 'sensor-flame',
    GAS_SENSOR: 'sensor-gas',
    MOTION_SENSOR: 'sensor-motion',
  };

  const kinds = Object.entries(expectedTypeMap).map(([deviceType, expectedKind]) => {
    const actualKind = resolveDeviceVisualKind({ deviceType });
    assert.equal(actualKind, expectedKind);
    const imgUrl = DEVICE_VISUAL_IMAGE_MAP[actualKind];
    assert.ok(imgUrl && imgUrl.startsWith('/images/devices/') && imgUrl.endsWith('.png'));
    const diskPath = resolve(root, 'public', imgUrl.slice(1));
    assert.ok(existsSync(diskPath), `Missing generated product image: ${diskPath}`);
    return actualKind;
  });
  assert.equal(new Set(kinds).size, 21);
  assert.equal(new Set(kinds.map((k) => DEVICE_VISUAL_IMAGE_MAP[k])).size, 21);
  // Regression: explicit MOTION_SENSOR must never be shadowed by "cửa chính" in device name
  assert.equal(
    resolveDeviceVisualKind({ deviceType: 'MOTION_SENSOR', name: 'Cảm biến chuyển động cửa chính' }),
    'sensor-motion'
  );

  // 2. LIGHT ON/OFF never sets data-visual-color even if rgbColor is passed
  const lightOnHtml = renderToStaticMarkup(
    React.createElement(DeviceVisual, {
      uid: 'l1',
      deviceType: 'LIGHT',
      isOn: true,
      brightness: 90,
      rgbColor: '#ff00ff',
    })
  );
  assert.match(lightOnHtml, /data-visual-kind="light"/);
  assert.match(lightOnHtml, /data-visual-state="on"/);
  assert.doesNotMatch(lightOnHtml, /data-visual-color=/);

  const lightOffHtml = renderToStaticMarkup(
    React.createElement(DeviceVisual, {
      uid: 'l1',
      deviceType: 'LIGHT',
      isOn: false,
      brightness: 90,
    })
  );
  assert.match(lightOffHtml, /data-visual-kind="light"/);
  assert.match(lightOffHtml, /data-visual-state="off"/);

  // 3. LED_RGB ON reflects rgbColor; OFF omits data-visual-color
  const rgbOnHtml = renderToStaticMarkup(
    React.createElement(DeviceVisual, {
      uid: 'rgb1',
      deviceType: 'LED_RGB',
      isOn: true,
      brightness: 85,
      rgbColor: 'rgb(12, 34, 56)',
    })
  );
  assert.match(rgbOnHtml, /data-visual-kind="led-rgb"/);
  assert.match(rgbOnHtml, /data-visual-state="on"/);
  assert.match(rgbOnHtml, /data-visual-color="rgb\(12, 34, 56\)"/);

  const rgbOffHtml = renderToStaticMarkup(
    React.createElement(DeviceVisual, {
      uid: 'rgb1',
      deviceType: 'LED_RGB',
      isOn: false,
      brightness: 85,
      rgbColor: 'rgb(12, 34, 56)',
    })
  );
  assert.match(rgbOffHtml, /data-visual-kind="led-rgb"/);
  assert.match(rgbOffHtml, /data-visual-state="off"/);
  assert.doesNotMatch(rgbOffHtml, /data-visual-color=/);

  // 4. HomeFavoriteDevices & DevicePage integration: LED_RGB updates color in DevicePage HTML
  const HomeFavoriteDevices = loadHomeFavoriteDevices();
  const homeHtml = renderToStaticMarkup(
    React.createElement(HomeFavoriteDevices, {
      homeId: 'home-1',
      selectedRoomId: null,
      devices: [
        {
          id: 'l-home',
          homeId: 'home-1',
          roomName: 'Phòng khách',
          name: 'Đèn thường',
          deviceType: 'LIGHT',
          status: 'ONLINE',
          currentState: { power: 'ON', brightness: 70, r: 255, g: 0, b: 0 },
        },
        {
          id: 'rgb-home',
          homeId: 'home-1',
          roomName: 'Phòng khách',
          name: 'Đèn RGB',
          deviceType: 'LED_RGB',
          status: 'ONLINE',
          currentState: { power: 'ON', brightness: 80, r: 12, g: 34, b: 56 },
        },
      ],
    })
  );
  assert.match(homeHtml, /data-visual-kind="light"/);
  assert.match(homeHtml, /data-visual-kind="led-rgb"/);
  assert.match(homeHtml, /data-visual-color="rgb\(12, 34, 56\)"/);
});

test('Test-HTTP device UI protocols (FAN, TV, AC, DOOR, WATER_PUMP) and sensor DB metric normalization work end-to-end', async () => {
  const { extractSensorMetrics, normalizeSensorReadingPatch } = loadSource('src/components/device/deviceHelpers.ts');
  const { DeviceVisual, resolveDeviceVisualKind } = loadSource('src/components/device/DeviceVisual.tsx');

  // 1. Visual kinds for TV, DOOR, WATER_PUMP, FAN
  assert.equal(resolveDeviceVisualKind({ deviceType: 'TV' }), 'tv');
  assert.equal(resolveDeviceVisualKind({ deviceType: 'DOOR' }), 'door');
  assert.equal(resolveDeviceVisualKind({ deviceType: 'WATER_PUMP' }), 'pump');
  assert.equal(resolveDeviceVisualKind({ deviceType: 'FAN' }), 'fan');

  const doorHtml = renderToStaticMarkup(
    React.createElement(DeviceVisual, { uid: 'door-1', deviceType: 'DOOR', gateState: 'OPEN' })
  );
  assert.match(doorHtml, /data-visual-kind="door"/);
  const tvHtml = renderToStaticMarkup(
    React.createElement(DeviceVisual, { uid: 'tv-1', deviceType: 'TV', isOn: true })
  );
  assert.match(tvHtml, /data-visual-kind="tv"/);

  // 2. Sensor metric normalization (DB aliases & realtime SENSOR_READING_UPDATED patches)
  const metrics = extractSensorMetrics({
    temp: 29.5,
    humid: 71,
    LIGHT_SENSOR: 1,
    MOTION_SENSOR: 1,
    gas_ppm: 120,
    FLAME_SENSOR: 0,
  });
  assert.equal(metrics.temperature, 29.5);
  assert.equal(metrics.humidity, 71);
  assert.equal(metrics.lightBinary, true);
  assert.equal(metrics.motion, true);
  assert.equal(metrics.gasPpm, 120);
  assert.equal(metrics.flame, false);

  assert.deepEqual(normalizeSensorReadingPatch('temp', 27), { temp: 27, temperature: 27 });
  assert.deepEqual(normalizeSensorReadingPatch('gas_ppm', 310), { gas_ppm: 310, gas: 310 });

  // 3. HomeFavoriteDevices (/home): FAN/TV/AC show power toggle + read-only status summaries (no inline sliders/adjusters); Sensor shows DB telemetry
  const homeCalls = [];
  const HomeFavoriteDevices = loadHomeFavoriteDevices({
    onSendCommand: (fn, args) => {
      homeCalls.push({ fn, args });
      return fn === 'sendManualPowerCommand' ? { command: { success: true } } : { success: true };
    },
  });

  const fanDev = {
    id: 'fan-1',
    homeId: 'home-1',
    roomName: 'Phòng ngủ',
    name: 'Quạt đứng',
    deviceType: 'FAN',
    status: 'ONLINE',
    currentState: { power: 'ON', speed: 2 },
  };
  const tvDev = {
    id: 'tv-1',
    homeId: 'home-1',
    roomName: 'Phòng khách',
    name: 'Smart TV TCL',
    deviceType: 'TV',
    status: 'ONLINE',
    currentState: { power: 'ON', channel: 5 },
  };
  const acDev = {
    id: 'ac-1',
    homeId: 'home-1',
    roomName: 'Phòng khách',
    name: 'Điều hòa Daikin',
    deviceType: 'AIR_CONDITIONER',
    status: 'ONLINE',
    currentState: { power: 'ON', temperature: 24, mode: 'COOL' },
  };
  const sensorDev = {
    id: 'sensor-1',
    homeId: 'home-1',
    roomName: 'Bếp',
    name: 'Cảm biến bếp',
    deviceType: 'SMOKE_SENSOR',
    status: 'ONLINE',
    currentState: { temp: 31, humid: 65, gas_ppm: 150, FLAME_SENSOR: 0 },
  };

  const homeTree = HomeFavoriteDevices({
    homeId: 'home-1',
    selectedRoomId: null,
    devices: [fanDev, tvDev, acDev, sensorDev],
  });
  const homeButtons = findElements(homeTree, (el) => el.type === 'button');
  const fanToggleBtn = homeButtons.find((b) => b.props?.['aria-label'] === 'Tắt Quạt đứng');
  const tvToggleBtn = homeButtons.find((b) => b.props?.['aria-label'] === 'Tắt Smart TV TCL');
  const acToggleBtn = homeButtons.find((b) => b.props?.['aria-label'] === 'Tắt Điều hòa Daikin');
  assert.ok(fanToggleBtn);
  assert.ok(tvToggleBtn);
  assert.ok(acToggleBtn);
  assert.equal(homeButtons.find((b) => b.props?.children === 'Mức 3'), undefined);
  assert.equal(homeButtons.find((b) => b.props?.children === 'Mute'), undefined);
  assert.equal(homeButtons.find((b) => b.props?.title === 'Tăng nhiệt độ'), undefined);

  await fanToggleBtn.props.onClick({ stopPropagation: () => {} });
  await tvToggleBtn.props.onClick({ stopPropagation: () => {} });
  await acToggleBtn.props.onClick({ stopPropagation: () => {} });

  assert.ok(
    homeCalls.some((c) => c.fn === 'sendManualPowerCommand' && c.args[0] === 'fan-1' && c.args[1] === 'TURN_OFF')
  );
  assert.ok(
    homeCalls.some((c) => c.fn === 'sendManualPowerCommand' && c.args[0] === 'tv-1' && c.args[1] === 'TURN_OFF')
  );
  assert.ok(
    homeCalls.some((c) => c.fn === 'setAcPower' && c.args[0] === 'ac-1' && c.args[1] === false)
  );

  const homeHtml2 = renderToStaticMarkup(homeTree);
  assert.match(homeHtml2, /Mức 2/);
  assert.match(homeHtml2, /Kênh 5/);
  assert.match(homeHtml2, /24°C/);
  assert.match(homeHtml2, /Lạnh/);
  assert.match(homeHtml2, /31°C/);
  assert.match(homeHtml2, /65%/);
  assert.match(homeHtml2, /150 ppm/);

  // 4. DevicePage (/home/:homeId/devices): cards keep power toggles + read-only summaries, omitting inline adjusters
  const pagePowerCalls = [];
  const pageHarness = createDevicePageHarness({
    initialDevices: [fanDev, tvDev, acDev, sensorDev],
    onSendPower: async (...args) => {
      pagePowerCalls.push(args);
      return { command: { success: true } };
    },
  });
  const pageHtml = pageHarness.renderHtml();
  assert.match(pageHtml, /Mức 2/);
  assert.match(pageHtml, /Kênh 5/);
  assert.match(pageHtml, /24°C/);
  assert.match(pageHtml, /Lạnh/);
  assert.match(pageHtml, /150 ppm/);
  assert.doesNotMatch(pageHtml, /Vol-/);
  assert.doesNotMatch(pageHtml, /aria-label="Tăng nhiệt độ"/);
  assert.doesNotMatch(pageHtml, /class="brightness/);

  const pageTree = pageHarness.renderTree();
  const pageCards = findElements(
    pageTree,
    (el) => typeof el.type === 'function' && el.type.name === 'DevicesDeviceCard'
  );
  const fanCard = pageCards.find((c) => c.props.device.id === 'fan-1');
  const tvCard = pageCards.find((c) => c.props.device.id === 'tv-1');
  const acCard = pageCards.find((c) => c.props.device.id === 'ac-1');
  await fanCard.props.onToggle();
  await tvCard.props.onToggle();
  await acCard.props.onToggle();
  assert.deepEqual(pagePowerCalls, [
    ['fan-1', 'TURN_OFF'],
    ['tv-1', 'TURN_OFF'],
    ['ac-1', 'TURN_OFF'],
  ]);

  // 5. ControlTab: FAN speed panel, TV remote D-Pad & 0-9 keypad, AC timer & enum mode/fan, Sensor DB metrics
  const ctrlApiCalls = [];
  const ControlTab = loadControlTab({
    onDeviceApiCall: (fn, args) => ctrlApiCalls.push({ fn, args }),
  });

  const tvCtrlHtml = renderToStaticMarkup(
    React.createElement(ControlTab, {
      device: { id: 'tv-1', name: 'Smart TV TCL', deviceType: 'TV', raw: tvDev },
      resolvedType: 'Công tắc',
      disabled: false,
      isOn: true,
      lightLevel: 80,
      setLightLevel: () => {},
      acTemp: 24,
      setAcTemp: () => {},
      acMode: 'Lạnh',
      setAcMode: () => {},
      gateState: 'Dừng',
      setGateState: () => {},
    })
  );
  assert.match(tvCtrlHtml, /Điều khiển nhanh TV/);
  assert.match(tvCtrlHtml, /Bàn phím số \(0–9\)/);
  assert.match(tvCtrlHtml, />OK</);
  assert.match(tvCtrlHtml, /aria-label="Giảm âm lượng"/);
  assert.match(tvCtrlHtml, /aria-label="Tăng âm lượng"/);
  assert.match(tvCtrlHtml, /Tắt tiếng/);
  assert.match(tvCtrlHtml, /Nguồn HDMI/);
  assert.match(tvCtrlHtml, /Màn hình chính/);

  const acCtrlHtml = renderToStaticMarkup(
    React.createElement(ControlTab, {
      device: { id: 'ac-1', name: 'Điều hòa Daikin', deviceType: 'AIR_CONDITIONER', raw: acDev },
      resolvedType: 'Điều hòa',
      disabled: false,
      isOn: true,
      lightLevel: 80,
      setLightLevel: () => {},
      acTemp: 24,
      setAcTemp: () => {},
      acMode: 'Lạnh',
      setAcMode: () => {},
      gateState: 'Dừng',
      setGateState: () => {},
    })
  );
  assert.match(acCtrlHtml, /data-ac-arc-dial="true"/);
  assert.match(acCtrlHtml, /role="slider"/);
  assert.match(acCtrlHtml, /aria-valuemin="16"/);
  assert.match(acCtrlHtml, /aria-valuemax="32"/);
  assert.match(acCtrlHtml, /aria-valuenow="24"/);
  assert.match(acCtrlHtml, /aria-label="Giảm nhiệt độ"/);
  assert.match(acCtrlHtml, /aria-label="Tăng nhiệt độ"/);
  assert.match(acCtrlHtml, /Lạnh/);
  assert.match(acCtrlHtml, /Hút ẩm/);
  assert.match(acCtrlHtml, /Sưởi/);
  assert.match(acCtrlHtml, /Tự động/);
  assert.match(acCtrlHtml, /Tắt sau 1 giờ/);
  assert.match(acCtrlHtml, /Hủy hẹn giờ/);
  // Verify AC mode mapping used by ControlTab for Sưởi -> HEAT
  const { AC_MODE_LABEL_TO_CODE } = loadSource('src/components/device/deviceHelpers.ts');
  assert.equal(AC_MODE_LABEL_TO_CODE['Sưởi'], 'HEAT');
  assert.match(acCtrlHtml, /<button[^>]*aria-pressed="true"[^>]*>.*?Lạnh.*?<\/button>/);

  const fanCtrlHtml = renderToStaticMarkup(
    React.createElement(ControlTab, {
      device: { id: 'fan-1', name: 'Quạt đứng', deviceType: 'FAN', raw: fanDev },
      resolvedType: 'Công tắc',
      disabled: false,
      isOn: true,
      lightLevel: 80,
      setLightLevel: () => {},
      acTemp: 24,
      setAcTemp: () => {},
      acMode: 'Lạnh',
      setAcMode: () => {},
      gateState: 'Dừng',
      setGateState: () => {},
    })
  );
  assert.match(fanCtrlHtml, /Tốc độ quạt/);
  assert.match(fanCtrlHtml, /Mức 3/);

  const sensorCtrlHtml = renderToStaticMarkup(
    React.createElement(ControlTab, {
      device: { id: 'sensor-1', name: 'Cảm biến bếp', deviceType: 'SMOKE_SENSOR', raw: sensorDev },
      resolvedType: 'Cảm biến',
      disabled: false,
      isOn: true,
      lightLevel: 80,
      setLightLevel: () => {},
      acTemp: 24,
      setAcTemp: () => {},
      acMode: 'Lạnh',
      setAcMode: () => {},
      gateState: 'Dừng',
      setGateState: () => {},
    })
  );
  assert.match(sensorCtrlHtml, /Nồng độ khí gas/);
  assert.match(sensorCtrlHtml, /150 ppm/);
  assert.match(sensorCtrlHtml, /Cảm biến lửa/);

  // 6. DeviceDetailModal: redundant "..." button removed and body scroll lock present
  const modalSource = readFileSync(
    resolve(root, 'src/components/device/DeviceDetailModal.tsx'),
    'utf8'
  );
  assert.doesNotMatch(modalSource, /MoreHorizontal/);
  assert.doesNotMatch(modalSource, /aria-label="Tùy chọn thiết bị"/);
  assert.match(modalSource, /htmlEl\.style\.overflow = 'hidden'/);
  assert.match(modalSource, /bodyEl\.style\.overflow = 'hidden'/);
});

test('DeviceGroupSection hides brightness for non-dimmable groups, filters sensors, and supports editing groups', () => {
  const filename = resolve(root, 'src/components/device/DeviceGroupSection.tsx');
  const source = readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });

  const renderGroupSectionHtml = (initialGroups, availableDevices) => {
    let slot = 0;
    const mod = { exports: {} };
    const FakeIcon = (props) => React.createElement('svg', props);
    const customRequire = (id) => {
      if (id === 'react') {
        return {
          ...React,
          default: React,
          useState: (init) => {
            const idx = slot++;
            const val = idx === 0 ? initialGroups : idx === 1 ? false : idx === 2 ? true : (typeof init === 'function' ? init() : init);
            return [val, () => {}];
          },
          useEffect: () => {},
          useRef: (init) => ({ current: init }),
          useCallback: (fn) => fn,
          useMemo: (fn) => fn(),
        };
      }
      if (id === 'lucide-react') return new Proxy({}, { get: () => FakeIcon });
      if (id === '../ui/confirmDialog') return { confirmDialog: async () => true };
      if (id === '../ui/notify') return { notify: Object.assign(() => {}, { success: () => {}, error: () => {} }) };
      if (id === './deviceHelpers') return loadSource('src/components/device/deviceHelpers.ts');
      if (id === '../../services/deviceGroupApi') {
        return {
          getHomeDeviceGroups: async () => initialGroups,
          createDeviceGroup: async () => ({}),
          updateDeviceGroup: async () => ({}),
          deleteDeviceGroup: async () => {},
          sendGroupCommand: async () => ({ successCount: 0, totalDevices: 0 }),
        };
      }
      throw new Error(`Unexpected require from DeviceGroupSection.tsx: ${id}`);
    };
    runInThisContext(`(function(require, module, exports) { ${outputText}\n})`, { filename })(
      customRequire,
      mod,
      mod.exports
    );
    return {
      mod: mod.exports,
      html: renderToStaticMarkup(
        React.createElement(mod.exports.DeviceGroupSection, {
          homeId: 'home-1',
          availableDevices,
        })
      ),
    };
  };

  const fan = { id: 'fan-1', name: 'Quạt phòng khách', deviceType: 'FAN', status: 'ONLINE', roomName: 'Phòng khách' };
  const tv = { id: 'tv-1', name: 'TV TCL', deviceType: 'TV', status: 'ONLINE', roomName: 'Phòng khách' };
  const ac = { id: 'ac-1', name: 'Điều hòa DAIKIN', deviceType: 'AIR_CONDITIONER', status: 'OFFLINE', roomName: 'Phòng ngủ' };
  const pump = { id: 'pump-1', name: 'Máy bơm nước', deviceType: 'WATER_PUMP', status: 'ONLINE', roomName: 'Garden' };
  const light = { id: 'light-1', name: 'Đèn phòng khách', deviceType: 'LIGHT', status: 'ONLINE', roomName: 'Phòng khách' };
  const rgb = { id: 'rgb-1', name: 'Đèn RGB', deviceType: 'LED_RGB', status: 'ONLINE', roomName: 'Phòng ngủ' };
  const curtain = { id: 'curtain-1', name: 'Rèm phòng ngủ', deviceType: 'CURTAIN', status: 'ONLINE', roomName: 'Phòng ngủ' };
  const sensor = { id: 'sensor-1', name: 'Cảm biến khói', deviceType: 'SMOKE_SENSOR', status: 'ONLINE', roomName: 'Bếp' };
  const viewLight = { id: 'light-view', name: 'Đèn chỉ xem', deviceType: 'LIGHT', accessLevel: 'VIEW', status: 'ONLINE' };

  const tvFanGroup = {
    id: 'grp-1',
    homeId: 'home-1',
    name: 'Nhóm TV & Quạt',
    deviceCount: 2,
    deviceIds: ['fan-1', 'tv-1'],
    devices: [fan, tv],
    createdAt: '2026-11-24T00:00:00Z',
  };
  const lightGroup = {
    id: 'grp-2',
    homeId: 'home-1',
    name: 'Nhóm Đèn',
    deviceCount: 2,
    deviceIds: ['light-1', 'rgb-1'],
    devices: [light, rgb],
    createdAt: '2026-11-24T00:00:00Z',
  };
  const curtainGroup = {
    id: 'grp-3',
    homeId: 'home-1',
    name: 'Nhóm Rèm',
    deviceCount: 1,
    deviceIds: ['curtain-1'],
    devices: [curtain],
    createdAt: '2026-11-24T00:00:00Z',
  };

  const { mod, html: tvFanHtml } = renderGroupSectionHtml([tvFanGroup], [fan, tv, ac, pump, light, rgb, curtain, sensor]);
  assert.equal(mod.isGroupNonControllable(sensor), true);
  assert.equal(mod.isGroupNonControllable(viewLight), true);
  assert.equal(mod.isGroupDimmableDevice(tv), false);
  assert.equal(mod.isGroupDimmableDevice(fan), false);
  assert.equal(mod.isGroupDimmableDevice(ac), false);
  assert.equal(mod.isGroupDimmableDevice(pump), false);
  assert.equal(mod.isGroupDimmableDevice(light), true);
  assert.equal(mod.isGroupDimmableDevice(rgb), true);

  assert.deepEqual(
    mod.analyzeGroupCapabilities([fan, tv, ac, pump]),
    {
      powerCount: 4,
      dimmableCount: 0,
      colorCount: 0,
      fanCount: 1,
      acCount: 1,
      apertureCount: 0,
      onlineCount: 3,
      nonControllableCount: 0,
      hasPower: true,
      hasBrightness: false,
      hasColor: false,
      hasFanSpeed: false,
      hasAcControl: false,
      hasAperture: false,
    }
  );

  assert.deepEqual(
    mod.analyzeGroupCapabilities([ac, light]),
    {
      powerCount: 2,
      dimmableCount: 1,
      colorCount: 0,
      fanCount: 0,
      acCount: 1,
      apertureCount: 0,
      onlineCount: 1,
      nonControllableCount: 0,
      hasPower: true,
      hasBrightness: false,
      hasColor: false,
      hasFanSpeed: false,
      hasAcControl: false,
      hasAperture: false,
    }
  );

  // TV + Fan group: has Power + Edit button, NO Brightness/Fan/AC slider
  assert.match(tvFanHtml, /Bật tất cả/);
  assert.match(tvFanHtml, /Tắt tất cả/);
  assert.match(tvFanHtml, /aria-label="Sửa nhóm Nhóm TV &amp; Quạt"/);
  assert.doesNotMatch(tvFanHtml, /Độ sáng chung/);
  assert.doesNotMatch(tvFanHtml, /Tốc độ quạt chung/);

  // Mixed AC + Light group: shows Bật/Tắt tất cả only, NO Brightness/AC controls
  const acLightGroup = {
    id: 'grp-mix',
    homeId: 'home-1',
    name: 'Nhóm Điều hòa & Đèn',
    deviceCount: 2,
    deviceIds: ['ac-1', 'light-1'],
    devices: [ac, light],
    createdAt: '2026-11-24T00:00:00Z',
  };
  const { html: acLightHtml } = renderGroupSectionHtml([acLightGroup], [ac, light]);
  assert.match(acLightHtml, /Bật tất cả/);
  assert.match(acLightHtml, /Tắt tất cả/);
  assert.doesNotMatch(acLightHtml, /Độ sáng chung/);
  assert.doesNotMatch(acLightHtml, /Điều hòa chung/);

  // Mixed LIGHT + LED_RGB group: shows Brightness controls, NO RGB color
  const { html: lightHtml } = renderGroupSectionHtml([lightGroup], [light, rgb]);
  assert.match(lightHtml, /Độ sáng chung nhóm/);
  assert.match(lightHtml, /Bật tất cả/);
  assert.doesNotMatch(lightHtml, /Màu sắc chung nhóm/);

  // Pure LED_RGB group: renders both Brightness and RGB color controls
  const rgbOnlyGroup = {
    id: 'grp-rgb',
    homeId: 'home-1',
    name: 'Nhóm Đèn RGB',
    deviceCount: 1,
    deviceIds: ['rgb-1'],
    devices: [rgb],
    createdAt: '2026-11-24T00:00:00Z',
  };
  const { html: rgbHtml } = renderGroupSectionHtml([rgbOnlyGroup], [rgb]);
  assert.match(rgbHtml, /Độ sáng chung nhóm/);
  assert.match(rgbHtml, /Màu sắc chung nhóm/);

  // Pure FAN group: renders Fan speed controls (Mức 1..3)
  const fanOnlyGroup = {
    id: 'grp-fan',
    homeId: 'home-1',
    name: 'Nhóm Quạt',
    deviceCount: 1,
    deviceIds: ['fan-1'],
    devices: [fan],
    createdAt: '2026-11-24T00:00:00Z',
  };
  const { html: fanOnlyHtml } = renderGroupSectionHtml([fanOnlyGroup], [fan]);
  assert.match(fanOnlyHtml, /Tốc độ quạt chung/);
  assert.match(fanOnlyHtml, /Mức 1/);
  assert.match(fanOnlyHtml, /Mức 3/);

  // Pure AIR_CONDITIONER group: renders AC temp + mode controls
  const acOnlyGroup = {
    id: 'grp-ac',
    homeId: 'home-1',
    name: 'Nhóm Điều hòa',
    deviceCount: 1,
    deviceIds: ['ac-1'],
    devices: [ac],
    createdAt: '2026-11-24T00:00:00Z',
  };
  const { html: acOnlyHtml } = renderGroupSectionHtml([acOnlyGroup], [ac]);
  assert.match(acOnlyHtml, /Điều hòa chung/);
  assert.match(acOnlyHtml, /Lạnh/);
  assert.match(acOnlyHtml, /Sưởi/);
  assert.match(acOnlyHtml, /Tự động/);

  // Curtain group: renders Mở/Dừng/Đóng tất cả, NO Power/Brightness
  const { html: curtainHtml } = renderGroupSectionHtml([curtainGroup], [curtain]);
  assert.match(curtainHtml, /Mở tất cả/);
  assert.match(curtainHtml, /Đóng tất cả/);
  assert.doesNotMatch(curtainHtml, /Bật tất cả/);
  assert.doesNotMatch(curtainHtml, /Độ sáng chung/);

  // Ensure updateDeviceGroup and strict category selector are wired in source
  assert.match(source, /updateDeviceGroup/);
  assert.match(source, /Loại thiết bị của nhóm/);

  // Card category badges (pure type + legacy mixed)
  assert.match(tvFanHtml, /Hỗn hợp/);
  assert.match(acLightHtml, /Hỗn hợp/);
  assert.match(fanOnlyHtml, />Quạt</);
  assert.match(acOnlyHtml, />Điều hòa</);
  assert.match(curtainHtml, />Rèm &amp; Cửa</);

  // Strict device-type categorization helpers
  const smartPlug = {
    id: 'plug-1',
    name: 'Ổ cắm thông minh',
    deviceType: 'SMART_PLUG',
    status: 'ONLINE',
    roomId: 'room-1',
    roomName: 'Phòng khách',
    homeId: 'home-1',
    lastState: '{"power":true}',
  };
  assert.equal(mod.getGroupDeviceCategory(light), 'LIGHT');
  assert.equal(mod.getGroupDeviceCategory(rgb), 'LED_RGB');
  assert.equal(mod.getGroupDeviceCategory(ac), 'AIR_CONDITIONER');
  assert.equal(mod.getGroupDeviceCategory(fan), 'FAN');
  assert.equal(mod.getGroupDeviceCategory(tv), 'TV');
  assert.equal(mod.getGroupDeviceCategory(pump), 'WATER_PUMP');
  assert.equal(mod.getGroupDeviceCategory(curtain), 'APERTURE');
  assert.equal(mod.getGroupDeviceCategory(smartPlug), 'SWITCH');
  assert.equal(mod.getGroupDeviceCategory(sensor), 'NONE');
  assert.equal(mod.getGroupDeviceCategory(viewLight), 'NONE');

  assert.deepEqual(mod.getSelectionDeviceCategory([fan]), {
    lockedCategory: 'FAN',
    hasMixedCategoryConflict: false,
    categoriesPresent: ['FAN'],
  });
  assert.deepEqual(mod.getSelectionDeviceCategory([fan, pump]), {
    lockedCategory: null,
    hasMixedCategoryConflict: true,
    categoriesPresent: ['FAN', 'WATER_PUMP'],
  });
  assert.deepEqual(mod.getSelectionDeviceCategory([]), {
    lockedCategory: null,
    hasMixedCategoryConflict: false,
    categoriesPresent: [],
  });

  // Strict same-type compatibility: never mix different device types (e.g., LIGHT vs LED_RGB, FAN vs AC/PUMP)
  const light2 = { ...light, id: 'light-2', name: 'Đèn bếp' };
  const fan2 = { ...fan, id: 'fan-2', name: 'Quạt ngủ' };
  assert.equal(mod.isDeviceCompatibleWithSelection(light2, [light]), true);
  assert.equal(mod.isDeviceCompatibleWithSelection(rgb, [light]), false);
  assert.equal(mod.isDeviceCompatibleWithSelection(light, [rgb]), false);
  assert.equal(mod.isDeviceCompatibleWithSelection(fan2, [fan]), true);
  assert.equal(mod.isDeviceCompatibleWithSelection(ac, [fan]), false);
  assert.equal(mod.isDeviceCompatibleWithSelection(pump, [fan]), false);
  assert.equal(mod.isDeviceCompatibleWithSelection(curtain, [fan]), false);
  assert.equal(mod.isDeviceCompatibleWithSelection(curtain, [curtain]), true);
  assert.equal(mod.isDeviceCompatibleWithSelection(fan, [fan, pump]), false);
  assert.equal(mod.isDeviceCompatibleWithSelection(fan, []), true);
  assert.equal(mod.isDeviceCompatibleWithSelection(curtain, []), true);
  assert.equal(mod.isDeviceCompatibleWithSelection(sensor, []), false);
});

test('energyUtils: computeEvnCostSplit derives consistent tier and explicit hex classes', () => {
  const energyUtils = loadSource('src/components/energy/energyUtils.ts');

  // Even if caller passes stale backend tier=5 for 33.53 kWh, EVN math stays consistent at Tier 1
  const lowSplit = energyUtils.computeEvnCostSplit(33.53, 5);
  assert.equal(lowSplit.computedTier, 1);
  assert.ok(lowSplit.progressInCurrentTier > 66 && lowSplit.progressInCurrentTier < 68);
  assert.ok(Math.abs(lowSplit.kwhLeftToNextTier - 16.47) < 0.01);

  // 327 kWh -> Tier 5 (27% in 301-400 bracket, 73 kWh left to Tier 6)
  const midSplit = energyUtils.computeEvnCostSplit(327, 5);
  assert.equal(midSplit.computedTier, 5);
  assert.equal(midSplit.progressInCurrentTier, 27);
  assert.equal(midSplit.kwhLeftToNextTier, 73);

  // Explicit hex classes (never washed-out @theme overrides like text-emerald-500)
  const tier1Color = energyUtils.getTierColorClass(1);
  const tier5Color = energyUtils.getTierColorClass(5);
  assert.match(tier1Color.badge, /#047857/);
  assert.match(tier1Color.bgLight, /#059669/);
  assert.match(tier5Color.badge, /#be123c/);
  assert.match(tier5Color.bgLight, /#e11d48/);
});
