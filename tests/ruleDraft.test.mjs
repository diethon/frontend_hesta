  import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

// ruleDraft.ts has only type imports, so it transpiles to a standalone module.
const source = readFileSync(new URL('../src/components/automation/ruleDraft.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
const module = { exports: {} };
new Function('module', 'exports', outputText)(module, module.exports);
const { validateRuleDraft } = module.exports;

const turnOn = [{ deviceId: 'd1', action: 'TURN_ON', parameters: {}, order: 0 }];

test('a SCHEDULE rule cannot be saved without an active time', () => {
  assert.equal(validateRuleDraft('Sáng', 'SCHEDULE', [], turnOn, 0), 'Thêm ít nhất 1 giờ chạy');
  assert.equal(validateRuleDraft('Sáng', 'SCHEDULE', [], turnOn), 'Thêm ít nhất 1 giờ chạy');
  assert.equal(validateRuleDraft('Sáng', 'SCHEDULE', [], turnOn, 1), null);
});

test('sensor rules do not need a time', () => {
  const condition = [{ deviceId: 's1', attribute: 'temperature', operator: 'GT', expectedValue: 30, logicalOperator: 'AND', order: 0 }];
  assert.equal(validateRuleDraft('Nóng', 'SENSOR', condition, turnOn), null);
});

test('group conditions and steps need a picked group; wait steps need a time and a real step next to them', () => {
  const groupCondition = [{ groupId: '', attribute: 'temperature', operator: 'GT', expectedValue: 30, logicalOperator: 'AND', order: 0 }];
  assert.equal(validateRuleDraft('Nóng', 'SENSOR', groupCondition, turnOn), 'Chọn thiết bị hoặc nhóm cho điều kiện');
  assert.equal(validateRuleDraft('Nóng', 'SENSOR', [{ ...groupCondition[0], groupId: 'g1' }], turnOn), null);

  const condition = [{ deviceId: 's1', attribute: 'temperature', operator: 'GT', expectedValue: 30, logicalOperator: 'AND', order: 0 }];
  const wait = (seconds) => ({ action: 'DELAY', parameters: { seconds }, order: 1 });
  assert.equal(validateRuleDraft('Nóng', 'SENSOR', condition, [{ ...wait(5), order: 0 }]), 'Thêm ít nhất 1 hành động ngoài bước chờ');
  assert.equal(validateRuleDraft('Nóng', 'SENSOR', condition, [...turnOn, wait(0)]), 'Chọn thiết bị, nhóm hoặc kịch bản cho hành động');
  assert.equal(validateRuleDraft('Nóng', 'SENSOR', condition, [...turnOn, wait(30)]), null);
  assert.equal(validateRuleDraft('Nóng', 'SENSOR', condition, [{ groupId: '', action: 'TURN_ON', parameters: {}, order: 0 }]),
    'Chọn thiết bị, nhóm hoặc kịch bản cho hành động');
});

test('durations read the same as on the app', () => {
  const timing = readFileSync(new URL('../src/components/automation/ruleTiming.ts', import.meta.url), 'utf8');
  const out = ts.transpileModule(timing, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const m = { exports: {} };
  new Function('module', 'exports', out)(m, m.exports);
  const { formatDuration, autoOffVerb } = m.exports;
  assert.equal(formatDuration(45), '45 giây');
  assert.equal(formatDuration(120), '2 phút');
  assert.equal(formatDuration(5400), '1 giờ 30 phút');
  assert.equal(autoOffVerb('TURN_ON'), 'Tự tắt');
  assert.equal(autoOffVerb('OPEN'), 'Tự đóng');
  assert.equal(autoOffVerb('TURN_OFF'), null);
});
