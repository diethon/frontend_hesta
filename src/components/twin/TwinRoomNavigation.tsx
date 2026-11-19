import { useAppSelector } from '../../store/hooks';
import type { TwinLayoutGeometry, TwinLayoutSelection } from '../../types/twinLayout';
import { RoomGlyph } from './TwinVisualIcon';

export function TwinRoomNavigation({ rooms, selection, onSelect }: {
  rooms: TwinLayoutGeometry['rooms']; selection: TwinLayoutSelection | null;
  onSelect: (selection: TwinLayoutSelection) => void;
}) {
  const names = useAppSelector((state) => state.twin.roomsById);
  return <nav aria-label="Chọn không gian" className="surface-card p-3 sm:p-4">
    <div className="mb-3 flex items-center justify-between px-1"><h3 className="text-sm font-semibold text-text">Không gian</h3><span className="text-xs text-muted">Chọn phòng để xem gần</span></div>
    <div className="flex gap-2 overflow-x-auto pb-1">
      {rooms.map((room) => {
        const name = names[room.roomId]?.name ?? 'Phòng';
        const selected = selection?.kind === 'room' && selection.id === room.roomId;
        return <button key={room.roomId} type="button" aria-pressed={selected} onClick={() => onSelect({ kind: 'room', id: room.roomId })}
          className={`flex min-h-16 shrink-0 items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${selected ? 'border-primary bg-info-soft' : 'border-line bg-surface hover:bg-app'}`}>
          <RoomGlyph name={name} size={18} /><span><strong className="block text-xs font-semibold text-text">{name}</strong><span className="mt-1 block text-[11px] text-muted">Tầng {room.floor ?? 1}</span></span>
        </button>;
      })}
    </div>
  </nav>;
}
