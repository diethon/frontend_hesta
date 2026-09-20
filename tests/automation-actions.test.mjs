// Run with: node --experimental-strip-types --test tests/automation-actions.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildActionInput, getDeviceActions } from '../src/components/automation/automationActions.ts';

const device = (deviceType, capabilities = []) => ({
  id: `${deviceType.toLowerCase()}-1`,
  homeId: 'home-1',
  name: deviceType,
  deviceType,
  status: 'ONLINE',
  capabilities,
});

test('light and AC expose only their default actions when capabilities are empty', () => {
  assert.deepEqual(getDeviceActions(device('LIGHT')).map((action) => action.code),
    ['TURN_ON', 'TURN_OFF', 'SET_BRIGHTNESS']);
  assert.deepEqual(getDeviceActions(device('AC')).map((action) => action.code),
    ['TURN_ON', 'TURN_OFF', 'SET_TEMPERATURE']);
});

test('declared capabilities override defaults and unsupported devices have no actions', () => {
  assert.deepEqual(getDeviceActions(device('LIGHT', ['turn_on'])).map((action) => action.code), ['TURN_ON']);
  assert.deepEqual(getDeviceActions(device('SENSOR')).map((action) => action.code), []);
  assert.deepEqual(getDeviceActions(device('LIGHT', ['temperature'])).map((action) => action.code), []);
});

test('simple, brightness, and temperature actions send backend parameter keys', () => {
  const light = device('LIGHT');
  const ac = device('AC');
  assert.deepEqual(buildActionInput({ deviceId: light.id, action: 'TURN_ON', value: '' }, 0, [light]),
    { deviceId: light.id, action: 'TURN_ON', parameters: {}, order: 0 });
  assert.deepEqual(buildActionInput({ deviceId: light.id, action: 'SET_BRIGHTNESS', value: '80' }, 1, [light]),
    { deviceId: light.id, action: 'SET_BRIGHTNESS', parameters: { level: 80 }, order: 1 });
  assert.deepEqual(buildActionInput({ deviceId: ac.id, action: 'SET_TEMPERATURE', value: '25.5' }, 2, [ac]),
    { deviceId: ac.id, action: 'SET_TEMPERATURE', parameters: { temperature: 25.5 }, order: 2 });
});

test('invalid action or value is rejected before API submission', () => {
  const light = device('LIGHT');
  assert.throws(() => buildActionInput({ deviceId: light.id, action: 'SET_TEMPERATURE', value: '26' }, 0, [light]));
  assert.throws(() => buildActionInput({ deviceId: light.id, action: 'SET_BRIGHTNESS', value: '101' }, 0, [light]));
  assert.throws(() => buildActionInput({ deviceId: light.id, action: 'SET_BRIGHTNESS', value: '' }, 0, [light]));
  const advanced = device('LIGHT', ['SET_STATE']);
  assert.throws(() => buildActionInput({ deviceId: advanced.id, action: 'SET_STATE', value: '{bad}' }, 0, [advanced]));
});
