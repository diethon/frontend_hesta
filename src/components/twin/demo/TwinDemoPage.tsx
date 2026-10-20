import { Component, lazy, Suspense, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, ArrowUpRight, Armchair, BedDouble, ChevronDown, Flame, LampCeiling, LampFloor, Lightbulb, Monitor, Moon, Play, Power, RotateCcw, Snowflake, Sparkles, Sun, Utensils, Wind } from 'lucide-react';
import { BrandMark } from '../../ui/AppSidebar';
import { supportsWebGL } from '../twin3dSupport';
import { applyDemoScene, createDemoState, demoLightLevel, demoLights, demoScenes, updateDemoLight, type DemoAC, type DemoLightColor, type DemoLightId, type DemoSceneId } from './twinDemoState';

const Scene = lazy(() => import('./TwinDemoScene'));
const subscribeMotion = (callback: () => void) => { const media = window.matchMedia('(prefers-reduced-motion: reduce)'); media.addEventListener('change', callback); return () => media.removeEventListener('change', callback); };
const getMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lightIcons = { ceiling: LampCeiling, floor: LampFloor, tv: Monitor };
const sceneIcons = { bright: Sun, relax: Armchair, movie: Play, sleep: Moon };
const colors: { id: DemoLightColor; name: string; style: string }[] = [
  { id: 'warm', name: 'Vàng ấm', style: 'bg-twin-demo-warm' }, { id: 'cool', name: 'Trắng lạnh', style: 'bg-info' },
  { id: 'mint', name: 'Xanh bạc hà', style: 'bg-mint' }, { id: 'rose', name: 'Hồng dịu', style: 'bg-error' },
];
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div role="alert" className="flex h-full items-center justify-center p-8 text-center text-text"><p>Không thể mở mô hình 3D. Bạn vẫn có thể thử các nút điều khiển bên cạnh. Hãy tải lại trang để thử lại.</p></div> : this.props.children; }
}

