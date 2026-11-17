import { Armchair, Bath, BedDouble, BriefcaseBusiness, CookingPot, Fan, Lightbulb, Radar, Thermometer, Trees, Tv, Wind } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { DeviceKind, RoomId } from './data'

export const roomIcons: Record<RoomId, LucideIcon> = {
  living: Armchair, bedroom: BedDouble, kitchen: CookingPot, bathroom: Bath, office: BriefcaseBusiness, garden: Trees,
}
export const deviceIcons: Record<DeviceKind, LucideIcon> = {
  light: Lightbulb, ac: Wind, fan: Fan, tv: Tv, temperature: Thermometer, motion: Radar,
}
