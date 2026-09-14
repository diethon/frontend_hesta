import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, beforeEach, test } from 'node:test';
import { runInThisContext } from 'node:vm';
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
    compilerOptions: { module: ts.ModuleKind.CommonJS },
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
const storage = new Map([['accessToken', 'scene-token']]);
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key) => storage.get(key) ?? null,
  removeItem: (key) => storage.delete(key),
} });

const { apiClient } = loadSource('src/services/apiClient.ts');
const sceneApi = loadSource('src/services/sceneApi.ts');
const originalAdapter = apiClient.defaults.adapter;
let requests = [];

beforeEach(() => {
  requests = [];
  apiClient.defaults.adapter = async (config) => {
    requests.push(config);
    return {
      data: { code: 1000, result: { id: 'result-id' } },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    };
  };
});

after(() => {
  apiClient.defaults.adapter = originalAdapter;
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

  assert.deepEqual(requests.map(({ method }) => method.toUpperCase()), ['GET', 'GET', 'POST', 'PUT', 'DELETE']);
  assert.deepEqual(requests.map(({ baseURL, url }) => new URL(`${baseURL}${url}`).pathname), [
    '/api/v1/homes/home-1/scenes',
    '/api/v1/homes/home-1/scenes/scene-1',
    '/api/v1/homes/home-1/scenes',
    '/api/v1/homes/home-1/scenes/scene-1',
    '/api/v1/homes/home-1/scenes/scene-1',
  ]);
  assert.deepEqual(JSON.parse(requests[2].data), createPayload);
  assert.deepEqual(JSON.parse(requests[3].data), updatePayload);
  assert.ok(requests.every(({ headers }) => headers.get('Authorization') === 'Bearer scene-token'));
});

test('SceneAction methods match add, remove, and atomic reorder contracts', async () => {
  const action = { targetDeviceId: 'device-1', action: 'TURN_OFF', value: null, order: 0 };
  await sceneApi.addSceneAction('home-1', 'scene-1', action);
  await sceneApi.removeSceneAction('home-1', 'scene-1', 'action-1');
  await sceneApi.reorderSceneActions('home-1', 'scene-1', ['action-2', 'action-1']);

  assert.deepEqual(requests.map(({ method }) => method.toUpperCase()), ['POST', 'DELETE', 'PUT']);
  assert.deepEqual(requests.map(({ baseURL, url }) => new URL(`${baseURL}${url}`).pathname), [
    '/api/v1/homes/home-1/scenes/scene-1/actions',
    '/api/v1/homes/home-1/scenes/scene-1/actions/action-1',
    '/api/v1/homes/home-1/scenes/scene-1/actions/reorder',
  ]);
  assert.deepEqual(JSON.parse(requests[0].data), action);
  assert.deepEqual(JSON.parse(requests[2].data), { actionIds: ['action-2', 'action-1'] });
});

test('backend validation messages are surfaced to the UI', async () => {
  apiClient.defaults.adapter = async (config) => {
    const error = new Error('Request failed with status code 400');
    error.config = config;
    error.response = {
      status: 400,
      data: { code: 1113, message: 'Scene action value is invalid for the selected action' },
      headers: {},
      config,
    };
    throw error;
  };

  await assert.rejects(
    () => sceneApi.addSceneAction('home-1', 'scene-1', {
      targetDeviceId: 'device-1', action: 'SET_BRIGHTNESS', value: 101, order: 0,
    }),
    /Scene action value is invalid/,
  );
});
