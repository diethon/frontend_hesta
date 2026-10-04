import { roomKind } from './roomKind';

// Decorative top-down furniture; never represents another controllable device.
export function RoomFurnishing({ name }: { name: string }) {
  const kind = roomKind(name);
  return <svg aria-hidden="true" viewBox="0 0 200 140" className="twin-furnishing pointer-events-none absolute bottom-3 left-1/2 w-2/5 -translate-x-1/2 text-icon opacity-65" fill="currentColor" stroke="currentColor" strokeWidth="2">
    {kind === 'living' ? <><rect x="12" y="36" width="176" height="92" rx="18" opacity=".15" /><rect x="29" y="27" width="142" height="64" rx="12" opacity=".6" /><rect x="36" y="40" width="62" height="40" rx="6" /><rect x="102" y="40" width="62" height="40" rx="6" /><rect x="20" y="62" width="20" height="42" rx="6" /><rect x="160" y="62" width="20" height="42" rx="6" /><rect x="40" y="85" width="120" height="20" rx="5" /><path d="M35 106v8m130-8v8" /></>
      : kind === 'bedroom' ? <><rect x="44" y="5" width="112" height="128" rx="12" opacity=".25" /><rect x="51" y="12" width="98" height="116" rx="8" fill="var(--color-surface)" /><rect x="58" y="20" width="38" height="26" rx="5" opacity=".6" /><rect x="104" y="20" width="38" height="26" rx="5" opacity=".6" /><rect x="54" y="54" width="92" height="68" rx="6" opacity=".4" /><path d="M54 68h92" /></>
        : kind === 'kitchen' ? <><rect x="50" y="15" width="36" height="28" rx="8" opacity=".6" /><rect x="114" y="15" width="36" height="28" rx="8" opacity=".6" /><rect x="50" y="100" width="36" height="28" rx="8" opacity=".6" /><rect x="114" y="100" width="36" height="28" rx="8" opacity=".6" /><rect x="30" y="39" width="140" height="66" rx="12" opacity=".3" /><rect x="36" y="44" width="128" height="54" rx="9" opacity=".5" /></>
          : kind === 'bathroom' ? <><rect x="15" y="20" width="170" height="110" rx="18" opacity=".12" /><rect x="29" y="35" width="142" height="78" rx="35" fill="var(--color-surface)" /><rect x="38" y="44" width="124" height="58" rx="27" opacity=".25" /><path d="M153 41V24h-12" fill="none" strokeWidth="6" /></> : <rect x="45" y="40" width="110" height="70" rx="16" opacity=".15" />}
  </svg>;
}
