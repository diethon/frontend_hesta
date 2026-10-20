import { Component, useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Armchair, Box, Crosshair, House, LayoutDashboard, ListTree, Moon, RotateCcw, SlidersHorizontal, Sun, X } from 'lucide-react';
import { useAppSelector } from '../../store/hooks';
import type { TwinLayoutGeometry, TwinLayoutSelection } from '../../types/twinLayout';
import type { TwinHeatmapMode } from '../../types/twinView';
import { Twin3DCanvas } from './Twin3DCanvas';
import { Twin3DInspector } from './Twin3DInspector';
import { TwinLayoutButton } from './TwinLayoutButton';
import { readApartmentPalette } from './interior/apartmentPalette';
import { rendererPalette, type TwinRendererTheme } from './scene/rendererTheme';
import { geometryForFloor, layoutFloors, resolveUnplacedNodes } from './twin3dGeometry';
import { supportsWebGL } from './twin3dSupport';
import type { TwinDraftingMetadata } from './twinDrafting';
import { TwinContent } from './TwinContent';
import { Twin3DCameraControls } from './Twin3DCameraControls';
import type { TwinCameraAction, TwinCameraRequest, TwinCameraView } from './twin3dCamera';
import { TwinHeatmapToolbar } from './TwinHeatmapToolbar';
import { TwinSidebar } from './TwinSidebar';
import { TwinFloorNavigation } from './TwinFloorNavigation';
import type { TwinFloorMode, TwinWallMode, TwinMarkerMode } from './scene/architectureMaterials';
import { TwinLivingDevices } from './TwinLivingDevices';
import { knownPower } from './twinPresentation';

