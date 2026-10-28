import { Activity, ArrowDownRight, Droplets, Footprints, HeartPulse, Leaf, Sun, Thermometer } from 'lucide-react'
import type { Device, Room } from '../data'

const trends = {
  temperature: '0,27 8,25 16,28 24,17 32,20 40,15 48,19 56,10 64,13 72,6 80,9 90,5',
  humidity: '0,16 8,19 16,11 24,18 32,14 40,20 48,13 56,18 64,10 72,16 80,12 90,15',
  light: '0,29 8,29 16,25 24,26 32,21 40,24 48,14 56,17 64,10 72,13 80,5 90,8',
  air: '0,20 8,16 16,19 24,11 32,14 40,13 48,19 56,14 64,17 72,10 80,14 90,9',
}
function Sparkline({ points, label }: { points: string; label: string }) {
  return <svg viewBox="0 0 90 36" className="sparkline" role="img" aria-label={label}><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
export default function Analytics({ room, devices }: { room: Room; devices: Device[] }) {
  const online = devices.filter(device => device.online).length
  const light = devices.find(device => device.room === room.id && device.kind === 'light')
  const lux = light ? Math.round(80 + (light.on ? (light.brightness ?? 75) * 3.2 : 0)) : 280
  return <section className="analytics" aria-label="Phân tích cảm biến mô phỏng">
    <div className="analytics-heading"><div><Activity size={16} /><strong>Nhịp sống ngôi nhà</strong><span className="analytics-room">/ {room.name}</span></div><span><span className="status-dot" />DỮ LIỆU MÔ PHỎNG</span></div>
    <div className="analytics-grid">
      <article className="metric"><div className="metric-title"><Thermometer size={15} />Nhiệt độ</div><div className="metric-body"><strong>{room.temperature}<small>°C</small></strong><Sparkline points={trends.temperature} label="Xu hướng nhiệt độ mô phỏng" /></div><p><ArrowDownRight size={12} />0.4° <span>so với giờ trước</span></p></article>
      <article className="metric"><div className="metric-title"><Droplets size={15} />Độ ẩm</div><div className="metric-body"><strong>{room.humidity}<small>%</small></strong><Sparkline points={trends.humidity} label="Xu hướng độ ẩm mô phỏng" /></div><p><span className="metric-status" />Trong ngưỡng lý tưởng</p></article>
      <article className="metric"><div className="metric-title"><Sun size={15} />Ánh sáng</div><div className="metric-body"><strong>{lux}<small>lux</small></strong><Sparkline points={trends.light} label="Xu hướng ánh sáng mô phỏng" /></div><p>Ánh sáng {light?.on ? 'đang bật' : 'tự nhiên'}</p></article>
      <article className="metric"><div className="metric-title"><Footprints size={15} />Chuyển động</div><div className="metric-body"><strong className="metric-word">Yên tĩnh</strong><div className="motion-bars" aria-hidden="true">{[8, 12, 7, 18, 11, 6, 13, 9, 6, 11, 5, 8].map((height, i) => <i key={i} style={{ height }} />)}</div></div><p>Không có chuyển động mới</p></article>
      <article className="metric"><div className="metric-title"><Leaf size={15} />Chất lượng không khí</div><div className="metric-body"><strong>28<small>AQI</small></strong><Sparkline points={trends.air} label="Xu hướng AQI mô phỏng" /></div><p><span className="metric-status" />Tốt cho sức khỏe</p></article>
      <article className="metric"><div className="metric-title"><HeartPulse size={15} />Tình trạng thiết bị</div><div className="metric-body"><strong>{online}<small>/ {devices.length}</small></strong><div className="health-bars" aria-label={`${online} thiết bị trực tuyến`}>{devices.map(device => <i key={device.id} className={device.online ? 'online' : ''} />)}</div></div><p><span className="metric-status" />Thiết bị trực tuyến</p></article>
    </div>
  </section>
}
