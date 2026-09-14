import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, beforeEach, test } from 'node:test';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const modules = new Map();

function loadSource(path) {
  const filename = resolve(root, path);
  if (modules.has(filename)) return modules.get(filename).exports;
  const module = { exports: {} };
  modules.set(filename, module);
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
    fileName: filename,
  });
  const sourceRequire = (name) => {
    const base = resolve(dirname(filename), name);
    const dependencyPath = ['.ts', '.tsx'].map((extension) => base + extension).find(existsSync);
    assert.ok(dependencyPath, `Cannot resolve ${name} from ${path}`);
    return loadSource(dependencyPath);
  };
  runInThisContext(`(function(require, module, exports) { ${outputText}\n})`, { filename })(sourceRequire, module, module.exports);
  return module.exports;
}

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const originalFetch = globalThis.fetch;
const storage = new Map([['accessToken', 'scene-token']]);
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key) => storage.get(key) ?? null,
  removeItem: (key) => storage.delete(key),
} });

const sceneApi = loadSource('src/services/sceneApi.ts');
let requests = [];

beforeEach(() => {
  requests = [];
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), ...init });
    return new Response(JSON.stringify({ code: 1000, result: { id: 'result-id' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
});

after(() => {
  globalThis.fetch = originalFetch;
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else delete globalThis.localStorage;
});

test('Scene CRUD methods match the backend routes and payloads', async () => {
  const createPayload = { name: 'Ngủ', description: 'Tắt đèn', enabled: true, actions: [] };
  const updatePayload = { name: 'Ngủ sớm', description: null, enabled: false };
  await sceneApi.listScenes('home-1');
  await sceneApi.getScene('home-1', 'scene-1');
  await sceneApi.createScene('home-1', createPayload);
  await sceneApi.updateScene('home-1', 'scene-1', updatePayload);
  await sceneApi.deleteScene('home-1', 'scene-1');

  assert.deepEqual(requests.map(({ method }) => method ?? 'GET'), ['GET', 'GET', 'POST', 'PUT', 'DELETE']);
  assert.deepEqual(requests.map(({ url }) => new URL(url).pathname), [
    '/api/v1/homes/home-1/scenes',
    '/api/v1/homes/home-1/scenes/scene-1',
    '/api/v1/homes/home-1/scenes',
    '/api/v1/homes/home-1/scenes/scene-1',
    '/api/v1/homes/home-1/scenes/scene-1',
  ]);
  assert.deepEqual(JSON.parse(requests[2].body), createPayload);
  assert.deepEqual(JSON.parse(requests[3].body), updatePayload);
  assert.ok(requests.every(({ headers }) => headers.Authorization === 'Bearer scene-token'));
});

test('SceneAction methods match add, remove, and atomic reorder contracts', async () => {
  const action = { targetDeviceId: 'device-1', action: 'TURN_OFF', value: null, order: 0 };
  await sceneApi.addSceneAction('home-1', 'scene-1', action);
  await sceneApi.removeSceneAction('home-1', 'scene-1', 'action-1');
  await sceneApi.reorderSceneActions('home-1', 'scene-1', ['action-2', 'action-1']);

  assert.deepEqual(requests.map(({ method }) => method), ['POST', 'DELETE', 'PUT']);
  assert.deepEqual(requests.map(({ url }) => new URL(url).pathname), [
    '/api/v1/homes/home-1/scenes/scene-1/actions',
    '/api/v1/homes/home-1/scenes/scene-1/actions/action-1',
    '/api/v1/homes/home-1/scenes/scene-1/actions/reorder',
  ]);
  assert.deepEqual(JSON.parse(requests[0].body), action);
  assert.deepEqual(JSON.parse(requests[2].body), { actionIds: ['action-2', 'action-1'] });
});

test('backend validation messages are surfaced to the UI', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    code: 1113,
    message: 'Scene action value is invalid for the selected action',
  }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  await assert.rejects(
    () => sceneApi.addSceneAction('home-1', 'scene-1', {
      targetDeviceId: 'device-1', action: 'SET_BRIGHTNESS', value: 101, order: 0,
    }),
    /Scene action value is invalid/,
  );
});
