import { lazy, Suspense, useEffect, useReducer, useRef, useState } from 'react'
import { ArrowDownRight, ArrowLeft, Box, ChevronRight, Compass, Expand, Hand, House, Info, Layers2, Maximize, Moon, MousePointer2, MoveUpRight, Rotate3D, RotateCcw, Sun, X, ZoomIn, ZoomOut } from 'lucide-react'
import { floors, initialDevices, roomsByFloor } from './data'
import type { CameraCommand, FloorId, RoomId, ToolMode } from './data'
import { deviceReducer } from './mockState'
import type { DevicePatch } from './mockState'
import Explorer from './components/Explorer'
import DevicePanel from './components/DevicePanel'
import Analytics from './components/Analytics'
import SceneBoundary from './components/SceneBoundary'
import { IconButton } from './components/UI'

const HouseScene = lazy(() => import('./scene/HouseScene'))

export default function App() {
  const [devices, dispatch] = useReducer(deviceReducer, initialDevices)
  const [selectedRoom, setSelectedRoom] = useState<RoomId>('living')
  const [roomView, setRoomView] = useState(false)
  const [floor, setFloor] = useState<FloorId>('floor-1')
  const [selectedDevice, setSelectedDevice] = useState('living-light')
  const [night, setNight] = useState(false)
  const [tool, setTool] = useState<ToolMode>('select')
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [command, setCommand] = useState<CameraCommand>({ type: 'reset', nonce: 0 })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [status, setStatus] = useState('Chọn một phòng hoặc thiết bị để khám phá.')
  const stageRef = useRef<HTMLElement>(null)
  const helpRef = useRef<HTMLDialogElement>(null)
  const rooms = roomsByFloor[floor]
  const activeDevices = devices.filter(device => device.floor === floor)
  const room = rooms.find(item => item.id === selectedRoom)!
  const online = activeDevices.filter(device => device.online).length

  useEffect(() => {
    const onFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFullscreen)
    return () => document.removeEventListener('fullscreenchange', onFullscreen)
  }, [])

  useEffect(() => {
    if (!roomView) return
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('dialog[open]') || document.fullscreenElement) return
      setRoomView(false)
      setCommand(previous => ({ type: 'reset', nonce: previous.nonce + 1 }))
      setStatus('Đã quay lại toàn cảnh ngôi nhà.')
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [roomView])

  function camera(type: CameraCommand['type']) {
    if (type === 'reset') setRoomView(false)
    setCommand(previous => ({ type, nonce: previous.nonce + 1 }))
    if (type === 'reset') setStatus('Camera đã trở về toàn cảnh ngôi nhà.')
  }
  function selectRoom(id: RoomId) {
    setRoomView(true)
    setSelectedRoom(id)
    setSelectedDevice(activeDevices.find(device => device.room === id)?.id ?? '')
    camera('focus')
    setStatus(`Đang khám phá ${rooms.find(item => item.id === id)?.name.toLocaleLowerCase('vi')}.`)
  }
  function selectFloor(id: FloorId) {
    setFloor(id)
    setSelectedRoom('living')
    setSelectedDevice(devices.find(device => device.floor === id && device.room === 'living')?.id ?? '')
    camera('reset')
    setStatus(`Đã chuyển sang ${floors.find(item => item.id === id)?.name}. Trạng thái thiết bị riêng cho từng tầng.`)
  }
  function selectDevice(id: string) {
    const device = devices.find(item => item.id === id)
    if (!device) return
    if (device.room !== selectedRoom) {
      setRoomView(true)
      setSelectedRoom(device.room)
      camera('focus')
    }
    setSelectedDevice(id)
    setRightCollapsed(false)
    setStatus(`Đã chọn ${device.name.toLocaleLowerCase('vi')}.`)
  }
  function updateDevice(id: string, patch: DevicePatch) {
    dispatch({ type: 'update', id, patch })
    const name = devices.find(device => device.id === id)?.name
    setStatus(`${name}: ${patch.on !== undefined ? patch.on ? 'đã bật' : 'đã tắt' : patch.brightness !== undefined ? `độ sáng ${patch.brightness}%` : patch.temperature !== undefined ? `${patch.temperature}°C` : 'đã cập nhật'}. Thay đổi mô phỏng.`)
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await stageRef.current?.requestFullscreen()
    } catch { setStatus('Trình duyệt không hỗ trợ chế độ toàn màn hình trong cửa sổ này.') }
  }
  function toggleNight() {
    setNight(value => !value)
    setStatus(night ? 'Đã chuyển sang ánh sáng ban ngày.' : 'Đã chuyển sang ánh sáng ban đêm.')
  }

  return <div className="demo-shell bg-app text-text">
    <header className="topbar bg-surface">
      <a className="brand" href="./" aria-label="HESTA Digital Twin Demo"><span className="brand-mark"><House size={25} strokeWidth={2} /></span><span>HESTA<span className="brand-period">.</span></span></a>
      <div className="topbar-divider" /><div className="breadcrumb"><span>Không gian sống</span><ChevronRight size={13} /><strong>Digital Twin</strong><span className="version-tag">V2</span></div>
      <span className="demo-badge"><span />DEMO MODE</span>
      <div className="topbar-right"><span className="weather"><Sun size={20} strokeWidth={1.5} /><strong>28°</strong><span>Thủ Đức</span></span><div className="topbar-divider" /><button type="button" className="help-button" onClick={() => helpRef.current?.showModal()}><Info size={17} /><span>Hướng dẫn</span></button><div className="profile"><span>VD</span><div><strong>Việt Đức</strong><small>Không gian cá nhân</small></div></div></div>
    </header>

    <main className="workspace">
      <div className="workspace-heading"><div><div className="eyebrow"><span className="status-dot" />YOUR HOME, CONNECTED</div><h1>Ngôi nhà, trong tầm tay<span>.</span></h1><p>Một góc nhìn trực quan cho không gian sống thông minh.</p></div><div className="house-overview"><div><span>Tổng diện tích</span><strong>354 <small>m² · 3 tầng</small></strong></div><div><span>Không gian</span><strong>18 <small>khu vực</small></strong></div><div><span>Kết nối · {floors.find(item => item.id === floor)?.name}</span><strong>{online}<small> / 10 thiết bị</small><i className="status-dot" /></strong></div></div></div>

      <div className={`workbench${leftCollapsed ? ' left-collapsed' : ''}${rightCollapsed ? ' right-collapsed' : ''}`}>
        <Explorer floor={floor} rooms={rooms} onFloorChange={selectFloor} selectedRoom={selectedRoom} devices={activeDevices} collapsed={leftCollapsed} onCollapse={() => setLeftCollapsed(value => !value)} onSelect={selectRoom} />
        <section className={`scene-stage${night ? ' night' : ''}`} ref={stageRef} aria-label="Mô hình nhà 3D tương tác">
          <div className={`scene-topline${roomView ? ' room-detail' : ''}`}>
            {roomView ? <button type="button" className="return-overview" onClick={() => camera('reset')}><ArrowLeft size={18} /><span>Quay lại toàn cảnh</span><kbd>Esc</kbd></button> : null}
            <div className="view-selector"><Box size={17} /><strong>Không gian 3D</strong><span className="view-separator" /><Layers2 size={15} /><div className="floor-tabs" role="group" aria-label="Chọn tầng">{floors.map(item => <button type="button" key={item.id} aria-pressed={floor === item.id} className={floor === item.id ? 'selected' : ''} onClick={() => selectFloor(item.id)}>{item.name}</button>)}</div></div>
            {!roomView ? <button type="button" className="overview-button" onClick={() => camera('reset')}>Toàn cảnh<MoveUpRight size={14} /></button> : null}
          </div>
          <div className="scene-canvas"><SceneBoundary><Suspense fallback={<div className="scene-loading"><Box size={32} /><strong>Đang dựng không gian của bạn</strong><span>Ánh sáng, vật liệu và những chi tiết nhỏ...</span></div>}><HouseScene roomView={roomView} floor={floor} rooms={rooms} selectedRoom={selectedRoom} selectedDevice={selectedDevice} devices={activeDevices} night={night} tool={tool} command={command} onRoomSelect={selectRoom} onDeviceSelect={selectDevice} /></Suspense></SceneBoundary></div>
          <div className="scene-caption"><span className="scene-kicker">NHÀ CỦA VIỆT ĐỨC</span><span className="scene-description">{roomView ? `Cận cảnh · ${room.name}` : floors.find(item => item.id === floor)?.description}</span></div>
          <div className="compass" aria-label="Hướng Bắc"><span>N</span><Compass size={37} strokeWidth={1} /></div>
          <div className="scene-environment"><span className="environment-icon">{night ? <Moon size={15} /> : <Sun size={15} />}</span><span>{night ? '21:30 · Ban đêm' : '09:41 · Ban ngày'}</span></div>
          <div className="scene-toolbar" role="toolbar" aria-label="Công cụ camera 3D">
            <IconButton icon={MousePointer2} label="Chọn phòng" active={tool === 'select'} onClick={() => setTool('select')} />
            <IconButton icon={Hand} label="Di chuyển camera" active={tool === 'pan'} onClick={() => setTool('pan')} />
            <IconButton icon={Rotate3D} label="Xoay mô hình" active={tool === 'rotate'} onClick={() => setTool('rotate')} />
            <span className="toolbar-divider" />
            <IconButton icon={ZoomIn} label="Phóng to" onClick={() => camera('zoomIn')} />
            <IconButton icon={ZoomOut} label="Thu nhỏ" onClick={() => camera('zoomOut')} />
            <IconButton icon={RotateCcw} label="Đặt lại camera" onClick={() => camera('reset')} />
            <span className="toolbar-divider" />
            <IconButton icon={night ? Moon : Sun} label={night ? 'Chuyển sang ban ngày' : 'Chuyển sang ban đêm'} active={night} onClick={toggleNight} />
            <IconButton icon={isFullscreen ? Maximize : Expand} label={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'} active={isFullscreen} onClick={() => { void toggleFullscreen() }} />
          </div>
          <div className="scene-hint"><MousePointer2 size={12} /><span>Kéo để xoay <i>·</i> Cuộn để thu phóng <i>·</i> Chạm để khám phá</span></div>
        </section>
        <DevicePanel floorName={floors.find(item => item.id === floor)!.name} room={room} devices={activeDevices} selectedDevice={selectedDevice} collapsed={rightCollapsed} onCollapse={() => setRightCollapsed(value => !value)} onSelect={selectDevice} onUpdate={updateDevice} />
      </div>
      <Analytics room={room} devices={activeDevices} />
      <footer className="workspace-footer"><span><span className="status-dot" />Bản xem trước thiết kế <span className="footer-dot">·</span> Dữ liệu mô phỏng độc lập</span><span>HESTA DIGITAL TWIN <strong>V2.0</strong><ArrowDownRight size={12} /></span></footer>
    </main>
    <div className="sr-only" role="status" aria-live="polite">{status}</div>
    <dialog className="help-dialog" ref={helpRef} aria-labelledby="help-title"><button type="button" className="dialog-close icon-button" aria-label="Đóng hướng dẫn" onClick={() => helpRef.current?.close()} autoFocus><X size={19} /></button><span className="dialog-icon"><Box size={30} /></span><p className="eyebrow">CHÀO MỪNG VỀ NHÀ</p><h2 id="help-title">Khám phá theo cách của bạn.</h2><p>Đây là bản demo thiết kế độc lập. Thiết bị và cảm biến sử dụng dữ liệu mô phỏng hoàn toàn trong trình duyệt.</p><ul><li><MousePointer2 size={18} /><span>Chọn phòng trong danh sách hoặc nhấn lên sàn để camera di chuyển đến phòng.</span></li><li><Rotate3D size={18} /><span>Kéo để xoay, cuộn để zoom, nhấn đúp để xem gần một phòng.</span></li><li><Sun size={18} /><span>Chọn marker thiết bị, bật đèn và thay đổi độ sáng để thấy phản hồi trong 3D.</span></li><li><Moon size={18} /><span>Thử ban đêm để cảm nhận ánh sáng. Thu gọn hai panel để mở rộng không gian.</span></li></ul><button type="button" className="primary-button" onClick={() => helpRef.current?.close()}>Bắt đầu khám phá<MoveUpRight size={16} /></button></dialog>
  </div>
}
