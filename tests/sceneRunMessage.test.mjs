import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/components/scene/sceneRunMessage.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
const module = { exports: {} };
new Function('module', 'exports', outputText)(module, module.exports);
const { sceneRunMessage } = module.exports;

const scene = {
  name: 'Đi ngủ',
  actions: [
    { targetDeviceId: 'a', targetDeviceName: 'Đèn bếp' },
    { targetDeviceId: 'b', targetDeviceName: 'Quạt' },
  ],
};
const ok = (id) => ({ deviceId: id, success: true });
const offline = (id) => ({ deviceId: id, success: false, errorCode: 'DEVICE_OFFLINE', message: 'Thiết bị đang ngoại tuyến' });

test('names the devices that failed and why', () => {
  assert.deepEqual(sceneRunMessage(scene, { status: 'SUCCESS', resultDetail: [ok('a'), ok('b')] }), { kind: 'success', text: 'Đã chạy "Đi ngủ"' });
  assert.deepEqual(sceneRunMessage(scene, { status: 'FAILED', resultDetail: [offline('a'), offline('b')] }),
    { kind: 'error', text: 'Không chạy được "Đi ngủ": Đèn bếp, Quạt đang ngoại tuyến' });
  assert.deepEqual(sceneRunMessage(scene, { status: 'PARTIAL', resultDetail: [ok('a'), offline('b')] }),
    { kind: 'warning', text: '"Đi ngủ" chạy được 1/2 thiết bị. Quạt đang ngoại tuyến' });
  assert.equal(sceneRunMessage(scene, { status: 'FAILED', resultDetail: [] }).kind, 'error');
});
