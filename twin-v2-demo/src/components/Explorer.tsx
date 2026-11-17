import { ChevronRight, House, Layers2, PanelLeftClose, PanelLeftOpen, Search, ShieldCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { floors } from '../data'
import type { Device, FloorId, Room, RoomId } from '../data'
import { roomIcons } from '../icons'
import { IconButton } from './UI'

export default function Explorer({ floor, rooms, onFloorChange, selectedRoom, devices, collapsed, onCollapse, onSelect }: {
  floor: FloorId; rooms: Room[]; onFloorChange: (id: FloorId) => void
  selectedRoom: RoomId; devices: Device[]; collapsed: boolean; onCollapse: () => void; onSelect: (id: RoomId) => void
}) {
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === '/' && !(event.target instanceof HTMLInputElement) && !document.querySelector('dialog[open]')) { event.preventDefault(); searchRef.current?.focus() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])
  const matching = rooms.filter(room => room.name.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(query.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '')))
  if (collapsed) return <aside className="explorer collapsed" aria-label="Phòng trong nhà">
    <IconButton icon={PanelLeftOpen} label="Mở danh sách phòng" onClick={onCollapse} />
    <div className="rail-divider" />
    {rooms.map(room => <IconButton key={room.id} icon={roomIcons[room.id]} label={room.name} active={room.id === selectedRoom} onClick={() => onSelect(room.id)} />)}
  </aside>
  return <aside className="explorer" aria-label="Khám phá ngôi nhà">
    <div className="panel-heading"><span>KHÔNG GIAN NHÀ</span><IconButton icon={PanelLeftClose} label="Thu gọn danh sách phòng" onClick={onCollapse} /></div>
    <div className="home-summary"><div className="home-symbol"><House size={23} strokeWidth={1.5} /></div><div><strong>Nhà của Việt Đức</strong><span>Thủ Đức, TP. Hồ Chí Minh</span></div></div>
    <label className="room-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Tìm kiếm phòng</span><input ref={searchRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm kiếm phòng..." /><kbd>/</kbd></label>
    <label className="floor-heading"><Layers2 size={16} /><span className="sr-only">Chọn tầng trong danh sách</span><select aria-label="Chọn tầng trong danh sách" value={floor} onChange={event => { setQuery(''); onFloorChange(event.target.value as FloorId) }}>{floors.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><span>6 khu vực</span></label>
    <nav className="room-list" aria-label="Danh sách phòng">
      {matching.map(room => {
        const Icon = roomIcons[room.id]
        const count = devices.filter(device => device.room === room.id).length
        return <button type="button" key={room.id} className={`room-row${selectedRoom === room.id ? ' selected' : ''}`} aria-label={room.name} title={room.name} aria-pressed={selectedRoom === room.id} onClick={() => onSelect(room.id)}>
          <span className="room-icon"><Icon size={20} strokeWidth={1.6} /></span><span className="room-copy"><strong>{room.name}</strong><small>{count} thiết bị <span>·</span> {room.area} m²</small></span><ChevronRight size={14} />
        </button>
      })}
      {!matching.length && <p className="empty-state">Không tìm thấy phòng.<button type="button" onClick={() => setQuery('')}>Xóa tìm kiếm</button></p>}
    </nav>
    <div className="explorer-bottom"><div className="house-health"><ShieldCheck size={19} /><div><strong>Ngôi nhà đang ổn</strong><span>{devices.filter(device => device.online).length}/10 thiết bị trực tuyến mô phỏng</span></div><span className="status-dot" /></div><p>3 tầng · 18 khu vực · 30 thiết bị</p></div>
  </aside>
}
