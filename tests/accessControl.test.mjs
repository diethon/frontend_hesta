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
const { homeEventsDestination } = loadSource('src/realtime/realtimeClient.ts');
const { isControllable, canControlDevice, isReadOnlyDevice } = loadSource('src/components/device/deviceHelpers.ts');

test('homeEventsDestination routes ALL members to topic and CUSTOM members to user queue', () => {
  const homeId = '42424242-4242-4242-4242-424242424242';

  const sharedTopic = homeEventsDestination(homeId, false);
  assert.equal(sharedTopic, `/topic/homes/${homeId}/events`);

  const userQueue = homeEventsDestination(homeId, true);
  assert.equal(userQueue, `/user/queue/homes/${homeId}/events`);
});

test('deviceHelpers correctly evaluate device access levels', () => {
  const controlDevice = {
    id: 'd1',
    deviceType: 'LIGHT',
    name: 'Đèn phòng khách',
    status: 'ONLINE',
    currentState: { power: 'ON' },
    accessLevel: 'CONTROL',
  };

  const viewOnlyDevice = {
    id: 'd2',
    deviceType: 'LIGHT',
    name: 'Đèn phòng ngủ',
    status: 'ONLINE',
    currentState: { power: 'ON' },
    accessLevel: 'VIEW',
  };

  const hiddenDevice = {
    id: 'd3',
    deviceType: 'LIGHT',
    name: 'Đèn phòng kho',
    status: 'ONLINE',
    currentState: { power: 'OFF' },
    accessLevel: 'NONE',
  };

  assert.equal(isControllable(controlDevice), true);
  assert.equal(canControlDevice(controlDevice), true);
  assert.equal(isReadOnlyDevice(controlDevice), false);

  assert.equal(isControllable(viewOnlyDevice), false);
  assert.equal(canControlDevice(viewOnlyDevice), false);
  assert.equal(isReadOnlyDevice(viewOnlyDevice), true);

  assert.equal(isControllable(hiddenDevice), false);
  assert.equal(canControlDevice(hiddenDevice), false);
  assert.equal(isReadOnlyDevice(hiddenDevice), false);
});
