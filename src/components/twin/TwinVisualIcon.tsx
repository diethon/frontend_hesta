import type { LucideIcon } from 'lucide-react';
import { Activity, Armchair, Bath, BedDouble, Camera, Cloud, CookingPot, Cpu, DoorClosed, Droplets, Fan, Flame, House, Lightbulb, Monitor, PlugZap, Radio, Snowflake, Sun, Thermometer, Wind } from 'lucide-react';
import type { TwinDeviceSnapshotResponse } from '../../types/twin';
import { deviceVisualKind, sensorVisualKind } from './twinPresentation';

const deviceIcons: Record<ReturnType<typeof deviceVisualKind>, LucideIcon> = {
  light: Lightbulb, plug: PlugZap, remote: Radio, sensor: Thermometer,
  motion: Activity, smoke: Flame, camera: Camera, ac: Snowflake, fan: Fan,
  lock: DoorClosed, microphone: Wind, generic: Cpu,
};
const sensorIcons: Record<ReturnType<typeof sensorVisualKind>, LucideIcon> = {
  temperature: Thermometer, humidity: Droplets, light: Sun, motion: Activity,
  air: Wind, gas: Cloud, smoke: Flame, generic: Radio,
};

const roomIcons: Array<[string, LucideIcon]> = [
  ['living', Armchair], ['khách', Armchair], ['bed', BedDouble], ['ngủ', BedDouble], ['kitchen', CookingPot], ['bếp', CookingPot], ['bath', Bath], ['tắm', Bath], ['vệ sinh', Bath], ['office', Monitor], ['study', Monitor], ['làm việc', Monitor],
];

const iconFrame = {
  room: 'bg-info-soft text-primary-hover',
  device: 'bg-success-soft text-success',
  sensor: 'bg-warning-soft text-warning',
};

export function RoomGlyph({ name, size = 20 }: { name: string; size?: number }) {
  const normalized = name.toLowerCase();
  const Icon = roomIcons.find(([key]) => normalized.includes(key))?.[1] ?? House;
  return <span aria-hidden="true" className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconFrame.room}`}><Icon size={size} strokeWidth={1.8} /></span>;
}

export function DeviceGlyph({ deviceType, size = 19 }: { deviceType: TwinDeviceSnapshotResponse['deviceType']; size?: number }) {
  const Icon = deviceIcons[deviceVisualKind(deviceType)];
  return <span aria-hidden="true" className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconFrame.device}`}><Icon size={size} strokeWidth={1.8} /></span>;
}

export function SensorGlyph({ metricType, size = 19 }: { metricType: string; size?: number }) {
  const Icon = sensorIcons[sensorVisualKind(metricType)];
  return <span aria-hidden="true" className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconFrame.sensor}`}><Icon size={size} strokeWidth={1.8} /></span>;
}
