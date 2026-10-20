import { Building2, ChevronRight, House, Layers3 } from 'lucide-react';
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
}

function ExplorerRoom({ room, selected, onFocus }: { room: TwinRoom; selected: boolean; onFocus: TwinHouseExplorerProps['onFocus'] }) {
  return <button type="button" aria-label={`Xem phòng ${room.name}`} aria-pressed={selected} onClick={() => onFocus({ kind: 'room', id: room.roomId })} className={`flex min-h-16 w-full items-center gap-2 rounded-xl border px-2 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary ${selected ? 'border-primary bg-info-soft' : 'border-transparent hover:bg-sidebar-hover'}`}>
    <RoomGlyph name={room.name} size={17} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-text">{room.name}</span><span className="mt-1 block text-xs text-muted">{room.deviceIds.length} thiết bị</span></span>{selected ? <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /> : null}
  </button>;
}

export function TwinHouseExplorer({ geometry, selection, activeFloor, onFloorChange, onFocus }: TwinHouseExplorerProps) {
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
    <header className="border-b border-line p-5"><span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-info-soft text-primary-hover"><House size={23} strokeWidth={1.7} aria-hidden="true" /></span><p className="text-xs font-semibold uppercase tracking-wider text-muted">House overview</p><h2 className="mt-1 break-words text-xl font-semibold tracking-tight text-text">{home?.name ?? 'Ngôi nhà của bạn'}</h2><dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4">{[{ label: 'Tầng', value: floors.length }, { label: 'Phòng', value: Object.keys(roomsById).length }, { label: 'Thiết bị', value: deviceCount }].map(({ label, value }) => <div key={label} className="flex flex-col"><dt className="order-2 mt-1 text-xs text-muted">{label}</dt><dd className="order-1 text-xl font-semibold text-text">{value}</dd></div>)}</dl></header>
    <div className="space-y-4 p-3"><button type="button" aria-pressed={activeFloor === 'all'} onClick={() => onFloorChange('all')} className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary ${activeFloor === 'all' ? 'border-primary bg-info-soft text-primary-hover' : 'border-line bg-surface text-text hover:bg-app'}`}><Layers3 size={18} aria-hidden="true" />Cả ngôi nhà</button>
      <p className="px-2 text-xs font-semibold uppercase tracking-wider text-muted">Tầng & phòng</p>
      {floors.map((floor) => {
        const rooms = geometry.rooms.filter((layout) => roomFloorLevel(layout) === floor).map((layout) => roomsById[layout.roomId]).filter((room) => room !== undefined);
        const expanded = activeFloor === 'all' || activeFloor === floor;
        return <section key={floor} className="space-y-1"><button type="button" aria-label={`Xem tầng ${floor}`} aria-pressed={activeFloor === floor} aria-expanded={expanded} onClick={() => onFloorChange(floor)} className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary ${activeFloor === floor ? 'bg-info-soft text-primary-hover' : 'text-text hover:bg-app'}`}><Building2 size={17} aria-hidden="true" /><span className="flex-1">Tầng {floor}</span><span className="text-xs font-medium text-muted">{rooms.length}</span><ChevronRight size={14} className={expanded ? 'rotate-90 text-icon' : 'text-icon'} aria-hidden="true" /></button>{expanded ? <div className="space-y-1 border-l border-line pl-2">{rooms.map((room) => <ExplorerRoom key={room.roomId} room={room} selected={selectedRoomId === room.roomId} onFocus={onFocus} />)}</div> : null}</section>;
      })}
      {unplaced.length ? <section className="space-y-2 border-t border-line pt-4"><h3 className="px-2 text-xs font-semibold uppercase tracking-wider text-muted">Chưa bố trí</h3>{unplaced.map((room) => <ExplorerRoom key={room.roomId} room={room} selected={selectedRoomId === room.roomId} onFocus={onFocus} />)}<p className="px-2 text-xs leading-5 text-muted">Các phòng này có trong HESTA nhưng chưa có vị trí trên sơ đồ.</p></section> : null}
      {!Object.keys(roomsById).length ? <p className="rounded-xl bg-app p-3 text-xs leading-5 text-muted">Chưa có phòng trong ngôi nhà. Thêm phòng trong quản lý nhà để bắt đầu.</p> : null}
    </div>
  </nav>;
}