export default function TwinDemoPage() {
  const [state, setState] = useState(createDemoState);
  const [selected, setSelected] = useState<DemoLightId | 'ac'>('ceiling');
  const [scene, setScene] = useState<DemoSceneId | null>('relax');
  const [daylight, setDaylight] = useState(false);
  const [ready, setReady] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const [room, setRoom] = useState('all');
  const reducedMotion = useSyncExternalStore(subscribeMotion, getMotion, () => true);
  const supported = useMemo(() => supportsWebGL(), []);
  const activeLights = demoLights.filter(({ id }) => demoLightLevel(state.lights[id]) > 0).length;
  const selectedLight = selected !== 'ac' ? state.lights[selected] : null;
  const selectedDefinition = demoLights.find(({ id }) => id === selected);
  const changeLight = (id: DemoLightId, patch: Parameters<typeof updateDemoLight>[2]) => { setState((current) => updateDemoLight(current, id, patch)); setScene(null); };
  const toggleLight = (id: DemoLightId) => { setSelected(id); setState((current) => updateDemoLight(current, id, { on: !current.lights[id].on })); setScene(null); };
  const changeAC = (patch: Partial<DemoAC>) => setState((current) => ({ ...current, ac: { ...current.ac, ...patch } }));
  const selectScene = (id: DemoSceneId) => { setState((current) => applyDemoScene(current, id)); setScene(id); };
  const allLights = (on: boolean) => { setState((current) => ({ ...current, lights: Object.fromEntries(demoLights.map(({ id }) => [id, { ...current.lights[id], on, brightness: on && current.lights[id].brightness === 0 ? 30 : current.lights[id].brightness }])) as typeof current.lights })); setScene(null); };

  return <div className="app-shell twin-demo-shell">
    <header className="border-b border-line bg-surface/90">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <Link to="/home" aria-label="HESTA — về trang chủ"><BrandMark /></Link>
        <div className="flex items-center gap-2 sm:gap-4"><span className="rounded-full border border-mint bg-success-soft px-3 py-1 text-xs font-semibold text-text">Interactive demo</span><Link to="/home" className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-sidebar-hover"><ArrowLeft size={16} /><span className="hidden sm:inline">Về ngôi nhà của bạn</span></Link></div>
      </div>
    </header>
    <main id="main-content" className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary-hover"><Sparkles size={14} />HESTA Living Lab</p><h1 className="text-3xl font-semibold tracking-tight text-text sm:text-4xl">Chạm vào ngôi nhà của bạn.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted">Một chút ánh sáng. Một làn gió mát. Thử điều khiển không gian ngay trên mô hình 3D.</p></div>
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3"><span className="status-pulse h-2 w-2 rounded-full bg-mint" /><p className="text-xs leading-5 text-muted"><strong className="block font-semibold text-text">Căn hộ mẫu · 3 không gian</strong>Dữ liệu mô phỏng · Không điều khiển thiết bị thật</p></div>
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <section aria-label="Không gian 3D và ngữ cảnh" className="min-w-0 space-y-4">
          <div className="twin-demo-stage relative isolate overflow-hidden rounded-3xl border border-line shadow-soft" data-daylight={daylight} data-active-lights={activeLights} data-ac-on={state.ac.on} data-ac-fan={state.ac.fan}>
            <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex flex-wrap items-start justify-between gap-3 p-4 sm:p-6">
              <div className="rounded-2xl border border-line bg-surface/95 px-4 py-3 shadow-soft"><p className="text-sm font-semibold text-text">The Garden Apartment</p><p className="mt-1 text-xs text-muted"><span data-testid="demo-light-count">{activeLights}/5 đèn đang bật</span><span className="mx-2 text-line">|</span>Điều hòa {state.ac.on ? `${state.ac.temperature}°C` : 'đang tắt'}</p></div>
              <div aria-label="Ánh sáng môi trường" className="pointer-events-auto flex rounded-xl border border-line bg-surface/95 p-1 shadow-soft">{[{ value: true, name: 'Ban ngày', Icon: Sun }, { value: false, name: 'Buổi tối', Icon: Moon }].map(({ value, name, Icon }) => <button key={name} type="button" aria-label={name} aria-pressed={daylight === value} onClick={() => setDaylight(value)} className={`flex h-10 w-10 items-center justify-center rounded-lg ${daylight === value ? 'bg-sidebar-active text-primary-hover' : 'text-muted hover:bg-sidebar-hover'}`}><Icon size={17} /></button>)}</div>
            </div>
            {supported ? <SceneBoundary key={cameraKey}><Suspense fallback={<div role="status" className="flex h-full items-center justify-center bg-app text-sm text-muted">Đang chuẩn bị căn hộ…</div>}><Scene state={state} daylight={daylight} reducedMotion={reducedMotion} selected={selected} onLight={toggleLight} onAC={() => setSelected('ac')} onReady={() => setReady(true)} /></Suspense></SceneBoundary> : <div role="alert" className="flex h-full items-center justify-center bg-app p-8 text-center text-sm text-muted">Trình duyệt chưa hỗ trợ WebGL. Bạn vẫn có thể thử bảng điều khiển và các ngữ cảnh bên dưới.</div>}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-wrap items-center justify-between gap-2 p-4 sm:p-5">
              <span className="rounded-xl border border-line bg-surface/95 px-3 py-2 text-xs text-muted">{ready ? 'Kéo để xoay · Cuộn để thu phóng · Chạm đèn để bật/tắt' : 'Bảng điều khiển sẵn sàng để thử'}</span>
              <button type="button" aria-label="Đặt lại góc nhìn" onClick={() => { setReady(false); setCameraKey((key) => key + 1); }} className="pointer-events-auto flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface/95 px-3 text-xs font-semibold text-text shadow-soft hover:bg-sidebar-hover"><RotateCcw size={15} />Góc nhìn gốc</button>
            </div>
          </div>

          <div className="surface-card p-4 sm:p-5"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-text">Một chạm, đổi không khí</h2><span className="text-xs text-muted">Ngữ cảnh ánh sáng</span></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{demoScenes.map(({ id, name, description }) => { const Icon = sceneIcons[id]; return <button type="button" key={id} aria-pressed={scene === id} onClick={() => selectScene(id)} className={`flex min-h-24 flex-col items-start justify-center gap-2 rounded-2xl border p-4 text-left transition-colors ${scene === id ? 'border-primary bg-info-soft text-primary-hover' : 'border-line bg-app text-muted hover:bg-sidebar-hover'}`}><Icon size={20} /><span className="text-sm font-semibold">{name}</span><span className="text-xs text-muted">{description}</span></button>; })}</div></div>
          <p className="px-1 text-xs leading-5 text-muted">Đèn, độ sáng, màu sắc và luồng gió phản hồi trực tiếp trong mô hình. Bạn có thể thử thoải mái; tải lại trang sẽ khôi phục căn hộ mẫu.</p>
        </section>

        <aside aria-label="Bảng điều khiển căn hộ" className="min-w-0 space-y-4">
          <section className="surface-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-4"><div><p className="text-xs text-muted">Đang điều khiển</p><h2 className="mt-1 text-base font-semibold text-text">{selected === 'ac' ? 'Điều hòa phòng khách' : selectedDefinition?.name}</h2></div><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-info-soft text-primary-hover">{selected === 'ac' ? <Snowflake size={21} /> : <Lightbulb size={21} />}</span></div>
            {selectedLight && selected !== 'ac' ? <div className="space-y-5 p-5" data-testid="demo-light-controls">
              <div className="flex items-center justify-between"><div><p className="text-xs text-muted">Nguồn đèn</p><p role="status" className="mt-1 text-sm font-semibold text-text">{selectedLight.on ? 'Đang bật' : 'Đang tắt'}</p></div><button type="button" role="switch" aria-label={`Nguồn ${selectedDefinition?.name}`} aria-checked={selectedLight.on} onClick={() => toggleLight(selected)} className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-colors ${selectedLight.on ? 'bg-primary text-white shadow-soft' : 'bg-off-soft text-muted'}`}><Power size={22} /></button></div>
              <label className="block text-sm text-muted" htmlFor="demo-brightness">Độ sáng<span className="float-right font-semibold text-text"><output htmlFor="demo-brightness">{selectedLight.brightness}%</output></span><input id="demo-brightness" aria-label="Độ sáng đèn" type="range" min={0} max={100} value={selectedLight.brightness} onChange={(event) => changeLight(selected, { brightness: Number(event.target.value), on: Number(event.target.value) > 0 })} className="twin-demo-range mt-4 w-full" /><span className="mt-1 flex justify-between text-xs"><span>Dịu nhẹ</span><span>Rực sáng</span></span></label>
              <fieldset><legend className="mb-3 text-sm text-muted">Màu ánh sáng</legend><div className="grid grid-cols-4 gap-2">{colors.map(({ id, name, style }) => <button type="button" key={id} aria-label={name} aria-pressed={selectedLight.color === id} onClick={() => changeLight(selected, { color: id })} className={`flex min-h-16 flex-col items-center justify-center gap-2 rounded-xl border text-[10px] font-semibold text-muted ${selectedLight.color === id ? 'border-primary bg-info-soft' : 'border-line hover:bg-sidebar-hover'}`}><span className={`h-6 w-6 rounded-full border border-line ${style}`} />{name}</button>)}</div></fieldset>
            </div> : <div className="space-y-5 p-5" data-testid="demo-ac-controls">
              <div className="flex items-center justify-between"><span className="text-sm text-muted">Nguồn điều hòa</span><button type="button" role="switch" aria-label="Nguồn điều hòa" aria-checked={state.ac.on} onClick={() => changeAC({ on: !state.ac.on })} className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-colors ${state.ac.on ? 'bg-primary text-white' : 'bg-off-soft text-muted'}`}><Power size={22} /></button></div>
              <div className="flex items-center justify-between rounded-2xl bg-app px-3 py-5"><button type="button" aria-label="Giảm nhiệt độ" disabled={state.ac.temperature <= 16} onClick={() => changeAC({ temperature: Math.max(16, state.ac.temperature - 1) })} className="h-11 w-11 rounded-xl border border-line bg-surface text-xl text-text hover:bg-sidebar-hover disabled:opacity-40">−</button><output aria-label="Nhiệt độ cài đặt" className="text-5xl font-light tracking-tight text-text">{state.ac.temperature}<span className="align-top text-lg text-muted">°C</span></output><button type="button" aria-label="Tăng nhiệt độ" disabled={state.ac.temperature >= 30} onClick={() => changeAC({ temperature: Math.min(30, state.ac.temperature + 1) })} className="h-11 w-11 rounded-xl border border-line bg-surface text-xl text-text hover:bg-sidebar-hover disabled:opacity-40">+</button></div>
              <fieldset><legend className="mb-2 text-sm text-muted">Chế độ</legend><div className="grid grid-cols-3 gap-2">{([{ id: 'cool', name: 'Làm mát', Icon: Snowflake }, { id: 'dry', name: 'Hút ẩm', Icon: Flame }, { id: 'fan', name: 'Quạt', Icon: Wind }] as const).map(({ id, name, Icon }) => <button type="button" key={id} aria-pressed={state.ac.mode === id} onClick={() => changeAC({ mode: id })} className={`flex min-h-16 flex-col items-center justify-center gap-2 rounded-xl border text-xs font-semibold ${state.ac.mode === id ? 'border-primary bg-info-soft text-primary-hover' : 'border-line text-muted hover:bg-sidebar-hover'}`}><Icon size={18} />{name}</button>)}</div></fieldset>
              <label htmlFor="demo-fan" className="flex items-center justify-between gap-3 text-sm text-muted">Tốc độ gió<span className="relative"><select id="demo-fan" value={state.ac.fan} onChange={(event) => changeAC({ fan: event.target.value as DemoAC['fan'] })} className="min-h-11 appearance-none rounded-xl border border-line bg-surface py-2 pl-3 pr-9 text-sm text-text"><option value="auto">Tự động</option><option value="low">Nhẹ</option><option value="high">Mạnh</option></select><ChevronDown size={15} className="pointer-events-none absolute right-3 top-3.5" /></span></label>
              <p role="status" className="rounded-xl bg-info-soft px-3 py-2 text-xs leading-5 text-muted">{state.ac.on ? `Đang chạy · ${state.ac.temperature}°C · Luồng gió hiển thị trên mô hình` : 'Điều hòa đã tắt · Luồng gió đã dừng'}</p>
            </div>}
          </section>

          <section className="surface-card p-4"><div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-sm font-semibold text-text">Thiết bị trong nhà</h2><div className="flex gap-1"><button type="button" onClick={() => allLights(true)} className="min-h-9 rounded-lg bg-sidebar px-2 text-xs font-semibold text-muted hover:bg-sidebar-hover">Bật hết đèn</button><button type="button" onClick={() => allLights(false)} className="min-h-9 rounded-lg bg-sidebar px-2 text-xs font-semibold text-muted hover:bg-sidebar-hover">Tắt hết đèn</button></div></div>
            <div aria-label="Lọc theo phòng" className="mb-3 flex flex-wrap gap-1">{[{ id: 'all', name: 'Tất cả', Icon: Lightbulb }, { id: 'Phòng khách', name: 'Khách', Icon: Armchair }, { id: 'Phòng ngủ', name: 'Ngủ', Icon: BedDouble }, { id: 'Bếp & bàn ăn', name: 'Bếp', Icon: Utensils }].map(({ id, name, Icon }) => <button type="button" key={id} aria-pressed={room === id} onClick={() => setRoom(id)} className={`flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold ${room === id ? 'bg-sidebar-active text-primary-hover' : 'text-muted hover:bg-sidebar-hover'}`}><Icon size={13} />{name}</button>)}</div>
            <div className="space-y-2">{demoLights.filter((light) => room === 'all' || light.room === room).map(({ id, name, room: roomName, kind }) => { const Icon = lightIcons[kind]; const light = state.lights[id]; return <div key={id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${selected === id ? 'border-primary bg-info-soft' : 'border-line bg-surface'}`}><button type="button" aria-label={`Chọn ${name}`} onClick={() => setSelected(id)} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${demoLightLevel(light) > 0 ? 'bg-warning-soft text-text' : 'bg-off-soft text-muted'}`}><Icon size={17} /></span><span className="min-w-0"><strong className="block truncate text-xs font-semibold text-text">{name}</strong><span className="mt-1 block text-[10px] text-muted">{roomName} · {light.on ? `${light.brightness}%` : 'Tắt'}</span></span></button><button type="button" role="switch" aria-label={`Bật/tắt ${name}`} aria-checked={light.on} onClick={() => toggleLight(id)} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${light.on ? 'bg-warning-soft text-text' : 'text-muted hover:bg-sidebar-hover'}`}><Power size={16} /></button></div>; })}
              {room === 'all' || room === 'Phòng khách' ? <button type="button" aria-label="Chọn điều hòa phòng khách" onClick={() => setSelected('ac')} className={`flex min-h-16 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left ${selected === 'ac' ? 'border-primary bg-info-soft' : 'border-line hover:bg-sidebar-hover'}`}><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-info-soft text-primary-hover"><Snowflake size={18} /></span><span className="flex-1"><strong className="block text-xs font-semibold text-text">Điều hòa phòng khách</strong><span className="mt-1 block text-[10px] text-muted">{state.ac.on ? `${state.ac.temperature}°C · Đang chạy` : 'Đang tắt'}</span></span><ArrowUpRight size={16} className="text-muted" /></button> : null}
            </div>
          </section>
        </aside>
      </div>
    </main>
  </div>;
}
