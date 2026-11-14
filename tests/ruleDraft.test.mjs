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
