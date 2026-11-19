import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/components/twin/scene/markerClustering.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const module = { exports: {} };
new Function('exports', 'module', compiled)(module.exports, module);
const { markerStatus, isMarkerCandidate, shouldClusterRoom, isFreshMotionEvent } = module.exports;

test('marker status prioritizes backend health and command failures over cached power', () => {
  assert.equal(markerStatus('ACTIVE', true), 'on');
  assert.equal(markerStatus('ACTIVE', false), 'off');
  assert.equal(markerStatus('ACTIVE', null), 'online');
  assert.equal(markerStatus('OFFLINE', true), 'offline');
  assert.equal(markerStatus('STALE', true), 'warning');
  assert.equal(markerStatus('ACTIVE', true, true), 'pending');
  assert.equal(markerStatus('OFFLINE', true, false, true), 'error');
});

test('important mode keeps architecture clean and selected markers never join a cluster', () => {
  assert.equal(isMarkerCandidate('important', 'on', false), false);
  assert.equal(isMarkerCandidate('important', 'offline', false), true);
  assert.equal(isMarkerCandidate('all', 'off', false), true);
  assert.equal(isMarkerCandidate('all', 'error', true), false);
  assert.equal(isMarkerCandidate('none', 'error', false), false);
});

test('room clustering uses screen-space hysteresis so slight zoom does not flicker', () => {
  assert.equal(shouldClusterRoom(180, false), true);
  assert.equal(shouldClusterRoom(210, true), true);
  assert.equal(shouldClusterRoom(210, false), false);
  assert.equal(shouldClusterRoom(250, true), false);
  assert.equal(shouldClusterRoom(Number.NaN, true), false);
});

test('dense sensor rooms cluster before their important markers overlap in the overview', () => {
  assert.equal(shouldClusterRoom(300, false, 11), true);
  assert.equal(shouldClusterRoom(300, false, 2), false);
  assert.equal(shouldClusterRoom(400, true, 11), true);
  assert.equal(shouldClusterRoom(500, true, 11), false);
});

test('motion effects require a new and recent positive event instead of stale snapshots', () => {
  const now = Date.parse('2026-10-20T12:00:00Z');
  const latest = new Date(now - 1000).toISOString();
  assert.equal(isFreshMotionEvent('MOTION', 1, latest, null, now), true);
  assert.equal(isFreshMotionEvent('MOTION', 1, latest, latest, now), false);
  assert.equal(isFreshMotionEvent('MOTION', 0, latest, null, now), false);
  assert.equal(isFreshMotionEvent('MOTION', 2, latest, null, now), false);
  assert.equal(isFreshMotionEvent('TEMPERATURE', 26, latest, null, now), false);
  assert.equal(isFreshMotionEvent('MOTION', 1, new Date(now - 16000).toISOString(), null, now), false);
  assert.equal(isFreshMotionEvent('MOTION', 1, new Date(now + 10000).toISOString(), null, now), false);
});
