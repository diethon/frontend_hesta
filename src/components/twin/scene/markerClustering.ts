import type { TwinHealthStatus } from '../../../types/twin';
import type { TwinMarkerMode } from './architectureMaterials';

export type MarkerStatus = 'on' | 'off' | 'online' | 'offline' | 'warning' | 'error' | 'pending';

export function markerStatus(health: TwinHealthStatus, powered: boolean | null = null, pending = false, error = false): MarkerStatus {
  if (error) return 'error';
  if (health === 'OFFLINE') return 'offline';
  if (health === 'STALE') return 'warning';
  if (pending) return 'pending';
  return powered === true ? 'on' : powered === false ? 'off' : 'online';
}

export function isImportantMarker(status: MarkerStatus) {
  return status === 'offline' || status === 'warning' || status === 'error' || status === 'pending';
}

export function isMarkerCandidate(mode: TwinMarkerMode, status: MarkerStatus, selected: boolean) {
  return !selected && mode !== 'none' && (mode === 'all' || isImportantMarker(status));
}

/** Screen-space hysteresis prevents marker flicker during small orbit/zoom changes. */
export function shouldClusterRoom(projectedPixels: number, clustered: boolean, markerCount = 1) {
  const density = Math.min(2.2, Math.max(1, Math.sqrt(markerCount / 3)));
  const threshold = (clustered ? 238 : 190) * density;
  return Number.isFinite(projectedPixels) && projectedPixels < threshold;
}

/** Motion effects require a newly received, fresh positive reading, never a cached snapshot. */
export function isFreshMotionEvent(metric: string, value: number | null, observedAt: string | null, previous: string | null, now: number) {
  if (!/^(MOTION|MOTION_DETECTED|PIR)$/i.test(metric) || value !== 1 || !observedAt || observedAt === previous) return false;
  const age = now - Date.parse(observedAt);
  return Number.isFinite(age) && age >= -2000 && age <= 15000;
}
