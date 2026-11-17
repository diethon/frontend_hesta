import type { LucideIcon } from 'lucide-react';
import { Activity, AirVent, AppWindow, Armchair, Bath, BedDouble, Blinds, Cctv, Cloud, CookingPot, Cpu, DoorClosed, Droplets, Fan, Flame, House, LampCeiling, LampDesk, LampFloor, LampWallUp, Leaf, Lightbulb, Monitor, Car, Plug, Radio, Siren, Sun, Thermometer, Tv, Warehouse, Wind } from 'lucide-react';
import type { TwinDeviceSnapshotResponse } from '../../types/twin';
import { resolveDeviceAppearance, type DeviceModelKind } from './devices/deviceAppearance';
import { sensorVisualKind } from './twinPresentation';

// Colour groups so a glance tells lights, climate, openings, security and appliances apart.
const tones = {
  light: 'bg-warning-soft text-warning',
  climate: 'bg-info-soft text-primary-hover',
  opening: 'bg-off-soft text-text',
  security: 'bg-error-soft text-error',
  appliance: 'bg-success-soft text-success',
};
const deviceIcons: Record<DeviceModelKind, [LucideIcon, keyof typeof tones]> = {
  'ceiling-light': [LampCeiling, 'light'], 'pendant-light': [LampCeiling, 'light'], 'floor-lamp': [LampFloor, 'light'],
  'table-lamp': [LampDesk, 'light'], 'wall-light': [LampWallUp, 'light'], 'led-strip': [Lightbulb, 'light'],
  'ceiling-fan': [Fan, 'climate'], 'standing-fan': [Fan, 'climate'], ac: [AirVent, 'climate'],
  door: [DoorClosed, 'opening'], 'roller-door': [Warehouse, 'opening'], window: [AppWindow, 'opening'], curtain: [Blinds, 'opening'],
  camera: [Cctv, 'security'], 'motion-sensor': [Activity, 'security'], 'smoke-sensor': [Siren, 'security'],
  'climate-sensor': [Thermometer, 'climate'], tv: [Tv, 'appliance'], plug: [Plug, 'appliance'], remote: [Radio, 'appliance'], generic: [Cpu, 'appliance'],
};
const sensorIcons: Record<ReturnType<typeof sensorVisualKind>, [LucideIcon, string]> = {
  temperature: [Thermometer, 'bg-error-soft text-error'], humidity: [Droplets, 'bg-info-soft text-primary-hover'],
  light: [Sun, 'bg-warning-soft text-warning'], motion: [Activity, 'bg-error-soft text-error'],
  air: [Wind, 'bg-success-soft text-success'], gas: [Cloud, 'bg-off-soft text-text'], smoke: [Flame, 'bg-error-soft text-error'],
  generic: [Radio, 'bg-off-soft text-text'],
};

const roomIcons: Array<[string, LucideIcon]> = [
  ['garage', Car], ['gara', Car], ['nhà xe', Car], ['garden', Leaf], ['vườn', Leaf], ['ban công', Leaf],
  ['living', Armchair], ['khách', Armchair], ['bed', BedDouble], ['ngủ', BedDouble], ['kitchen', CookingPot], ['bếp', CookingPot], ['bath', Bath], ['tắm', Bath], ['vệ sinh', Bath], ['office', Monitor], ['study', Monitor], ['làm việc', Monitor],
];

export function RoomGlyph({ name, size = 20 }: { name: string; size?: number }) {
  const normalized = name.toLowerCase();
  const Icon = roomIcons.find(([key]) => normalized.includes(key))?.[1] ?? House;
  return <span aria-hidden="true" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-info-soft text-primary-hover"><Icon size={size} strokeWidth={1.8} /></span>;
}

/** Icon from type and name together, the same inference the 3D models use (e.g. an IR bridge named "Điều hòa" shows an AC). */
export function DeviceGlyph({ deviceType, name = '', size = 19 }: { deviceType: TwinDeviceSnapshotResponse['deviceType']; name?: string; size?: number }) {
  const [Icon, tone] = deviceIcons[resolveDeviceAppearance(deviceType, name).kind];
  return <span aria-hidden="true" className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}><Icon size={size} strokeWidth={2} /></span>;
}

/** Sensors are round so they never read as a device. */
export function SensorGlyph({ metricType, size = 19 }: { metricType: string; size?: number }) {
  const [Icon, tone] = sensorIcons[sensorVisualKind(metricType)];
  return <span aria-hidden="true" className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone}`}><Icon size={size} strokeWidth={2} /></span>;
}
