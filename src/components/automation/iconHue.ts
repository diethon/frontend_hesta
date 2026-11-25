import type { CSSProperties } from 'react';
import type { IconName } from '../ui/LucideIcon';

// One colour per kind of icon, shared by the Scene and Automation pages. All ≥ 3:1 on white.
const ICON_HUES: Partial<Record<IconName, string>> = {
  // scene kinds
  sun: '#d17a0b',
  moon: '#6a55e0',
  home: '#2a9456',
  film: '#d9486e',
  briefcase: '#1769d6',
  energy: '#0d8f8a',
  coffee: '#b45309',
  sparkles: '#db2777',
  sofa: '#a16207',
  car: '#475569',
  book: '#4f46e5',
  shield: '#0f766e',
  leaf: '#16a34a',
  party: '#c026d3',
  plane: '#0284c7',
  bell: '#ca8a04',
  // device kinds
  lamp: '#d97706',
  snowflake: '#0891b2',
  door: '#7c5cff',
  lock: '#9333ea',
  camera: '#e11d74',
  droplet: '#2563eb',
  thermometer: '#ea580c',
  activity: '#059669',
  automation: '#0d9488',
  power: '#16a34a',
  grid: '#64748b',
  // rule triggers / steps
  zap: '#c026d3',
  clock: '#7c3aed',
};

/** Sets `--ic` for the icon inside; CSS falls back to the accent colour when unmapped. */
export function iconHue(icon: IconName): CSSProperties | undefined {
  const hue = ICON_HUES[icon];
  return hue ? ({ '--ic': hue } as CSSProperties) : undefined;
}