const subscribeCompact = (callback: () => void) => { const media = window.matchMedia('(max-width: 767px)'); media.addEventListener('change', callback); return () => media.removeEventListener('change', callback); };
class Twin3DErrorBoundary extends Component<{ children: ReactNode; onError: (error: Error) => void }, { failed: boolean }> {
  state = { failed: false }; static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.onError(error); }
  render() { return this.state.failed ? null : this.props.children; }
}
function ViewOptions<T extends string>({ label, options, value, onChange }: { label: string; options: readonly { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return <div aria-label={label} className="flex flex-wrap gap-1 rounded-xl bg-app p-1">{options.map((option) => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)} className={`min-h-11 rounded-lg px-3 text-xs font-semibold ${value === option.value ? 'bg-surface text-primary-hover shadow-soft' : 'text-muted hover:bg-sidebar-hover'}`}>{option.label}</button>)}</div>;
}
export function Twin3DView({ geometry, drafting, role, onEdit2D }: { geometry: TwinLayoutGeometry; drafting: TwinDraftingMetadata; role: 'OWNER' | 'MEMBER' | null; onEdit2D: () => void }) {
  const deviceIds = useAppSelector((state) => state.twin.deviceIds), roomIds = useAppSelector((state) => state.twin.roomIds), sensorIds = useAppSelector((state) => state.twin.sensorIds);
  const home = useAppSelector((state) => state.twin.home);
  const devicesById = useAppSelector((state) => state.twin.devicesById);
  const roomsById = useAppSelector((state) => state.twin.roomsById);
  const [selection, setSelection] = useState<TwinLayoutSelection | null>(null), [fitRequest, setFitRequest] = useState(0);
  const [cameraRequest, setCameraRequest] = useState<TwinCameraRequest>({ serial: 0, action: 'isometric' }), [activeView, setActiveView] = useState<TwinCameraView | null>('isometric');
  const [focusRoomId, setFocusRoomId] = useState<string | null>(null), [focusNodeKey, setFocusNodeKey] = useState<string | null>(null);
  const [activeFloor, setActiveFloor] = useState<number | 'all'>(() => layoutFloors(geometry.rooms)[0] ?? 'all'), [mode, setMode] = useState<TwinFloorMode>('single');
  const [wallMode, setWallMode] = useState<TwinWallMode>('auto'), [markerMode, setMarkerMode] = useState<TwinMarkerMode>('none');
  const [theme, setTheme] = useState<TwinRendererTheme>('COZY');
  const [heatmapMode, setHeatmapMode] = useState<TwinHeatmapMode>('normal'), [treeOpen, setTreeOpen] = useState(false);
  const [ready, setReady] = useState(false), [sceneError, setSceneError] = useState<Error | null>(null);
  const supported = useMemo(() => supportsWebGL(), []);
  const compact = useSyncExternalStore(subscribeCompact, () => window.matchMedia('(max-width: 767px)').matches, () => true);
  const palette = useMemo(() => supported ? rendererPalette(readApartmentPalette(), theme) : null, [supported,theme]);
  const unplaced = useMemo(() => resolveUnplacedNodes(geometry, deviceIds, sensorIds), [deviceIds, geometry, sensorIds]);
  const unplacedRooms = roomIds.filter((id) => !geometry.rooms.some((room) => room.roomId === id)).length;
  const floors = useMemo(() => layoutFloors(geometry.rooms), [geometry.rooms]);
  const resolvedFloor = activeFloor !== 'all' && !floors.includes(activeFloor) ? floors[0] : activeFloor;
  const visibleGeometry = useMemo(() => geometryForFloor(geometry, mode === 'single' ? resolvedFloor : 'all'), [geometry, resolvedFloor, mode]);
  const activeRooms = visibleGeometry.rooms;
  const activeDevices = visibleGeometry.nodes.filter((node) => node.nodeType === 'DEVICE').map((node) => devicesById[node.nodeId]).filter((device) => device !== undefined);
  const onCount = activeDevices.filter((device) => device.status === 'ONLINE' && device.healthStatus === 'ACTIVE' && knownPower(device.currentState) === true).length;
  const handleReady = useCallback(() => setReady(true), []), handleCameraInteract = useCallback(() => setActiveView(null), []);
  const changeCamera = (action: TwinCameraAction) => { setCameraRequest((previous) => ({ serial: previous.serial + 1, action })); if (action !== 'zoom-in' && action !== 'zoom-out') setActiveView(action === 'turn-left' || action === 'turn-right' ? null : action); };
  const fitHome = () => { setFocusNodeKey(null); setFocusRoomId(null); setFitRequest((value) => value + 1); };
  const focusRoom = (id: string) => { setFocusNodeKey(null); setFocusRoomId(id); setFitRequest((value) => value + 1); };
  const focusSelection = useCallback((next: TwinLayoutSelection) => {
    const node = next.kind === 'node' ? geometry.nodes.find((node) => `${node.nodeType}:${node.nodeId}` === next.id) : undefined;
    const room = geometry.rooms.find((item) => item.roomId === (next.kind === 'room' ? next.id : node?.roomId));
    setSelection(next); setTreeOpen(false); setFocusNodeKey(next.kind === 'node' ? next.id : null); setFocusRoomId(next.kind === 'room' ? next.id : null);
    if (room) { setActiveFloor(room.floor ?? 1); setMode('single'); }
    setFitRequest((value) => value + 1);
  }, [geometry]);
  const select = useCallback((next: TwinLayoutSelection | null) => {
    if (next?.kind === 'node') { focusSelection(next); return; }
    setSelection(next); setFocusRoomId(null); setFocusNodeKey(null);
  }, [focusSelection]);
  const chooseFloor = (floor: number | 'all') => { setActiveFloor(floor); setMode(floor === 'all' ? 'house' : 'single'); setSelection(null); fitHome(); };
  const chooseMode = (next: TwinFloorMode) => { setMode(next); setActiveFloor(next === 'single' ? resolvedFloor === 'all' ? floors[0] : resolvedFloor : 'all'); setSelection(null); fitHome(); };
  if (!geometry.rooms.length) return <section aria-label="Chế độ 3D" className="surface-card p-8 text-center sm:p-12"><House className="mx-auto text-primary" size={32} /><h2 className="mt-4 text-xl font-semibold text-text">Chưa có sơ đồ nhà</h2><p className="mt-2 text-sm text-muted">Các phòng hiện có chưa được đặt lên Digital Twin.</p>{role === 'OWNER' ? <div className="mt-5 flex justify-center"><TwinLayoutButton variant="primary" leadingIcon={<LayoutDashboard size={18} />} onClick={onEdit2D}>Thiết kế sơ đồ</TwinLayoutButton></div> : <p className="mt-4 text-sm text-muted">Chủ nhà chưa thiết lập sơ đồ Digital Twin.</p>}<p className="mt-4 text-xs text-muted">Unplaced · {unplacedRooms} phòng · {unplaced.deviceIds.length} thiết bị · {unplaced.sensorIds.length} cảm biến</p><details className="mt-4 text-left"><summary className="cursor-pointer text-sm text-primary-hover">Đọc dữ liệu trực tiếp</summary><TwinContent /></details></section>;
  if (!supported || sceneError || !palette) return <section role="alert" aria-label="Không thể mở chế độ 3D" className="surface-card border-error bg-error-soft p-6 text-center"><Box className="mx-auto text-muted" /><h2 className="mt-4 font-semibold text-text">Không thể khởi tạo trình xem 3D.</h2><p className="mt-2 text-sm text-muted">WebGL có thể đang bị tắt hoặc thiết bị không hỗ trợ chế độ này. Sơ đồ 2D vẫn hoạt động bình thường.</p><div className="mt-5 flex justify-center"><TwinLayoutButton variant="primary" onClick={onEdit2D}>Chuyển sang 2D</TwinLayoutButton></div><details className="mt-4"><summary>Đọc dữ liệu trực tiếp</summary><TwinContent /></details></section>;
  return <section aria-label="Chế độ 3D" className="min-w-0 space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div aria-label="Tầng đang xem" className="flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-line bg-surface p-1.5 shadow-soft">
        {floors.map((floor) => <button key={floor} type="button" aria-label={`Xem tầng ${floor}`} aria-pressed={mode === 'single' && resolvedFloor === floor} onClick={() => chooseFloor(floor)} className={`min-h-11 shrink-0 rounded-xl px-5 text-xs font-semibold transition-colors ${mode === 'single' && resolvedFloor === floor ? 'bg-sidebar-active text-primary-hover' : 'text-muted hover:bg-sidebar-hover'}`}>Tầng {floor}</button>)}
        <button type="button" aria-pressed={mode !== 'single'} onClick={() => chooseFloor('all')} className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-xs font-semibold ${mode !== 'single' ? 'bg-sidebar-active text-primary-hover' : 'text-muted hover:bg-sidebar-hover'}`}><House size={15} />Cả ngôi nhà</button>
      </div>
      <p className="text-xs text-muted">{activeRooms.length} phòng <span className="mx-2 text-line">/</span> {activeDevices.length} thiết bị</p>
    </div>
    <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-4">
        <div className="twin-3d-stage twin-living-stage relative isolate min-w-0 overflow-hidden rounded-3xl border border-line shadow-soft" data-theme={theme} data-floor-mode={mode} data-wall-mode={wallMode} data-marker-mode={markerMode}>
          {!ready ? <div role="status" className="absolute inset-0 z-50 flex items-center justify-center bg-app text-sm text-muted">Đang dựng không gian của bạn…</div> : null}
          <Twin3DErrorBoundary onError={setSceneError}><Twin3DCanvas geometry={geometry} drafting={drafting} activeFloor={resolvedFloor} mode={mode} wallMode={wallMode} markerMode={markerMode} selection={selection} fitRequest={fitRequest} cameraRequest={cameraRequest} focusRoomId={focusRoomId} focusNodeKey={focusNodeKey} compact={compact} palette={palette} theme={theme} heatmapMode={heatmapMode} onSelect={select} onFocus={focusSelection} onReady={handleReady} onCameraInteract={handleCameraInteract} /></Twin3DErrorBoundary>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
            <div className="rounded-2xl border border-line bg-surface/95 px-4 py-3 shadow-soft"><p className="max-w-56 truncate text-sm font-semibold text-text">{home?.name ?? 'Ngôi nhà của bạn'}</p><p className="mt-1 text-xs text-muted">{mode === 'single' ? `Tầng ${resolvedFloor}` : 'Toàn cảnh'} <span className="mx-2 text-line">|</span> {onCount} thiết bị đang bật</p></div>
            <div aria-label="Ánh sáng không gian" className="pointer-events-auto flex rounded-xl border border-line bg-surface/95 p-1 shadow-soft">
              <button type="button" aria-label="Ban ngày" aria-pressed={theme === 'DAYLIGHT'} onClick={() => setTheme('DAYLIGHT')} className={`flex h-10 w-10 items-center justify-center rounded-lg ${theme === 'DAYLIGHT' ? 'bg-sidebar-active text-primary-hover' : 'text-muted hover:bg-sidebar-hover'}`}><Sun size={17} /></button>
              <button type="button" aria-label="Không gian ấm" aria-pressed={theme === 'COZY'} onClick={() => setTheme('COZY')} className={`flex h-10 w-10 items-center justify-center rounded-lg ${theme === 'COZY' ? 'bg-sidebar-active text-primary-hover' : 'text-muted hover:bg-sidebar-hover'}`}><Moon size={17} /></button>
              <button type="button" aria-label="Danh sách phòng và thiết bị" aria-expanded={treeOpen} onClick={() => setTreeOpen((open) => !open)} className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-sidebar-hover"><ListTree size={17} /></button>
            </div>
          </div>
          {treeOpen ? <div className="absolute bottom-20 right-3 top-28 z-40 w-64 max-w-full overflow-auto rounded-2xl shadow-float"><TwinSidebar geometry={visibleGeometry} selection={selection} onFocus={focusSelection} /></div> : null}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex flex-wrap items-center justify-between gap-2 p-4 sm:p-5">
            <span className="rounded-xl border border-line bg-surface/95 px-3 py-2 text-[11px] text-muted">Kéo để xoay · Cuộn để thu phóng · Chạm thiết bị để điều khiển</span>
            <button type="button" aria-label="Reset góc nhìn" onClick={() => { fitHome(); changeCamera('isometric'); }} className="pointer-events-auto flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface/95 px-3 text-xs font-semibold text-text shadow-soft hover:bg-sidebar-hover"><RotateCcw size={15} />Góc nhìn gốc</button>
          </div>
        </div>
        <section aria-label="Chọn không gian" className="surface-card p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-text">Không gian của bạn</h3><span className="text-xs text-muted">Chọn phòng để xem gần hơn</span></div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {activeRooms.map((room) => <button type="button" key={room.roomId} aria-pressed={selection?.kind === 'room' && selection.id === room.roomId} onClick={() => focusSelection({ kind: 'room', id: room.roomId })} className={`flex min-h-24 flex-col items-start justify-center gap-2 rounded-2xl border p-4 text-left transition-colors ${selection?.kind === 'room' && selection.id === room.roomId ? 'border-primary bg-info-soft text-primary-hover' : 'border-line bg-app text-muted hover:bg-sidebar-hover'}`}><Armchair size={20} /><strong className="text-xs font-semibold text-text">{roomsById[room.roomId]?.name ?? 'Phòng'}</strong><span className="text-[11px] text-muted">{activeDevices.filter((device) => device.roomId === room.roomId).length} thiết bị · Tầng {room.floor ?? 1}</span></button>)}
          </div>
        </section>
        <details className="surface-card p-4">
          <summary className="flex min-h-7 cursor-pointer items-center gap-2 text-xs font-semibold text-muted"><SlidersHorizontal size={15} />Hiển thị nâng cao</summary>
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2"><ViewOptions label="Bố trí tầng" value={mode} onChange={chooseMode} options={[{ value: 'house', label: 'Ngôi nhà' }, { value: 'single', label: 'Một tầng' }, { value: 'exploded', label: 'Tách tầng' }]} /><ViewOptions label="Tường" value={wallMode} onChange={setWallMode} options={[{ value: 'auto', label: 'Tường tự động' }, { value: 'cut', label: 'Cắt tường' }]} /></div>
            <ViewOptions label="Marker" value={markerMode} onChange={setMarkerMode} options={[{ value: 'important', label: 'Quan trọng' }, { value: 'all', label: 'Tất cả' }, { value: 'none', label: 'Ẩn marker' }]} />
            <ViewOptions label="Theme renderer" value={theme} onChange={setTheme} options={[{value:'COZY',label:'Ấm áp'},{value:'DAYLIGHT',label:'Daylight'},{value:'BLUEPRINT',label:'Blueprint'},{value:'NIGHT',label:'Night'}]} />
            <Twin3DCameraControls activeView={activeView} onChange={changeCamera} />
            <div className="flex flex-wrap items-start gap-3"><TwinHeatmapToolbar value={heatmapMode} onChange={setHeatmapMode} /><TwinLayoutButton aria-label="Đưa mô hình vừa màn hình" leadingIcon={<Crosshair size={16} />} onClick={fitHome}>Vừa nhà</TwinLayoutButton></div>
            <TwinFloorNavigation geometry={geometry} drafting={drafting} value={mode === 'single' ? resolvedFloor : 'all'} onChange={chooseFloor} />
          </div>
        </details>
        {unplacedRooms + unplaced.deviceIds.length + unplaced.sensorIds.length ? <p className="px-1 text-xs text-muted">Chưa đặt: {unplacedRooms} phòng, {unplaced.deviceIds.length} thiết bị, {unplaced.sensorIds.length} cảm biến.</p> : null}
      </div>
      <aside aria-label="Bảng điều khiển ngôi nhà" className="min-w-0 space-y-4">
        {selection ? <div className="flex items-center justify-between px-1"><span className="text-xs font-semibold text-muted">Đang điều khiển</span><button type="button" aria-label="Đóng chi tiết" onClick={() => select(null)} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:bg-sidebar-hover"><X size={17} /></button></div> : null}
        <div className="twin-living-inspector"><Twin3DInspector geometry={visibleGeometry} selection={selection} onSelect={select} onEdit2D={onEdit2D} canEdit={role === 'OWNER'} onFocusRoom={focusRoom} onFitHome={fitHome} /></div>
        <TwinLivingDevices geometry={visibleGeometry} selection={selection} onSelect={select} />
      </aside>
    </div>
  </section>;
}
