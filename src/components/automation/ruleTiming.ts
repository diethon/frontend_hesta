// Same units and wording as the mobile app (rule_timing.dart).
export const DURATION_UNITS = [
  { label: 'giây', seconds: 1 },
  { label: 'phút', seconds: 60 },
  { label: 'giờ', seconds: 3600 },
];

/** "45 giây", "2 phút", "1 giờ 30 phút". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [h && `${h} giờ`, m && `${m} phút`, sec && `${sec} giây`].filter(Boolean);
  return parts.length ? parts.join(' ') : '0 giây';
}

/** Commands that can be undone automatically, and the word for undoing them. */
export function autoOffVerb(action: string, parameters?: Record<string, unknown>): string | null {
  if (['TURN_ON', 'POWER_ON'].includes(action)) return 'Tự tắt';
  if (action === 'SET_POWER' && parameters?.power !== false && parameters?.power !== 'OFF') return 'Tự tắt';
  if (action === 'OPEN' || action === 'GATE_OPEN') return 'Tự đóng';
  return null;
}

