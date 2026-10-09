import { Component, useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Box, Crosshair, House, LayoutDashboard, ListTree, RotateCcw, X } from 'lucide-react';
import { useAppSelector } from '../../store/hooks';
import type { TwinLayoutGeometry, TwinLayoutSelection } from '../../types/twinLayout';
import type { TwinHeatmapMode } from '../../types/twinView';
import { Twin3DCanvas } from './Twin3DCanvas';
import { Twin3DInspector } from './Twin3DInspector';
import { TwinLayoutButton } from './TwinLayoutButton';
import { readTwin3DPalette } from './twin3dPalette';
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

const subscribeCompact = (callback: () => void) => { const media = window.matchMedia('(max-width: 767px)'); media.addEventListener('change', callback); return () => media.removeEventListener('change', callback); };
class Twin3DErrorBoundary extends Component<{ children: ReactNode; onError: (error: Error) => void }, { failed: boolean }> {
  state = { failed: false }; static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.onError(error); }
  render() { return this.state.failed ? null : this.props.children; }
}
function ViewOptions<T extends string>({ label, options, value, onChange }: { label: string; options: readonly { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return <div aria-label={label} className="flex gap-1 rounded-xl bg-app p-1">{options.map((option) => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)} className={`min-h-11 rounded-lg px-3 text-xs font-semibold ${value === option.value ? 'bg-surface text-primary-hover shadow-soft' : 'text-muted hover:bg-sidebar-hover'}`}>{option.label}</button>)}</div>;
}
export function Twin3DView({ geometry, drafting, role, onEdit2D }: { geometry: TwinLayoutGeometry; drafting: TwinDraftingMetadata; role: 'OWNER' | 'MEMBER' | null; onEdit2D: () => void }) {
  const deviceIds = useAppSelector((state) => state.twin.deviceIds), roomIds = useAppSelector((state) => state.twin.roomIds), sensorIds = useAppSelector((state) => state.twin.sensorIds);
  const [selection, setSelection] = useState<TwinLayoutSelection | null>(null), [fitRequest, setFitRequest] = useState(0);
  const [cameraRequest, setCameraRequest] = useState<TwinCameraRequest>({ serial: 0, action: 'isometric' }), [activeView, setActiveView] = useState<TwinCameraView | null>('isometric');
  const [focusRoomId, setFocusRoomId] = useState<string | null>(null), [focusNodeKey, setFocusNodeKey] = useState<string | null>(null);
  const [activeFloor, setActiveFloor] = useState<number | 'all'>('all'), [mode, setMode] = useState<TwinFloorMode>('house');
  const [wallMode, setWallMode] = useState<TwinWallMode>('auto'), [markerMode, setMarkerMode] = useState<TwinMarkerMode>('important');
  const [theme, setTheme] = useState<TwinRendererTheme>('DAYLIGHT');
  const [heatmapMode, setHeatmapMode] = useState<TwinHeatmapMode>('normal'), [treeOpen, setTreeOpen] = useState(false);
  const [ready, setReady] = useState(false), [sceneError, setSceneError] = useState<Error | null>(null);
  const supported = useMemo(() => supportsWebGL(), []);
  const compact = useSyncExternalStore(subscribeCompact, () => window.matchMedia('(max-width: 767px)').matches, () => true);
  const palette = useMemo(() => supported ? rendererPalette(readTwin3DPalette(), theme) : null, [supported,theme]);
  const unplaced = useMemo(() => resolveUnplacedNodes(geometry, deviceIds, sensorIds), [deviceIds, geometry, sensorIds]);
  const unplacedRooms = roomIds.filter((id) => !geometry.rooms.some((room) => room.roomId === id)).length;
  const floors = useMemo(() => layoutFloors(geometry.rooms), [geometry.rooms]);
  const resolvedFloor = activeFloor !== 'all' && !floors.includes(activeFloor) ? floors[0] : activeFloor;
  const visibleGeometry = useMemo(() => geometryForFloor(geometry, mode === 'single' ? resolvedFloor : 'all'), [geometry, resolvedFloor, mode]);
  const handleReady = useCallback(() => setReady(true), []), handleCameraInteract = useCallback(() => setActiveView(null), []);
  const changeCamera = (action: TwinCameraAction) => { setCameraRequest((previous) => ({ serial: previous.serial + 1, action })); if (action !== 'zoom-in' && action !== 'zoom-out') setActiveView(action === 'turn-left' || action === 'turn-right' ? null : action); };
  const select = useCallback((next: TwinLayoutSelection | null) => { setSelection(next); if (!next) { setFocusRoomId(null); setFocusNodeKey(null); } }, []);
  const fitHome = () => { setFocusNodeKey(null); setFocusRoomId(null); setFitRequest((value) => value + 1); };
  const focusRoom = (id: string) => { setFocusNodeKey(null); setFocusRoomId(id); setFitRequest((value) => value + 1); };
  const focusSelection = useCallback((next: TwinLayoutSelection) => {
    const node = next.kind === 'node' ? geometry.nodes.find((node) => `${node.nodeType}:${node.nodeId}` === next.id) : undefined;
    const room = geometry.rooms.find((item) => item.roomId === (next.kind === 'room' ? next.id : node?.roomId));
    setSelection(next); setTreeOpen(false); setFocusNodeKey(next.kind === 'node' ? next.id : null); setFocusRoomId(next.kind === 'room' ? next.id : null);
    if (room) { setActiveFloor(room.floor ?? 1); setMode('single'); }
    setFitRequest((value) => value + 1);
  }, [geometry]);
  const chooseFloor = (floor: number | 'all') => { setActiveFloor(floor); setMode(floor === 'all' ? 'house' : 'single'); setSelection(null); fitHome(); };
  const chooseMode = (next: TwinFloorMode) => { setMode(next); setActiveFloor(next === 'single' ? resolvedFloor === 'all' ? floors[0] : resolvedFloor : 'all'); setSelection(null); fitHome(); };
  if (!geometry.rooms.length) return <section aria-label="Chế độ 3D" className="surface-card p-8 text-center sm:p-12"><House className="mx-auto text-primary" size={32} /><h2 className="mt-4 text-xl font-semibold text-text">Chưa có sơ đồ nhà</h2><p className="mt-2 text-sm text-muted">Các phòng hiện có chưa được đặt lên Digital Twin.</p>{role === 'OWNER' ? <div className="mt-5 flex justify-center"><TwinLayoutButton variant="primary" leadingIcon={<LayoutDashboard size={18} />} onClick={onEdit2D}>Thiết kế sơ đồ</TwinLayoutButton></div> : <p className="mt-4 text-sm text-muted">Chủ nhà chưa thiết lập sơ đồ Digital Twin.</p>}<p className="mt-4 text-xs text-muted">Unplaced · {unplacedRooms} phòng · {unplaced.deviceIds.length} thiết bị · {unplaced.sensorIds.length} cảm biến</p><details className="mt-4 text-left"><summary className="cursor-pointer text-sm text-primary-hover">Đọc dữ liệu trực tiếp</summary><TwinContent /></details></section>;
  if (!supported || sceneError || !palette) return <section role="alert" aria-label="Không thể mở chế độ 3D" className="surface-card border-error bg-error-soft p-6 text-center"><Box className="mx-auto text-muted" /><h2 className="mt-4 font-semibold text-text">Không thể khởi tạo trình xem 3D.</h2><p className="mt-2 text-sm text-muted">WebGL có thể đang bị tắt hoặc thiết bị không hỗ trợ chế độ này. Sơ đồ 2D vẫn hoạt động bình thường.</p><div className="mt-5 flex justify-center"><TwinLayoutButton variant="primary" onClick={onEdit2D}>Chuyển sang 2D</TwinLayoutButton></div><details className="mt-4"><summary>Đọc dữ liệu trực tiếp</summary><TwinContent /></details></section>;
  return <section aria-label="Chế độ 3D" className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-surface p-2 shadow-soft">
      <ViewOptions label="Bố trí tầng" value={mode} onChange={chooseMode} options={[{ value: 'house', label: 'Ngôi nhà' }, { value: 'single', label: 'Một tầng' }, { value: 'exploded', label: 'Tách tầng' }]} />
      <div className="flex flex-wrap gap-2"><ViewOptions label="Tường" value={wallMode} onChange={setWallMode} options={[{ value: 'auto', label: 'Tường tự động' }, { value: 'cut', label: 'Cắt tường' }]} /><ViewOptions label="Marker" value={markerMode} onChange={setMarkerMode} options={[{ value: 'important', label: 'Quan trọng' }, { value: 'all', label: 'Tất cả' }, { value: 'none', label: 'Ẩn marker' }]} /></div>
    </div>
    <ViewOptions label="Theme renderer" value={theme} onChange={setTheme} options={[{value:'DAYLIGHT',label:'Daylight'},{value:'BLUEPRINT',label:'Blueprint'},{value:'NIGHT',label:'Night'}]} />
    <div className={`grid min-w-0 gap-3 ${selection ? 'xl:grid-cols-[minmax(0,1fr)_20rem]' : ''}`}>
      <div className="twin-3d-stage relative min-w-0 overflow-hidden rounded-3xl border border-line bg-app shadow-soft" data-theme={theme} data-floor-mode={mode} data-wall-mode={wallMode} data-marker-mode={markerMode}>
        {!ready ? <div role="status" className="absolute inset-0 z-50 flex items-center justify-center bg-app text-sm text-muted">Đang dựng không gian 3D…</div> : null}
        <Twin3DErrorBoundary onError={setSceneError}><Twin3DCanvas geometry={geometry} drafting={drafting} activeFloor={resolvedFloor} mode={mode} wallMode={wallMode} markerMode={markerMode} selection={selection} fitRequest={fitRequest} cameraRequest={cameraRequest} focusRoomId={focusRoomId} focusNodeKey={focusNodeKey} compact={compact} palette={palette} theme={theme} heatmapMode={heatmapMode} onSelect={select} onFocus={focusSelection} onReady={handleReady} onCameraInteract={handleCameraInteract} /></Twin3DErrorBoundary>
        <div className="absolute left-3 top-3 z-40"><TwinFloorNavigation geometry={geometry} drafting={drafting} value={mode === 'single' ? resolvedFloor : 'all'} onChange={chooseFloor} /></div>
        <button type="button" aria-label="Danh sách phòng và thiết bị" aria-expanded={treeOpen} onClick={() => setTreeOpen((open) => !open)} className="absolute right-3 top-3 z-40 flex h-11 items-center gap-2 rounded-xl border border-line bg-surface/95 px-3 text-xs font-semibold text-text shadow-soft"><ListTree size={17} />Khám phá</button>
        {treeOpen ? <div className="absolute bottom-20 right-3 top-16 z-40 w-64 overflow-auto rounded-2xl shadow-float"><TwinSidebar geometry={geometry} selection={selection} onFocus={focusSelection} /></div> : null}
        <div className="absolute bottom-3 left-3 right-3 z-40 flex flex-wrap items-end justify-between gap-2"><div className="flex gap-1 rounded-xl border border-line bg-surface/95 p-1 shadow-soft"><TwinLayoutButton aria-label="Đưa mô hình vừa màn hình" leadingIcon={<Crosshair size={16} />} onClick={fitHome}>Vừa nhà</TwinLayoutButton><TwinLayoutButton aria-label="Reset góc nhìn" leadingIcon={<RotateCcw size={16} />} onClick={() => { fitHome(); changeCamera('isometric'); }}>Home</TwinLayoutButton></div><TwinHeatmapToolbar value={heatmapMode} onChange={setHeatmapMode} /></div>
      </div>
      {selection ? <aside className="twin-inspector-enter min-w-0"><div className="mb-2 flex items-center justify-between px-1"><span className="text-xs font-semibold text-muted">Chi tiết đang chọn</span><button type="button" aria-label="Đóng chi tiết" onClick={() => select(null)} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:bg-sidebar-hover"><X size={17} /></button></div><div className="twin-3d-panel overflow-y-auto"><Twin3DInspector geometry={visibleGeometry} selection={selection} onSelect={select} onEdit2D={onEdit2D} canEdit={role === 'OWNER'} onFocusRoom={focusRoom} onFitHome={fitHome} /></div></aside> : null}
    </div>
    <Twin3DCameraControls activeView={activeView} onChange={changeCamera} />
    <p className="text-xs leading-5 text-muted">Kéo để xoay · Cuộn để zoom · Nhấp đúp để focus. Chỉnh sửa và lưu kiến trúc trong chế độ 2D.{unplacedRooms + unplaced.deviceIds.length + unplaced.sensorIds.length ? ` Chưa đặt: ${unplacedRooms} phòng, ${unplaced.deviceIds.length} thiết bị, ${unplaced.sensorIds.length} cảm biến.` : ''}</p>
  </section>;
}
