// Run with: node --experimental-strip-types --test tests/scene-actions.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSceneActionInput, formatSceneAction, getSceneDeviceActions, sceneActionsToDraft, sceneToggleInput } from '../src/components/scene/sceneActions.ts';

const device = (deviceType, capabilities = []) => ({
  id: `${deviceType.toLowerCase()}-1`,
  homeId: 'home-1',
  name: deviceType,
  deviceType,
  status: 'ONLINE',
  capabilities,
});

test('Scene offers localized actions for a light and an AC', () => {
  assert.deepEqual(getSceneDeviceActions(device('LIGHT')).map((option) => option.label),
    ['Bật', 'Tắt', 'Đặt độ sáng']);
  assert.deepEqual(getSceneDeviceActions(device('AC')).map((option) => option.code),
    ['TURN_ON', 'TURN_OFF', 'SET_TEMPERATURE']);
});

test('Scene uses device capabilities but excludes commands unsupported by Scene', () => {
  assert.deepEqual(getSceneDeviceActions(device('LIGHT', ['TURN_ON'])).map((option) => option.code), ['TURN_ON']);
  assert.deepEqual(getSceneDeviceActions(device('SOCKET', ['TOGGLE'])), []);
});

test('Scene sends null for no-value actions and typed values for light and AC', () => {
  const light = device('LIGHT');
  const ac = device('AC');
  assert.deepEqual(buildSceneActionInput({ deviceId: light.id, action: 'TURN_ON', value: '' }, 0, [light]),
    { targetDeviceId: light.id, action: 'TURN_ON', value: null, order: 0 });
  assert.deepEqual(buildSceneActionInput({ deviceId: light.id, action: 'SET_BRIGHTNESS', value: '80' }, 1, [light]),
    { targetDeviceId: light.id, action: 'SET_BRIGHTNESS', value: 80, order: 1 });
  assert.deepEqual(buildSceneActionInput({ deviceId: ac.id, action: 'SET_TEMPERATURE', value: '25.5' }, 2, [ac]),
    { targetDeviceId: ac.id, action: 'SET_TEMPERATURE', value: 25.5, order: 2 });
});

test('Scene rejects mismatched devices and malformed values before API submission', () => {
  const light = device('LIGHT');
  assert.throws(() => buildSceneActionInput({ deviceId: light.id, action: 'SET_TEMPERATURE', value: '26' }, 0, [light]));
  assert.throws(() => buildSceneActionInput({ deviceId: light.id, action: 'SET_BRIGHTNESS', value: '80.5' }, 0, [light]));
  assert.throws(() => buildSceneActionInput({ deviceId: light.id, action: 'SET_BRIGHTNESS', value: '101' }, 0, [light]));
  const advanced = device('LIGHT', ['SET_STATE']);
  assert.throws(() => buildSceneActionInput({ deviceId: advanced.id, action: 'SET_STATE', value: '{bad}' }, 0, [advanced]));
  assert.throws(() => buildSceneActionInput({ deviceId: advanced.id, action: 'SET_STATE', value: '{}' }, 0, [advanced]));
});

test('Scene list presents commands in Vietnamese', () => {
  assert.equal(formatSceneAction({ action: 'SET_BRIGHTNESS', value: 75 }), 'Đặt độ sáng: 75%');
});

test('Scene editor restores actions in order with editable values', () => {
  assert.deepEqual(sceneActionsToDraft([
    { targetDeviceId: 'ac-1', action: 'SET_TEMPERATURE', value: 25.5, order: 1 },
    { targetDeviceId: 'light-1', action: 'TURN_ON', value: null, order: 0 },
  ]), [
    { deviceId: 'light-1', action: 'TURN_ON', value: '' },
    { deviceId: 'ac-1', action: 'SET_TEMPERATURE', value: '25.5' },
  ]);
});

test('Scene toggle changes only enabled and leaves stored actions untouched', () => {
  const scene = { name: 'Morning', description: 'Start the day', enabled: true, actions: [{ id: 'action-1' }] };
  assert.deepEqual(sceneToggleInput(scene), { name: 'Morning', description: 'Start the day', enabled: false });
  assert.deepEqual(scene.actions, [{ id: 'action-1' }]);
});
