import { ChevronRight, CircleHelp, Droplets, Lightbulb, Minus, PanelRightClose, PanelRightOpen, Plus, Snowflake, Sun, Thermometer, Wind, Zap } from 'lucide-react'
import type { Device, Room } from '../data'
import type { DevicePatch } from '../mockState'
import { deviceIcons, roomIcons } from '../icons'
import { IconButton, Toggle } from './UI'

export default function DevicePanel({ floorName, room, devices, selectedDevice, collapsed, onCollapse, onSelect, onUpdate }: {
  floorName: string; room: Room; devices: Device[]; selectedDevice: string; collapsed: boolean; onCollapse: () => void
  onSelect: (id: string) => void; onUpdate: (id: string, patch: DevicePatch) => void
}) {
  const roomDevices = devices.filter(device => device.room === room.id)
  const device = roomDevices.find(item => item.id === selectedDevice) ?? roomDevices[0]
  const RoomIcon = roomIcons[room.id]
  if (collapsed) return <aside className="device-panel collapsed" aria-label="Điều khiển thiết bị đã thu gọn"><IconButton icon={PanelRightOpen} label="Mở điều khiển thiết bị" onClick={onCollapse} /><RoomIcon size={21} /><span className="vertical-label">ĐIỀU KHIỂN THIẾT BỊ</span></aside>
  return <aside className="device-panel" aria-label="Điều khiển thiết bị">
    <div className="panel-heading"><span>ĐIỀU KHIỂN THÔNG MINH</span><IconButton icon={PanelRightClose} label="Thu gọn điều khiển thiết bị" onClick={onCollapse} /></div>
    <div className="selected-room"><span className="selected-room-icon"><RoomIcon size={24} strokeWidth={1.5} /></span><div><h2>{room.name}</h2><p>{room.area} m² <span>·</span> {roomDevices.length} thiết bị</p></div><span className="room-status">{floorName}</span></div>
    <div className="room-climate"><span><Thermometer size={15} />{room.temperature}°C</span><span><Droplets size={15} />{room.humidity}%</span><span className="climate-status"><span className="status-dot" />Thoải mái</span></div>
    <div className="device-list-heading"><strong>Thiết bị trong phòng</strong><span>{roomDevices.filter(item => item.online).length} trực tuyến</span></div>
    <div className="device-list">{roomDevices.map(item => {
      const Icon = deviceIcons[item.kind]
      return <button type="button" key={item.id} className={`device-row${item.id === device?.id ? ' selected' : ''}`} onClick={() => onSelect(item.id)} aria-pressed={item.id === device?.id}>
        <span className={`device-icon${item.on && item.online ? ' on' : ''}`}><Icon size={18} strokeWidth={1.6} /></span><span><strong>{item.name}</strong><small>{!item.online ? 'Ngoại tuyến mô phỏng' : item.kind === 'temperature' ? `${room.temperature}°C · Đang ghi nhận` : item.on ? 'Đang bật' : 'Đang tắt'}</small></span><span className={`device-dot${item.on && item.online ? ' on' : ''}`} /><ChevronRight size={13} />
      </button>
    })}</div>
    {device && <DeviceControl key={device.id} device={device} room={room} onUpdate={patch => onUpdate(device.id, patch)} />}
    <div className="simulation-note"><CircleHelp size={15} /><span>Điều khiển thử, phản hồi tức thì.<br />Mọi thay đổi chỉ nằm trong bản demo.</span></div>
  </aside>
}

