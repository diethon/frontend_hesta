import { initialDevices } from './data.ts'
import type { Device } from './data.ts'

export type DevicePatch = Partial<Pick<Device, 'on' | 'brightness' | 'warmth' | 'temperature' | 'mode' | 'speed'>>
export type DeviceAction = { type: 'update'; id: string; patch: DevicePatch } | { type: 'reset' }
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

// A deliberately local simulation: no persistence, transport, or production imports.
export function deviceReducer(state: Device[], action: DeviceAction): Device[] {
  if (action.type === 'reset') return initialDevices.map(device => ({ ...device }))
  return state.map(device => {
    if (device.id !== action.id || !device.online || device.kind === 'temperature' || device.kind === 'motion') return device
    const patch = action.patch
    if (device.kind === 'light') return {
      ...device,
      on: patch.on ?? device.on,
      brightness: patch.brightness === undefined ? device.brightness : clamp(patch.brightness, 0, 100),
      warmth: patch.warmth ?? device.warmth,
    }
    if (device.kind === 'ac') return {
      ...device,
      on: patch.on ?? device.on,
      temperature: patch.temperature === undefined ? device.temperature : clamp(patch.temperature, 16, 30),
      mode: patch.mode ?? device.mode,
    }
    if (device.kind === 'fan') return {
      ...device,
      on: patch.on ?? device.on,
      speed: patch.speed === undefined ? device.speed : Math.round(clamp(patch.speed, 1, 3)),
    }
    return { ...device, on: patch.on ?? device.on }
  })
}
