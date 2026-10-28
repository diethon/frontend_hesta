import { useId, useState } from 'react';
import { Building2, ChevronRight, House, Layers3, Search } from 'lucide-react';
import { useAppSelector } from '../../../store/hooks';
import type { TwinRoom } from '../../../store/twinSlice';
import type { TwinLayoutGeometry, TwinLayoutSelection } from '../../../types/twinLayout';
import { RoomGlyph } from '../TwinVisualIcon';
import { roomFloorLevel } from '../twin3dGeometry';

interface TwinHouseExplorerProps {
  geometry: TwinLayoutGeometry;
  selection: TwinLayoutSelection | null;
  activeFloor: number | 'all';
  onFloorChange: (floor: number | 'all') => void;
  onFocus: (selection: TwinLayoutSelection) => void;
  onSelect: (selection: TwinLayoutSelection) => void;
}

function ExplorerRoom({ room, selected, onFocus, onSelect }: { room: TwinRoom; selected: boolean; onFocus: TwinHouseExplorerProps['onFocus']; onSelect: TwinHouseExplorerProps['onSelect'] }) {
  return <button type="button" aria-label={`Xem phòng ${room.name}`} aria-pressed={selected} onClick={() => onSelect({ kind: 'room', id: room.roomId })} onDoubleClick={() => onFocus({ kind: 'room', id: room.roomId })} className={`flex min-h-12 w-full items-center gap-2 rounded-xl border px-2 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary ${selected ? 'border-primary bg-info-soft' : 'border-transparent hover:bg-sidebar-hover'}`}>
    <RoomGlyph name={room.name} size={17} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-text">{room.name}</span><span className="mt-1 block text-xs text-muted">{room.deviceIds.length} thiết bị</span></span>{selected ? <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /> : null}
  </button>;
}

export function TwinHouseExplorer({ geometry, selection, activeFloor, onFloorChange, onFocus, onSelect }: TwinHouseExplorerProps) {
  const [query, setQuery] = useState('');
  const searchId = useId();
  const matches = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLocaleLowerCase('vi').includes(query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').trim().toLocaleLowerCase('vi'));
  const home = useAppSelector((state) => state.twin.home);
  const roomsById = useAppSelector((state) => state.twin.roomsById);
  const deviceCount = useAppSelector((state) => state.twin.deviceIds.length);
  const selectedNodeRoomId = useAppSelector((state) => {
    if (selection?.kind !== 'node') return null;
    return selection.id.startsWith('DEVICE:') ? state.twin.devicesById[selection.id.slice(7)]?.roomId : selection.id.startsWith('SENSOR:') ? state.twin.sensorsById[selection.id.slice(7)]?.roomId : null;
  });
  const selectedRoomId = selection?.kind === 'room' ? selection.id : selectedNodeRoomId;
  const floors = [...new Set(geometry.rooms.map(roomFloorLevel))].sort((a, b) => a - b);
  const placedIds = new Set(geometry.rooms.map((room) => room.roomId));
  const unplaced = Object.values(roomsById).filter((room) => !placedIds.has(room.roomId));

  return <nav aria-label="Khám phá ngôi nhà" className="twin-house-explorer min-w-0 bg-surface">
    <header className="border-b border-line p-4"><div className="flex items-center gap-3"><span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success"><House size={22} strokeWidth={1.7} aria-hidden="true" /></span><div className="min-w-0"><h2 className="text-sm font-semibold text-text">Sơ đồ nhà</h2><p className="mt-1 truncate text-xs text-muted" title={home?.name}>{home?.name ?? 'Ngôi nhà của bạn'}</p></div></div><p className="mt-3 text-xs text-muted">{floors.length} tầng · {Object.keys(roomsById).length} phòng · {deviceCount} thiết bị</p></header>
    {Object.keys(roomsById).length > 4 ? <div className="px-3 pt-3"><label htmlFor={searchId} className="sr-only">Tìm phòng</label><div className="flex items-center gap-2 rounded-xl border border-line bg-app px-3"><Search size={15} className="shrink-0 text-icon" aria-hidden="true" /><input id={searchId} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm phòng…" className="min-h-11 w-full min-w-0 bg-transparent text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-primary" /></div></div> : null}
    <div className="space-y-4 p-3"><button type="button" aria-pressed={activeFloor === 'all'} onClick={() => onFloorChange('all')} className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary ${activeFloor === 'all' ? 'border-primary bg-info-soft text-primary-hover' : 'border-line bg-surface text-text hover:bg-app'}`}><Layers3 size={18} aria-hidden="true" />Cả ngôi nhà</button>
      <p className="px-2 text-xs font-semibold uppercase tracking-wider text-muted">Tầng & phòng</p>
      {floors.map((floor) => {
        const rooms = geometry.rooms.filter((layout) => roomFloorLevel(layout) === floor).map((layout) => roomsById[layout.roomId]).filter((room) => room !== undefined && matches(room.name));
        const expanded = !!query.trim() || activeFloor === 'all' || activeFloor === floor;
        if (query.trim() && !rooms.length) return null;
        return <section key={floor} className="space-y-1"><button type="button" aria-label={`Xem tầng ${floor}`} aria-pressed={activeFloor === floor} onClick={() => onFloorChange(floor)} className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary ${activeFloor === floor ? 'bg-info-soft text-primary-hover' : 'text-text hover:bg-app'}`}><Building2 size={17} aria-hidden="true" /><span className="flex-1">Tầng {floor}</span><span className="text-xs font-medium text-muted">{rooms.length}</span><ChevronRight size={14} className={expanded ? 'rotate-90 text-icon' : 'text-icon'} aria-hidden="true" /></button>{expanded ? <div className="space-y-1 border-l border-line pl-2">{rooms.map((room) => <ExplorerRoom key={room.roomId} room={room} selected={selectedRoomId === room.roomId} onFocus={onFocus} onSelect={onSelect} />)}</div> : null}</section>;
      })}
      {unplaced.filter((room) => matches(room.name)).length ? <section className="space-y-2 border-t border-line pt-4"><h3 className="px-2 text-xs font-semibold uppercase tracking-wider text-muted">Chưa bố trí</h3>{unplaced.filter((room) => matches(room.name)).map((room) => <ExplorerRoom key={room.roomId} room={room} selected={selectedRoomId === room.roomId} onFocus={onSelect} onSelect={onSelect} />)}<p className="px-2 text-xs leading-5 text-muted">Các phòng này có trong HESTA nhưng chưa có vị trí trên sơ đồ.</p></section> : null}
      {query.trim() && !Object.values(roomsById).some((room) => matches(room.name)) ? <p role="status" className="rounded-xl bg-app p-3 text-xs text-muted">Không tìm thấy phòng phù hợp.</p> : null}
      {!Object.keys(roomsById).length ? <p className="rounded-xl bg-app p-3 text-xs leading-5 text-muted">Chưa có phòng trong ngôi nhà. Thêm phòng trong quản lý nhà để bắt đầu.</p> : null}
    </div>
  </nav>;
}
