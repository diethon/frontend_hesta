import { House } from 'lucide-react';
import type { TwinLayoutGeometry } from '../../types/twinLayout';
import { roomFloorLevel, roomToWorldWithDrafting } from './twin3dGeometry';
import { roomDrafting, type TwinDraftingMetadata } from './twinDrafting';

/** Geometry previews use existing HESTA room polygons, never demo thumbnails. */
export function TwinFloorNavigation({ geometry, drafting, value, onChange }: { geometry: TwinLayoutGeometry; drafting: TwinDraftingMetadata; value: number | 'all'; onChange: (level: number | 'all') => void }) {
  const levels = [...new Set(geometry.rooms.map(roomFloorLevel))].sort((a, b) => b - a);
  return <nav aria-label="Chọn tầng trong mô hình 3D" className="flex max-h-full w-24 flex-col gap-2 overflow-y-auto rounded-2xl border border-line bg-surface/90 p-2 shadow-soft">
    <button type="button" data-value="all" aria-pressed={value === 'all'} onClick={() => onChange('all')} className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold ${value === 'all' ? 'bg-info-soft text-primary-hover' : 'text-muted hover:bg-sidebar-hover'}`}><House size={17} aria-hidden="true" />Toàn bộ nhà</button>
    {levels.map((level) => {
      const rooms = geometry.rooms.filter((room) => roomFloorLevel(room) === level).map((room) => roomToWorldWithDrafting(room, roomDrafting(drafting, room.roomId)));
      const points = rooms.flatMap((room) => room.outline.map((p) => [p.x + room.x, p.z + room.z]));
      const x0 = Math.min(...points.map((p) => p[0])) - .3, z0 = Math.min(...points.map((p) => p[1])) - .3;
      const width = Math.max(...points.map((p) => p[0])) - x0 + .3, depth = Math.max(...points.map((p) => p[1])) - z0 + .3;
      return <button key={level} type="button" data-value={level} aria-pressed={value === level} onClick={() => onChange(level)} className={`rounded-xl border p-1 text-[10px] font-semibold ${value === level ? 'border-primary bg-info-soft text-primary-hover' : 'border-line bg-app text-muted hover:bg-sidebar-hover'}`}><svg aria-hidden="true" viewBox={`${x0} ${z0} ${width} ${depth}`} className="h-12 w-full"><g fill="currentColor" fillOpacity={.12} stroke="currentColor" strokeWidth={.1}>{rooms.map((room) => <polygon key={room.roomId} points={room.outline.map((p) => `${p.x + room.x},${p.z + room.z}`).join(' ')} />)}</g></svg>Tầng {level}</button>;
    })}
  </nav>;
}
