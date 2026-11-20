import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);

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

function loadFallServiceHarness() {
  const filename = resolve(root, 'src/services/fallDetectionService.ts');
  const source = readFileSync(filename, 'utf8').replaceAll('import.meta.env', 'globalThis.__viteEnv');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });

  const axiosCalls = [];
  let axiosResponder = async () => ({
    data: {
      state: 'STANDING',
      alert: false,
      incident_type: 'NONE',
      metrics: {},
      safe_zone: 'Phòng khách',
      fps: 30,
    },
  });

  const fakeAxios = {
    get: async (url, config) => {
      axiosCalls.push({ method: 'GET', url, config });
      return axiosResponder(url, config);
    },
    post: async (url, body, config) => {
      axiosCalls.push({ method: 'POST', url, body, config });
      return { data: { success: true } };
    },
  };

  const mod = { exports: {} };
  const customRequire = (id) => {
    if (id === 'axios') return fakeAxios;
    if (id === './apiClient') return { apiClient: { get: async () => ({ data: [] }), post: async () => ({}) } };
    return require(id);
  };

  runInThisContext(`(function(require, module, exports) { ${outputText}\n})`, { filename })(
    customRequire,
    mod,
    mod.exports
  );

  return {
    exports: mod.exports,
    axiosCalls,
    setAxiosResponder: (fn) => {
      axiosResponder = fn;
    },
  };
}

function createEmergencyModalHarness({
  checkAiStatus,
  dismissAiLocal,
  dismissIncident,
} = {}) {
  const filename = resolve(root, 'src/components/emergency/EmergencyFallModal.tsx');
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
  const intervals = [];
  let stateCursor = 0;
  let refCursor = 0;
  let renderedEffects = [];

  const FakeIcon = (props) => React.createElement('svg', props);

  const prevWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const prevDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');

  const windowListeners = new Map();
  let nextIntervalId = 1;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      addEventListener: (evt, fn) => {
        windowListeners.set(evt, fn);
      },
      removeEventListener: (evt) => {
        windowListeners.delete(evt);
      },
      setInterval: (fn, ms) => {
        const id = nextIntervalId++;
        intervals.push({ id, fn, ms });
        return id;
      },
      clearInterval: () => {},
      open: () => {},
    },
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { hidden: false },
  });

  const customRequire = (id) => {
    if (id === 'react') {
      return {
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
        useEffect: (fn) => {
          renderedEffects.push(fn);
        },
      };
    }
    if (id === 'lucide-react') {
      return new Proxy({}, { get: () => FakeIcon });
    }
    if (id === '../../services/fallDetectionService') {
      return {
        AI_VIDEO_FEED_URL: 'https://voice.hesta.homes/camera/video_feed',
        fallDetectionService: {
          checkAiStatus: checkAiStatus ?? (async () => null),
          dismissAiLocal: dismissAiLocal ?? (async () => true),
          dismissIncident: dismissIncident ?? (async () => {}),
          acknowledgeIncident: async () => {},
        },
      };
    }
    if (id === '@stomp/stompjs') {
      return {
        Client: class FakeClient {
          activate() {}
          async deactivate() {}
        },
      };
    }
    if (id === '../../services/apiClient') {
      return { getRealtimeWebSocketUrl: () => 'wss://api.test/ws' };
    }
    if (id === '../../store/hooks') {
      return { useAppSelector: (sel) => sel() };
    }
    if (id === '../../store/selectors') {
      return { selectAccessToken: () => null };
    }
    throw new Error(`Unexpected require from EmergencyFallModal.tsx: ${id}`);
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
    renderedEffects = [];
    const tree = mod.exports.EmergencyFallModal({});
    for (const ef of renderedEffects) {
      ef();
    }
    return tree;
  };

  const renderHtml = () => {
    stateCursor = 0;
    refCursor = 0;
    return renderToStaticMarkup(React.createElement(mod.exports.EmergencyFallModal));
  };

  const restoreGlobals = () => {
    if (prevWindow) Object.defineProperty(globalThis, 'window', prevWindow);
    else delete globalThis.window;
    if (prevDocument) Object.defineProperty(globalThis, 'document', prevDocument);
    else delete globalThis.document;
  };

  return { renderTree, renderHtml, intervals, restoreGlobals };
}

