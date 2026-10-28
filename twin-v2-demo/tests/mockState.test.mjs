import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { floors, initialDevices, roomsByFloor } from '../src/data.ts'
import { deviceReducer } from '../src/mockState.ts'

test('three floors have unique device IDs and complete room references', () => {
  assert.equal(floors.length, 3)
  assert.equal(new Set(initialDevices.map(device => device.id)).size, 30)
  for (const floor of floors) {
    const rooms = roomsByFloor[floor.id]
    const devices = initialDevices.filter(device => device.floor === floor.id)
    assert.equal(rooms.length, 6)
    assert.equal(devices.length, 10)
    assert.equal(devices.filter(device => device.online).length, 7)
    assert.ok(devices.every(device => rooms.some(room => room.id === device.room)))
    assert.equal(rooms.reduce((area, room) => area + room.area, 0), 118)
  }
})

test('controls keep each floor independent and leave initial data immutable', () => {
  const original = structuredClone(initialDevices)
  const next = deviceReducer(initialDevices, { type: 'update', id: 'floor-2-living-light', patch: { on: false, brightness: 25 } })
  assert.equal(next.find(device => device.id === 'floor-2-living-light').on, false)
  assert.equal(next.find(device => device.id === 'floor-2-living-light').brightness, 25)
  assert.deepEqual(next.find(device => device.id === 'living-light'), original.find(device => device.id === 'living-light'))
  assert.deepEqual(next.find(device => device.id === 'floor-3-living-light'), original.find(device => device.id === 'floor-3-living-light'))
  assert.deepEqual(initialDevices, original)
})

test('offline devices and read-only sensors reject control updates', () => {
  for (const id of ['living-tv', 'living-sensor', 'bathroom-motion']) {
    const next = deviceReducer(initialDevices, { type: 'update', id, patch: { on: false, brightness: 5 } })
    assert.deepEqual(next.find(device => device.id === id), initialDevices.find(device => device.id === id))
  }
})

test('control bounds and device-specific fields remain valid', () => {
  const bright = deviceReducer(initialDevices, { type: 'update', id: 'living-light', patch: { brightness: 130, temperature: 28 } })
  assert.equal(bright.find(device => device.id === 'living-light').brightness, 100)
  assert.equal(bright.find(device => device.id === 'living-light').temperature, undefined)
  const cold = deviceReducer(initialDevices, { type: 'update', id: 'living-ac', patch: { temperature: 4 } })
  assert.equal(cold.find(device => device.id === 'living-ac').temperature, 16)
  const fast = deviceReducer(initialDevices, { type: 'update', id: 'living-fan', patch: { speed: 9 } })
  assert.equal(fast.find(device => device.id === 'living-fan').speed, 3)
})

test('reset restores all floor scenarios without shared mutable objects', () => {
  const changed = deviceReducer(initialDevices, { type: 'update', id: 'floor-3-living-ac', patch: { temperature: 29 } })
  const reset = deviceReducer(changed, { type: 'reset' })
  assert.deepEqual(reset, initialDevices)
  assert.notEqual(reset[0], initialDevices[0])
})

test('demo source has no backend transports or production source imports', async () => {
  const root = fileURLToPath(new URL('../src/', import.meta.url))
  const files = await readdir(root, { recursive: true })
  for (const file of files.filter(file => /\.(ts|tsx)$/.test(file))) {
    const source = await readFile(join(root, file), 'utf8')
    assert.doesNotMatch(source, /\b(?:fetch|WebSocket|XMLHttpRequest|EventSource)\s*\(/, file)
    assert.doesNotMatch(source, /(?:from\s*|import\s*\()['"](?:https?:|.*(?:services\/|store\/|backend_hesta|hesta_app))/, file)
  }
})
