import { Component, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ArrowLeft, Box, Compass, Crosshair, Hand, House, Layers2, LayoutDashboard, Maximize2, Minimize2, Moon, MoveUpRight, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Rotate3D, Sliders, MousePointer2, RotateCcw, SlidersHorizontal, Sun, ZoomIn, ZoomOut } from 'lucide-react';
import { useAppSelector } from '../../store/hooks';
import type { TwinLayoutGeometry, TwinLayoutSelection } from '../../types/twinLayout';
import type { TwinHeatmapMode } from '../../types/twinView';
import { Twin3DCanvas } from './Twin3DCanvas';
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
import { TwinFloorNavigation } from './TwinFloorNavigation';
import type { TwinFloorMode, TwinWallMode, TwinMarkerMode } from './scene/architectureMaterials';
import { TwinHouseExplorer } from './dashboard/TwinHouseExplorer';
import { TwinControlSidebar } from './dashboard/TwinControlSidebar';
import { TwinAnalytics } from './dashboard/TwinAnalytics';
import { TwinRoomInfo } from './dashboard/TwinRoomInfo';
import { TwinPanelDialog } from './dashboard/TwinPanelDialog';
import { notify } from '../ui/notify';
import { deviceHealthCounts } from './dashboard/twinDashboardData';

const subscribeDesktop = (callback: () => void) => { const media = window.matchMedia('(min-width: 1280px)'); media.addEventListener('change', callback); return () => media.removeEventListener('change', callback); };
const subscribeExplorerDesktop = (callback: () => void) => { const media = window.matchMedia('(min-width: 1024px)'); media.addEventListener('change', callback); return () => media.removeEventListener('change', callback); };
const subscribeCompact = (callback: () => void) => { const media = window.matchMedia('(max-width: 767px)'); media.addEventListener('change', callback); return () => media.removeEventListener('change', callback); };
class Twin3DErrorBoundary extends Component<{ children: ReactNode; onError: (error: Error) => void }, { failed: boolean }> {
  state = { failed: false }; static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.onError(error); }
  render() { return this.state.failed ? null : this.props.children; }
}
function ViewOptions<T extends string>({ label, options, value, onChange }: { label: string; options: readonly { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return <div aria-label={label} className="flex flex-wrap gap-1 rounded-xl bg-app p-1">{options.map((option) => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)} className={`min-h-11 rounded-lg px-3 text-xs font-semibold ${value === option.value ? 'bg-surface text-primary-hover shadow-soft' : 'text-muted hover:bg-sidebar-hover'}`}>{option.label}</button>)}</div>;
}
export function Twin3DView({ geometry, drafting, role, onEdit2D, rendererTheme, onRendererThemeChange }: { geometry: TwinLayoutGeometry; drafting: TwinDraftingMetadata; role: 'OWNER' | 'MEMBER' | null; onEdit2D: () => void; rendererTheme?: TwinRendererTheme; onRendererThemeChange?: (theme: TwinRendererTheme) => void }) {
  const deviceIds = useAppSelector((state) => state.twin.deviceIds), roomIds = useAppSelector((state) => state.twin.roomIds), sensorIds = useAppSelector((state) => state.twin.sensorIds);
  const devicesById = useAppSelector((state) => state.twin.devicesById);
  const roomsById = useAppSelector((state) => state.twin.roomsById);
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const [selection, setSelection] = useState<TwinLayoutSelection | null>(() => {
    const living = geometry.rooms.find(room => /khach|living/.test((roomsById[room.roomId]?.name ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()));
    const initial = living ?? geometry.rooms[0];
    return initial ? { kind: 'room', id: initial.roomId } : null;
  }), [fitRequest, setFitRequest] = useState(0);
  const [cameraRequest, setCameraRequest] = useState<TwinCameraRequest>({ serial: 0, action: 'isometric' }), [activeView, setActiveView] = useState<TwinCameraView | null>('isometric');
  const [focusRoomId, setFocusRoomId] = useState<string | null>(null), [focusNodeKey, setFocusNodeKey] = useState<string | null>(null);
  const [activeFloor, setActiveFloor] = useState<number | 'all'>(() => { const levels = layoutFloors(geometry.rooms); return levels.length > 1 ? levels[0] : 'all'; });
  const [mode, setMode] = useState<TwinFloorMode>(() => layoutFloors(geometry.rooms).length > 1 ? 'single' : 'house');
  const [wallMode, setWallMode] = useState<TwinWallMode>('auto'), [markerMode, setMarkerMode] = useState<TwinMarkerMode>('important');
  const [localTheme, setLocalTheme] = useState<TwinRendererTheme>('DAYLIGHT');
  const theme = rendererTheme ?? localTheme;
  const setTheme = onRendererThemeChange ?? setLocalTheme;
  const [heatmapMode, setHeatmapMode] = useState<TwinHeatmapMode>('normal'), [treeOpen, setTreeOpen] = useState(false);
  const [ready, setReady] = useState(false), [sceneError, setSceneError] = useState<Error | null>(null);
  const [explorerCollapsed, setExplorerCollapsed] = useState(false), [panelOpen, setPanelOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [cameraTool, setCameraTool] = useState<'select' | 'pan' | 'rotate'>('select');
  const homeName = useAppSelector(state => state.twin.home?.name ?? 'Ngôi nhà của bạn');
  const dashboard = useRef<HTMLElement>(null);
  const desktop = useSyncExternalStore(subscribeDesktop, () => window.matchMedia('(min-width: 1280px)').matches, () => true);
  const explorerDesktop = useSyncExternalStore(subscribeExplorerDesktop, () => window.matchMedia('(min-width: 1024px)').matches, () => true);
  useEffect(() => { const update = () => setFullscreen(document.fullscreenElement === dashboard.current); document.addEventListener('fullscreenchange', update); return () => document.removeEventListener('fullscreenchange', update); }, []);
  const toggleFullscreen = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await dashboard.current?.requestFullscreen(); } catch { notify.info('Trình duyệt chưa hỗ trợ toàn màn hình.'); } };
  const selectedRoomId = useAppSelector((state) => selection?.kind === 'room' ? selection.id : selection?.kind === 'node' ? selection.id.startsWith('DEVICE:') ? state.twin.devicesById[selection.id.slice(7)]?.roomId ?? null : state.twin.sensorsById[selection.id.slice(7)]?.roomId ?? null : null);
  const selectedRoomName = useAppSelector(state => selectedRoomId ? state.twin.roomsById[selectedRoomId]?.name : undefined);
  const supported = useMemo(() => supportsWebGL(), []);
  const compact = useSyncExternalStore(subscribeCompact, () => window.matchMedia('(max-width: 767px)').matches, () => true);
  const palette = useMemo(() => supported ? rendererPalette(readApartmentPalette(), theme) : null, [supported,theme]);
  const unplaced = useMemo(() => resolveUnplacedNodes(geometry, deviceIds, sensorIds), [deviceIds, geometry, sensorIds]);
  const unplacedRooms = roomIds.filter((id) => !geometry.rooms.some((room) => room.roomId === id)).length;
  const floors = useMemo(() => layoutFloors(geometry.rooms), [geometry.rooms]);
  const resolvedFloor = activeFloor !== 'all' && !floors.includes(activeFloor) ? floors[0] : activeFloor;
  const visibleGeometry = useMemo(() => geometryForFloor(geometry, mode === 'single' ? resolvedFloor : 'all'), [geometry, resolvedFloor, mode]);
  const activeRooms = visibleGeometry.rooms;
  const scopeRoomIds = useMemo(() => mode === 'single' ? visibleGeometry.rooms.map(room => room.roomId) : undefined, [mode, visibleGeometry]);
  const scopeName = mode === 'single' ? `Tầng ${resolvedFloor}` : undefined;
  const activeDevices = useMemo(() => Object.values(devicesById).filter((device) => !scopeRoomIds || device.roomId !== null && scopeRoomIds.includes(device.roomId)), [devicesById, scopeRoomIds]);
  const health = deviceHealthCounts(activeDevices);
  const onCount = health.on;
  const handleReady = useCallback(() => setReady(true), []), handleCameraInteract = useCallback(() => setActiveView(null), []);
  const changeCamera = (action: TwinCameraAction) => { setCameraRequest((previous) => ({ serial: previous.serial + 1, action })); if (action !== 'zoom-in' && action !== 'zoom-out') setActiveView(action === 'turn-left' || action === 'turn-right' ? null : action); };
  const fitHome = () => { setFocusNodeKey(null); setFocusRoomId(null); setFitRequest((value) => value + 1); };
  const focusRoom = (id: string) => { setFocusNodeKey(null); setFocusRoomId(id); setFitRequest((value) => value + 1); };
  const focusSelection = useCallback((next: TwinLayoutSelection) => {
    const node = next.kind === 'node' ? geometry.nodes.find((node) => `${node.nodeType}:${node.nodeId}` === next.id) : undefined;
    const room = geometry.rooms.find((item) => item.roomId === (next.kind === 'room' ? next.id : node?.roomId));
    setSelection(next); setTreeOpen(false); setControlsCollapsed(false); setFocusNodeKey(next.kind === 'node' ? next.id : null); setFocusRoomId(room?.roomId ?? null);
    if (next.kind === 'node' && !desktop) setPanelOpen(true);
    if (room) { setActiveFloor(room.floor ?? 1); setMode('single'); }
    setFitRequest((value) => value + 1);
  }, [geometry, desktop]);
  const selectExplorerRoom = focusSelection;
  const select = useCallback((next: TwinLayoutSelection | null) => {
    if (next?.kind === 'node') { focusSelection(next); return; }
    setSelection(next); setFocusRoomId(null); setFocusNodeKey(null); if (!next) setPanelOpen(false);
  }, [focusSelection]);
  // A single canvas click selects without moving its target out from under the
  // pointer. Double-click alone requests camera focus, so native double-clicks work.
  const selectInScene = useCallback((next: TwinLayoutSelection | null) => {
    setSelection(next);
    setTreeOpen(false);
    if (next) setControlsCollapsed(false);
    if (next?.kind === 'node' && !desktop) setPanelOpen(true);
  }, [desktop]);
  const chooseFloor = (floor: number | 'all') => { setActiveFloor(floor); setMode(floor === 'all' ? 'house' : 'single'); setSelection(null); fitHome(); };
  const chooseMode = (next: TwinFloorMode) => { setMode(next); setActiveFloor(next === 'single' ? resolvedFloor === 'all' ? floors[0] : resolvedFloor : 'all'); setSelection(null); fitHome(); };
  const returnToOverview = useCallback(() => {
    setFocusNodeKey(null); setFocusRoomId(null); setActiveFloor('all'); setMode('house');
    setPanelOpen(false);
    setFitRequest(value => value + 1); setCameraRequest(previous => ({ serial: previous.serial + 1, action: 'isometric' })); setActiveView('isometric');
  }, []);
  useEffect(() => {
    if (!focusRoomId) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.fullscreenElement || document.querySelector('dialog[open], [role="dialog"]') || event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      returnToOverview();
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [focusRoomId, returnToOverview]);
  if (!geometry.rooms.length) return <section aria-label="Chế độ 3D" className="surface-card p-8 text-center sm:p-12"><House className="mx-auto text-primary" size={32} /><h2 className="mt-4 text-xl font-semibold text-text">Chưa có sơ đồ nhà</h2><p className="mt-2 text-sm text-muted">Các phòng hiện có chưa được đặt lên Digital Twin.</p>{role === 'OWNER' ? <div className="mt-5 flex justify-center"><TwinLayoutButton variant="primary" leadingIcon={<LayoutDashboard size={18} />} onClick={onEdit2D}>Thiết kế sơ đồ</TwinLayoutButton></div> : <p className="mt-4 text-sm text-muted">Chủ nhà chưa thiết lập sơ đồ Digital Twin.</p>}<p className="mt-4 text-xs text-muted">Unplaced · {unplacedRooms} phòng · {unplaced.deviceIds.length} thiết bị · {unplaced.sensorIds.length} cảm biến</p><details className="mt-4 text-left"><summary className="cursor-pointer text-sm text-primary-hover">Đọc dữ liệu trực tiếp</summary><TwinContent /></details></section>;
  if (!supported || sceneError || !palette) return <section role="alert" aria-label="Không thể mở chế độ 3D" className="surface-card border-error bg-error-soft p-6 text-center"><Box className="mx-auto text-muted" /><h2 className="mt-4 font-semibold text-text">Không thể khởi tạo trình xem 3D.</h2><p className="mt-2 text-sm text-muted">WebGL có thể đang bị tắt hoặc thiết bị không hỗ trợ chế độ này. Sơ đồ 2D vẫn hoạt động bình thường.</p><div className="mt-5 flex justify-center"><TwinLayoutButton variant="primary" onClick={onEdit2D}>Chuyển sang 2D</TwinLayoutButton></div><details className="mt-4"><summary>Đọc dữ liệu trực tiếp</summary><TwinContent /></details></section>;
  const explorer = <TwinHouseExplorer geometry={geometry} selection={selection} activeFloor={mode === 'single' ? resolvedFloor : 'all'} onFloorChange={(floor) => { chooseFloor(floor); setTreeOpen(false); }} onFocus={focusSelection} onSelect={selectExplorerRoom} />;
  const controls = <TwinControlSidebar geometry={visibleGeometry} selection={selection} onSelect={select} onEdit2D={onEdit2D} canEdit={role === 'OWNER'} onFocusRoom={focusRoom} onFitHome={fitHome} scopeRoomIds={scopeRoomIds} scopeName={scopeName} />;
  const closeControls = () => { select(null); setPanelOpen(false); };
  return <section ref={dashboard} aria-label="Chế độ 3D" className="twin-dashboard-view twin-v2-view min-w-0">
    <div className="v2-compact-actions">
      {!explorerDesktop ? <button type="button" aria-label="Danh sách tầng và phòng" aria-expanded={treeOpen} onClick={() => setTreeOpen(true)} className="v2-secondary-button"><PanelLeftOpen size={16} />Sơ đồ nhà</button> : null}
      {!desktop ? <button type="button" aria-label="Mở điều khiển thông minh" onClick={() => setPanelOpen(true)} className="v2-secondary-button"><Sliders size={16} />Điều khiển</button> : null}
    </div>
    <div className="v2-workbench" data-explorer-collapsed={explorerCollapsed} data-controls-collapsed={controlsCollapsed} data-has-explorer={explorerDesktop} data-has-controls={desktop}>
      {explorerDesktop ? <aside aria-label="Sơ đồ nhà" className={`v2-side-panel v2-explorer-panel ${explorerCollapsed ? 'v2-collapsed-panel' : ''}`}>
        <div className="v2-panel-heading">{!explorerCollapsed ? <span>SƠ ĐỒ NHÀ</span> : null}<button type="button" aria-label={explorerCollapsed ? 'Mở bảng sơ đồ nhà' : 'Thu gọn bảng sơ đồ nhà'} aria-expanded={!explorerCollapsed} onClick={() => setExplorerCollapsed(value => !value)} className="v2-icon-button">{explorerCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button></div>
        {explorerCollapsed ? <><House size={23} className="text-primary-hover" /><span className="v2-vertical-label">SƠ ĐỒ NHÀ</span></> : explorer}
      </aside> : null}
      <section className="twin-3d-stage v2-scene-stage" aria-label="Mô hình nhà 3D tương tác" data-theme={theme} data-floor-mode={mode} data-wall-mode={wallMode} data-marker-mode={markerMode}>
        {!ready ? <div role="status" className="v2-scene-loading"><Box size={30} /><strong>Đang dựng không gian của bạn</strong><span>Ánh sáng, vật liệu và những chi tiết nhỏ…</span></div> : null}
        <Twin3DErrorBoundary onError={setSceneError}><Twin3DCanvas geometry={geometry} drafting={drafting} activeFloor={resolvedFloor} mode={mode} wallMode={wallMode} markerMode={markerMode} selection={selection} fitRequest={fitRequest} cameraRequest={cameraRequest} focusRoomId={focusRoomId} focusNodeKey={focusNodeKey} compact={compact} palette={palette} theme={theme} heatmapMode={heatmapMode} tool={cameraTool} onSelect={selectInScene} onFocus={focusSelection} onReady={handleReady} onCameraInteract={handleCameraInteract} /></Twin3DErrorBoundary>
        <div className={`v2-scene-topline ${focusRoomId ? 'v2-room-detail' : ''}`}>
          {focusRoomId ? <button type="button" aria-label="Quay lại toàn cảnh" onClick={returnToOverview} className="v2-return-overview"><ArrowLeft size={18} aria-hidden="true" /><span>Quay lại toàn cảnh</span><kbd aria-hidden="true">Esc</kbd></button> : null}
          <div className="v2-view-selector">
            <Box size={17} aria-hidden="true" />
            <strong>Không gian 3D</strong>
            <span className="v2-view-separator" />
            <div className="v2-floor-tabs" role="group" aria-label="Chọn góc nhìn">
              <button type="button" aria-pressed={activeView === 'isometric'} onClick={() => changeCamera('isometric')}>Phối cảnh</button>
              <button type="button" aria-pressed={activeView === 'front'} onClick={() => changeCamera('front')}>Mặt trước</button>
              <button type="button" aria-pressed={activeView === 'top'} onClick={() => changeCamera('top')}>Từ trên</button>
            </div>
            <span className="v2-view-separator" />
            <Layers2 size={15} aria-hidden="true" />
            <div className="v2-floor-tabs" role="group" aria-label="Chọn tầng nhanh">{[{ value: 'all' as const, label: 'Tổng thể' }, ...floors.map(floor => ({ value: floor, label: `Tầng ${floor}` }))].map(({ value, label }) => <button key={value} type="button" aria-pressed={value === (mode === 'single' ? resolvedFloor : 'all')} onClick={() => chooseFloor(value)}>{label}</button>)}</div>
          </div>
          {!focusRoomId ? <button type="button" className="v2-overview-button" onClick={returnToOverview}>Toàn cảnh<MoveUpRight size={14} /></button> : null}
          {explorerDesktop || desktop ? <button type="button" aria-label={explorerCollapsed && controlsCollapsed ? 'Hiện đầy đủ bảng điều khiển' : 'Mở rộng tối đa không gian 3D'} className="v2-overview-button" onClick={() => {
            const next = !(explorerCollapsed && controlsCollapsed);
            setExplorerCollapsed(next);
            setControlsCollapsed(next);
          }}>
            {explorerCollapsed && controlsCollapsed ? 'Thu gọn bảng' : 'Mở rộng xem'}
            {explorerCollapsed && controlsCollapsed ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button> : null}
        </div>
        <div className="v2-scene-caption"><span>{homeName}</span><p>{focusRoomId ? `Cận cảnh · ${selectedRoomName ?? 'Phòng đang chọn'}` : mode === 'single' ? `Tầng ${resolvedFloor} · ${activeRooms.length} không gian` : mode === 'exploded' ? 'Khám phá không gian · Tách tầng' : 'Toàn cảnh ngôi nhà'}</p></div>
        <div className="v2-compass" aria-label="La bàn minh họa, không phải hướng đo thực tế"><span>N</span><Compass size={37} strokeWidth={1} /></div>
        <div className="v2-scene-environment">{theme === 'NIGHT' ? <Moon size={15} /> : <Sun size={15} />}<span>{theme === 'NIGHT' ? 'Ánh sáng ban đêm' : 'Ánh sáng ban ngày'}</span></div>
        <div className="v2-scene-toolbar" role="toolbar" aria-label="Công cụ camera 3D">
          <button type="button" aria-label="Chọn phòng" aria-pressed={cameraTool === 'select'} className="v2-icon-button" onClick={() => { setCameraTool('select'); setMarkerMode('all'); }}><MousePointer2 size={18} /></button>
          <button type="button" aria-label="Di chuyển camera" aria-pressed={cameraTool === 'pan'} className="v2-icon-button" onClick={() => setCameraTool('pan')}><Hand size={18} /></button>
          <button type="button" aria-label="Xoay mô hình" aria-pressed={cameraTool === 'rotate'} className="v2-icon-button" onClick={() => setCameraTool('rotate')}><Rotate3D size={18} /></button>
          <span className="v2-toolbar-divider" />
          <button type="button" aria-label="Phóng to mô hình" className="v2-icon-button" onClick={() => changeCamera('zoom-in')}><ZoomIn size={18} /></button>
          <button type="button" aria-label="Thu nhỏ mô hình" className="v2-icon-button" onClick={() => changeCamera('zoom-out')}><ZoomOut size={18} /></button>
          <button type="button" aria-label="Reset góc nhìn" className="v2-icon-button" onClick={returnToOverview}><RotateCcw size={18} /></button>
          <span className="v2-toolbar-divider" />
          <button type="button" aria-label={theme === 'NIGHT' ? 'Chuyển sang ban ngày' : 'Chuyển sang ban đêm'} aria-pressed={theme === 'NIGHT'} className="v2-icon-button" onClick={() => setTheme(theme === 'NIGHT' ? 'DAYLIGHT' : 'NIGHT')}>{theme === 'NIGHT' ? <Moon size={18} /> : <Sun size={18} />}</button>
          <button type="button" aria-label="Toàn màn hình mô hình" aria-pressed={fullscreen} disabled={!document.fullscreenEnabled} className="v2-icon-button" onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
        </div>
        <div className="v2-scene-hint"><MousePointer2 size={12} /><span>Kéo để {cameraTool === 'pan' ? 'di chuyển' : 'xoay'} · Cuộn để thu phóng · Nhấp đúp để xem gần</span></div>
      </section>
      {desktop ? <aside aria-label="Bảng điều khiển ngôi nhà" className={`v2-side-panel v2-device-panel ${controlsCollapsed ? 'v2-collapsed-panel' : ''}`}>
        <div className="v2-panel-heading">{!controlsCollapsed ? <span>ĐIỀU KHIỂN THIẾT BỊ</span> : null}<button type="button" aria-label="Ẩn hoặc hiện bảng điều khiển" aria-expanded={!controlsCollapsed} onClick={() => setControlsCollapsed(value => !value)} className="v2-icon-button">{controlsCollapsed ? <PanelRightOpen size={17} /> : <PanelRightClose size={17} />}</button></div>
        {controlsCollapsed ? <><Sliders size={23} className="text-primary-hover" /><span className="v2-vertical-label">ĐIỀU KHIỂN</span></> : controls}
      </aside> : null}
    </div>
    {unplacedRooms + unplaced.deviceIds.length + unplaced.sensorIds.length ? <p className="v2-unplaced-note">Chưa đặt: {unplacedRooms} phòng · {unplaced.deviceIds.length} thiết bị · {unplaced.sensorIds.length} cảm biến.</p> : null}
    <TwinAnalytics roomId={selectedRoomId} scopeRoomIds={scopeRoomIds} scopeName={scopeName} />
    <footer className="v2-workspace-footer"><span><span className="v2-status-dot" />Phòng & thiết bị từ HESTA<span className="v2-footer-dot">·</span>{onCount} thiết bị đang bật</span><span>HESTA DIGITAL TWIN <strong>V2.0</strong></span></footer>
        <details className="v2-advanced">
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

    {!explorerDesktop ? <TwinPanelDialog open={treeOpen} title="Sơ đồ nhà" side="left" onDismiss={() => setTreeOpen(false)}>{explorer}</TwinPanelDialog> : null}
    {!desktop ? <TwinPanelDialog open={panelOpen} title="Điều khiển thiết bị" side="right" onDismiss={closeControls}>{controls}<div className="p-3"><TwinRoomInfo roomId={selectedRoomId} geometry={geometry} /></div></TwinPanelDialog> : null}
  </section>;
}