test('EmergencyFallModal renders red border + floating SOS bubble first and only opens modal when clicked', async () => {
  let currentStatus = null;
  let dismissAiCalls = 0;
  let dismissBackendCalls = 0;

  const harness = createEmergencyModalHarness({
    checkAiStatus: async () => currentStatus,
    dismissAiLocal: async () => {
      dismissAiCalls += 1;
      return true;
    },
    dismissIncident: async () => {
      dismissBackendCalls += 1;
    },
  });

  try {
    // 1. No active incident -> null
    let tree = harness.renderTree();
    assert.equal(tree, null);
    assert.equal(harness.renderHtml(), '');

    const pollEntry = harness.intervals.find((i) => i.ms === 2500);
    assert.ok(pollEntry, 'Expected AI status polling interval at 2500ms');

    // 2. CAMERA_RECONNECTING with alert: true -> must NOT trigger SOS
    currentStatus = {
      alert: true,
      state: 'CAMERA_RECONNECTING',
      incident_type: 'ACCIDENTAL_FALL',
      safe_zone: 'Phòng khách',
      metrics: { spine_angle: 76, accel_g: 1.6, jerk_g_per_sec: 10, ptt_sec: 0 },
      fps: 2,
    };
    await pollEntry.fn();
    tree = harness.renderTree();
    assert.equal(tree, null);

    // 3. CONFIRMED_FALL -> shows red viewport border + SOS bubble, modal must stay closed
    currentStatus = {
      alert: true,
      state: 'CONFIRMED_FALL',
      incident_type: 'ACCIDENTAL_FALL',
      safe_zone: 'Phòng khách',
      metrics: { spine_angle: 14, accel_g: 3.1, jerk_g_per_sec: 15, ptt_sec: 0.5 },
      fps: 30,
    };
    await pollEntry.fn();
    tree = harness.renderTree();
    assert.ok(tree);
    let html = harness.renderHtml();

    assert.equal(findElements(tree, (el) => el.props?.['data-testid'] === 'sos-screen-edge').length, 1);
    const bubbles = findElements(tree, (el) => el.props?.['data-testid'] === 'sos-floating-bubble');
    assert.equal(bubbles.length, 1);
    assert.equal(findElements(tree, (el) => el.props?.role === 'dialog').length, 0);
    assert.equal(findElements(tree, (el) => el.props?.role === 'heading').length, 0);
    assert.doesNotMatch(html, /role="dialog"|LIVE YOLOv8-POSE HUD|https:\/\/voice\.hesta\.homes\/camera\/video_feed/);

    // 4. Click SOS bubble -> full Emergency SOS modal opens and bubble hides, border remains
    bubbles[0].props.onClick();
    tree = harness.renderTree();
    html = harness.renderHtml();
    assert.equal(findElements(tree, (el) => el.props?.['data-testid'] === 'sos-screen-edge').length, 1);
    assert.equal(findElements(tree, (el) => el.props?.['data-testid'] === 'sos-floating-bubble').length, 0);
    assert.equal(findElements(tree, (el) => el.props?.role === 'dialog').length, 1);
    assert.match(html, /role="dialog"[^>]*>.*>CẢNH BÁO TÉ NGÃ KHẨN CẤP \(EMERGENCY SOS\)</);

    // 5. Click collapse button -> collapses back to SOS bubble + red border
    const collapseBtn = findElements(tree, (el) => el.props?.['data-testid'] === 'sos-collapse-btn')[0];
    assert.ok(collapseBtn);
    collapseBtn.props.onClick();
    tree = harness.renderTree();
    assert.equal(findElements(tree, (el) => el.props?.role === 'dialog').length, 0);
    assert.equal(findElements(tree, (el) => el.props?.['data-testid'] === 'sos-floating-bubble').length, 1);
    assert.equal(findElements(tree, (el) => el.props?.['data-testid'] === 'sos-screen-edge').length, 1);

    // 6. Re-open and dismiss -> clears everything back to null
    findElements(tree, (el) => el.props?.['data-testid'] === 'sos-floating-bubble')[0].props.onClick();
    tree = harness.renderTree();
    const dismissBtn = findElements(
      tree,
      (el) =>
        el.type === 'button' &&
        typeof el.props?.onClick === 'function' &&
        JSON.stringify(el.props.children).includes('TÔI ỔN / BÁO ĐỘNG GIẢ')
    )[0];
    assert.ok(dismissBtn);
    await dismissBtn.props.onClick();
    assert.equal(dismissAiCalls, 1);
    assert.equal(dismissBackendCalls, 1);

    tree = harness.renderTree();
    assert.equal(tree, null);
    assert.equal(harness.renderHtml(), '');
  } finally {
    harness.restoreGlobals();
  }
});

test('fallDetectionService.checkAiStatus deduplicates concurrent/rapid calls and clears cache on resetAiStatusCache', async () => {
  const prevEnv = globalThis.__viteEnv;
  globalThis.__viteEnv = { VITE_AI_CAMERA_URL: 'https://voice.hesta.homes/camera' };
  const harness = loadFallServiceHarness();
  try {
    const { fallDetectionService, resetAiStatusCache } = harness.exports;
    resetAiStatusCache();

    // Concurrent calls should share a single in-flight GET request
    let resolveReq;
    harness.setAxiosResponder(
      () =>
        new Promise((resolve) => {
          resolveReq = resolve;
        })
    );
    const p1 = fallDetectionService.checkAiStatus();
    const p2 = fallDetectionService.checkAiStatus();
    assert.equal(harness.axiosCalls.length, 1);
    resolveReq({
      data: { state: 'STANDING', alert: false, incident_type: 'NONE', metrics: {}, safe_zone: 'A', fps: 30 },
    });
    const [r1, r2] = await Promise.all([p1, p2]);
    assert.deepEqual(r1, r2);

    // Subsequent call within 1500ms TTL hits memory cache
    const r3 = await fallDetectionService.checkAiStatus();
    assert.equal(harness.axiosCalls.length, 1);
    assert.deepEqual(r3, r1);

    // Clearing cache forces a fresh GET request
    resetAiStatusCache();
    harness.setAxiosResponder(async () => ({
      data: { state: 'CONFIRMED_FALL', alert: true, incident_type: 'ACCIDENTAL_FALL', metrics: {}, safe_zone: 'B', fps: 29 },
    }));
    const r4 = await fallDetectionService.checkAiStatus();
    assert.equal(harness.axiosCalls.length, 2);
    assert.equal(r4.state, 'CONFIRMED_FALL');
  } finally {
    globalThis.__viteEnv = prevEnv;
  }
});