function DeviceControl({ device, room, onUpdate }: { device: Device; room: Room; onUpdate: (patch: DevicePatch) => void }) {
  const Icon = deviceIcons[device.kind]
  const isSensor = device.kind === 'temperature' || device.kind === 'motion'
  const disabled = !device.online || !device.on
  return <section className="device-control" aria-label={`Điều khiển ${device.name}`}>
    <div className="control-title"><span><Icon size={17} />{device.name}</span>{!isSensor && <Toggle on={device.on} label={`Bật/tắt ${device.name}`} disabled={!device.online} onChange={() => onUpdate({ on: !device.on })} />}</div>
    {!device.online ? <div className="offline-message"><Wind size={23} /><strong>Thiết bị đang ngoại tuyến</strong><p>Trạng thái này được mô phỏng để xem trước giao diện.</p></div> : device.kind === 'light' ? <>
      <div className="brightness-heading"><label htmlFor="brightness">Độ sáng</label><strong>{device.brightness}<small>%</small></strong></div>
      <div className="slider-row"><Sun size={15} /><input id="brightness" type="range" min={0} max={100} step={1} value={device.brightness} disabled={disabled} onChange={event => onUpdate({ brightness: Number(event.target.value) })} /><Sun size={20} /></div>
      <div className="preset-row">{[25, 50, 75, 100].map(value => <button type="button" key={value} disabled={disabled} aria-pressed={device.brightness === value} className={device.brightness === value ? 'selected' : ''} onClick={() => onUpdate({ brightness: value })}>{value}%</button>)}</div>
      <span className="field-label">Nhiệt độ màu</span><div className="warmth-row">{([{ value: 'warm', label: 'Ấm', kelvin: '2700K' }, { value: 'neutral', label: 'Tự nhiên', kelvin: '4000K' }, { value: 'cool', label: 'Trắng', kelvin: '6500K' }] as const).map(preset => <button type="button" key={preset.value} disabled={disabled} className={device.warmth === preset.value ? 'selected' : ''} aria-pressed={device.warmth === preset.value} onClick={() => onUpdate({ warmth: preset.value })}><span className={`temperature-swatch ${preset.value}`} /><strong>{preset.label}</strong><small>{preset.kelvin}</small></button>)}</div>
      <div className="power-note"><Zap size={13} /><span>{device.on ? `${Math.round((device.brightness ?? 0) * .12)} W · Công suất mô phỏng` : 'Đèn đang tắt'}</span><Lightbulb size={13} /></div>
    </> : device.kind === 'ac' ? <>
      <p className="field-label">Nhiệt độ cài đặt</p><div className="thermostat"><IconButton icon={Minus} label="Giảm nhiệt độ" disabled={disabled || device.temperature === 16} onClick={() => onUpdate({ temperature: (device.temperature ?? 24) - 1 })} /><strong>{device.temperature}<small>°C</small></strong><IconButton icon={Plus} label="Tăng nhiệt độ" disabled={disabled || device.temperature === 30} onClick={() => onUpdate({ temperature: (device.temperature ?? 24) + 1 })} /></div>
      <span className="field-label">Chế độ hoạt động</span><div className="mode-row">{([{ value: 'cool', label: 'Làm lạnh', icon: Snowflake }, { value: 'auto', label: 'Tự động', icon: Wind }, { value: 'dry', label: 'Hút ẩm', icon: Droplets }] as const).map(mode => <button type="button" key={mode.value} disabled={disabled} className={device.mode === mode.value ? 'selected' : ''} aria-pressed={device.mode === mode.value} onClick={() => onUpdate({ mode: mode.value })}><mode.icon size={17} />{mode.label}</button>)}</div>
    </> : device.kind === 'fan' ? <>
      <p className="field-label">Tốc độ quạt</p><div className="fan-speed">{[1, 2, 3].map((speed, i) => <button type="button" key={speed} disabled={disabled} className={device.speed === speed ? 'selected' : ''} aria-pressed={device.speed === speed} onClick={() => onUpdate({ speed })}><Wind size={20 + i * 3} /><strong>{['Êm dịu', 'Vừa', 'Mạnh'][i]}</strong><small>Cấp {speed}</small></button>)}</div><p className="helper-copy">Bật quạt để xem cánh quạt chuyển động trong mô hình 3D.</p>
    </> : isSensor ? <div className="sensor-reading"><Icon size={26} /><strong>{device.kind === 'temperature' ? `${room.temperature}°C` : 'Chưa phát hiện'}</strong><p>Dữ liệu cảm biến được mô phỏng.</p></div> : <p className="helper-copy">Bật/tắt thiết bị để xem trạng thái mô phỏng.</p>}
  </section>
}
