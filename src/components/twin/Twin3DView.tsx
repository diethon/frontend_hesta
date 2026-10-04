import { Component, useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Activity, Box, Cpu, Crosshair, House, Layers3, LayoutDashboard, RotateCcw, UnfoldVertical } from 'lucide-react';
import { useAppSelector } from '../../store/hooks';
import type { TwinLayoutGeometry, TwinLayoutSelection } from '../../types/twinLayout';
import { Twin3DCanvas } from './Twin3DCanvas';
import { Twin3DInspector } from './Twin3DInspector';
import { TwinFloorSelect } from './TwinFloorSelect';
import { TwinLayoutButton } from './TwinLayoutButton';
import { readTwin3DPalette } from './twin3dPalette';
import { geometryForFloor, layoutFloors, resolvePlacedNodes, resolveUnplacedNodes } from './twin3dGeometry';
import { supportsWebGL } from './twin3dSupport';
import type { TwinDraftingMetadata } from './twinDrafting';
import { selectTwinHealthCounts } from '../../store/twinSelectors';
import { TwinContent } from './TwinContent';
import { Twin3DCameraControls } from './Twin3DCameraControls';
import type { TwinCameraAction, TwinCameraRequest, TwinCameraView } from './twin3dCamera';

const subscribeCompact = (callback: () => void) => {
  const media = window.matchMedia('(max-width: 767px)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};

class Twin3DErrorBoundary extends Component<{ children: ReactNode; onError: (error: Error) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.onError(error); }
  render() { return this.state.failed ? null : this.props.children; }
}

function Stat({ icon, value, label, tone }: { icon: ReactNode; value: number; label: string; tone: 'info' | 'success' | 'warning' | 'off' }) {
  const tones = { info: 'bg-info-soft text-primary-hover', success: 'bg-success-soft text-mint-hover', warning: 'bg-warning-soft text-warning', off: 'bg-off-soft text-muted' };
  return <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-soft"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</span><span className="min-w-0"><strong className="block text-lg leading-none text-text">{value}</strong><small className="mt-1 block truncate text-muted">{label}</small></span></div>;
}

export function Twin3DView({ geometry, drafting, role, onEdit2D }: {
  geometry: TwinLayoutGeometry;
  drafting: TwinDraftingMetadata;
  role: 'OWNER' | 'MEMBER' | null;
  onEdit2D: () => void;
}) {
  const deviceIds = useAppSelector((state) => state.twin.deviceIds);
  const roomIds = useAppSelector((state) => state.twin.roomIds);
  const sensorIds = useAppSelector((state) => state.twin.sensorIds);
  const health = useAppSelector(selectTwinHealthCounts);
  const [selection, setSelection] = useState<TwinLayoutSelection | null>(null);
  const [fitRequest, setFitRequest] = useState(0);
  const [cameraRequest, setCameraRequest] = useState<TwinCameraRequest>({ serial: 0, action: 'isometric' });
  const [activeView, setActiveView] = useState<TwinCameraView | null>('isometric');
  const [focusRoomId, setFocusRoomId] = useState<string | null>(null);
  const [activeFloor, setActiveFloor] = useState<number | 'all'>('all');
  const [exploded, setExploded] = useState(true);
  const [ready, setReady] = useState(false);
  const [sceneError, setSceneError] = useState<Error | null>(null);
  const supported = useMemo(() => supportsWebGL(), []);
  const compact = useSyncExternalStore(subscribeCompact, () => window.matchMedia('(max-width: 767px)').matches, () => true);
  const palette = useMemo(() => supported ? readTwin3DPalette() : null, [supported]);
  const placed = useMemo(() => resolvePlacedNodes(geometry, deviceIds, sensorIds), [deviceIds, geometry, sensorIds]);
  const unplaced = useMemo(() => resolveUnplacedNodes(geometry, deviceIds, sensorIds), [deviceIds, geometry, sensorIds]);
  const unplacedRooms = roomIds.filter((id) => !geometry.rooms.some((room) => room.roomId === id)).length;
  const floors = useMemo(() => layoutFloors(geometry.rooms), [geometry.rooms]);
  const resolvedActiveFloor = activeFloor !== 'all' && !floors.includes(activeFloor) ? 'all' : activeFloor;
  const visibleGeometry = useMemo(() => geometryForFloor(geometry, resolvedActiveFloor), [geometry, resolvedActiveFloor]);
  const resolvedFocusRoomId = visibleGeometry.rooms.some((room) => room.roomId === focusRoomId) ? focusRoomId : null;
  const handleReady = useCallback(() => setReady(true), []);
  const handleCameraInteract = useCallback(() => setActiveView(null), []);
  const changeCamera = (action: TwinCameraAction) => {
    setCameraRequest((previous) => ({ serial: previous.serial + 1, action }));
    setActiveView(action === 'turn-left' || action === 'turn-right' ? null : action);
  };
  const select = useCallback((next: TwinLayoutSelection | null) => {
    setSelection(next);
    if (next?.kind === 'room') setFocusRoomId(next.id);
    if (!next) setFocusRoomId(null);
  }, []);
  const fitHome = () => { setFocusRoomId(null); setFitRequest((value) => value + 1); };
  const focusRoom = (id: string) => { setFocusRoomId(id); setFitRequest((value) => value + 1); };

  const chooseFloor = (floor: number | 'all') => {
    setActiveFloor(floor);
    setSelection(null);
    setFocusRoomId(null);
    setFitRequest((value) => value + 1);
  };

  const toggleExploded = () => {
    setExploded((value) => !value);
    setFocusRoomId(null);
    setFitRequest((value) => value + 1);
  };

  if (!geometry.rooms.length) return <section aria-label="Chế độ 3D" className="surface-card p-8 text-center sm:p-12">
    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-info-soft text-primary-hover"><House size={28} aria-hidden="true" /></span>
    <h2 className="mt-4 text-xl font-semibold text-text">Chưa có sơ đồ nhà</h2>
    <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">Các phòng hiện có chưa được đặt lên Digital Twin.</p>
    {role === 'OWNER' ? <div className="mt-5 flex justify-center"><TwinLayoutButton variant="primary" leadingIcon={<LayoutDashboard size={18} />} onClick={onEdit2D}>Thiết kế sơ đồ</TwinLayoutButton></div> : <p className="mt-4 text-sm font-medium text-muted">Chủ nhà chưa thiết lập sơ đồ Digital Twin.</p>}
    <p className="mt-4 text-sm text-muted">Unplaced · {unplacedRooms} phòng · {unplaced.deviceIds.length} thiết bị · {unplaced.sensorIds.length} cảm biến</p>
    <details className="mt-4 text-left"><summary className="cursor-pointer text-sm font-semibold text-primary-hover">Đọc dữ liệu trực tiếp</summary><div className="mt-4"><TwinContent /></div></details>
  </section>;

  if (!supported || sceneError || !palette) return <section role="alert" aria-label="Không thể mở chế độ 3D" className="surface-card border-error bg-error-soft p-6 text-center">
    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-surface text-muted"><Box size={24} aria-hidden="true" /></span>
    <h2 className="mt-4 font-semibold text-text">Không thể khởi tạo trình xem 3D.</h2>
    <p className="mt-2 text-sm text-muted">WebGL có thể đang bị tắt hoặc thiết bị không hỗ trợ chế độ này. Sơ đồ 2D vẫn hoạt động bình thường.</p>
    <div className="mt-5 flex justify-center"><TwinLayoutButton variant="primary" onClick={onEdit2D}>Chuyển sang 2D</TwinLayoutButton></div>
    <details className="mt-4 text-left"><summary className="cursor-pointer text-sm font-semibold text-primary-hover">Đọc dữ liệu trực tiếp</summary><div className="mt-4"><TwinContent /></div></details>
  </section>;

  const unplacedCount = unplacedRooms + unplaced.deviceIds.length + unplaced.sensorIds.length;
  return <section aria-label="Chế độ 3D" className="space-y-4">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat icon={<Layers3 size={20} aria-hidden="true" />} value={floors.length} label={`${geometry.rooms.length} phòng`} tone="info" />
      <Stat icon={<Cpu size={20} aria-hidden="true" />} value={placed.length} label="Marker đã đặt" tone="success" />
      <Stat icon={<Activity size={20} aria-hidden="true" />} value={health.ACTIVE} label="A · ACTIVE" tone="success" />
      <Stat icon={<Activity size={20} aria-hidden="true" />} value={health.STALE + health.OFFLINE} label={`! ${health.STALE} STALE · × ${health.OFFLINE} OFFLINE`} tone="warning" />
    </div>
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-surface p-2 shadow-soft">
          <TwinFloorSelect floors={floors} value={resolvedActiveFloor} variant="segmented" ariaLabel="Chọn tầng trong mô hình 3D" onChange={chooseFloor} />
          {floors.length > 1 ? <div aria-label="Bố trí tầng" className="flex flex-wrap gap-1 rounded-xl bg-app p-1">{([false, true] as const).map((separated) => <button key={String(separated)} type="button" aria-pressed={exploded === separated} disabled={resolvedActiveFloor !== 'all'} onClick={() => { if (exploded !== separated) toggleExploded(); }} className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-semibold disabled:opacity-40 ${exploded === separated ? 'bg-surface text-primary-hover shadow-soft' : 'text-muted hover:bg-sidebar-hover'}`}><UnfoldVertical size={15} aria-hidden="true" />{separated ? 'Tách tầng' : 'Xếp chồng'}</button>)}</div> : null}
        </div>
        <Twin3DCameraControls activeView={activeView} onChange={changeCamera} />
        <div className="twin-3d-stage relative overflow-hidden rounded-3xl border border-line bg-app shadow-float">
          {!ready ? <div role="status" className="absolute inset-0 z-20 flex items-center justify-center bg-app"><div className="text-center"><span className="mx-auto block h-10 w-10 animate-pulse rounded-2xl bg-primary" /><p className="mt-3 text-sm font-semibold text-muted">Đang dựng không gian 3D…</p></div></div> : null}
          <span className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-lg bg-surface/90 px-3 py-2 text-[10px] text-muted">{compact ? 'Kéo để xoay 360° · Chụm hai ngón để zoom' : 'Kéo để xoay 360° · Cuộn để thu phóng'}</span>
          <Twin3DErrorBoundary onError={setSceneError}><Twin3DCanvas geometry={geometry} drafting={drafting} activeFloor={resolvedActiveFloor} exploded={exploded} selection={selection} fitRequest={fitRequest} cameraRequest={cameraRequest} focusRoomId={resolvedFocusRoomId} compact={compact} palette={palette} onSelect={select} onReady={handleReady} onCameraInteract={handleCameraInteract} /></Twin3DErrorBoundary>
        </div>
        <div className="flex flex-wrap gap-2"><TwinLayoutButton aria-label="Đưa mô hình vừa màn hình" leadingIcon={<Crosshair size={17} />} onClick={fitHome}>Vừa ngôi nhà</TwinLayoutButton><TwinLayoutButton leadingIcon={<RotateCcw size={17} />} onClick={() => { setFocusRoomId(null); changeCamera('isometric'); }}>Reset góc nhìn</TwinLayoutButton>{selection ? <TwinLayoutButton onClick={() => select(null)}>Bỏ chọn</TwinLayoutButton> : null}</div>
        <p className="text-xs leading-5 text-muted">Không gian 3D được suy ra từ layout đã lưu; số tầng của mỗi phòng được đồng bộ với Backend. Nội thất, cửa, cửa sổ và cảnh quan là lớp minh họa tự động theo loại phòng.</p>
      </div>
      <aside className="min-w-0 space-y-4">
        <div key={selection ? `${selection.kind}:${selection.id}` : 'none'} className="twin-inspector-enter"><Twin3DInspector geometry={visibleGeometry} selection={selection} onSelect={select} onEdit2D={onEdit2D} canEdit={role === 'OWNER'} onFocusRoom={focusRoom} onFitHome={fitHome} /></div>
        {unplacedCount ? <section aria-label="Đối tượng chưa đặt" className="surface-card p-5"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold text-text">Đối tượng chưa đặt</h3><p className="mt-1 text-xs text-muted">{unplacedRooms} phòng · {unplaced.deviceIds.length} thiết bị · {unplaced.sensorIds.length} cảm biến</p></div><span className="rounded-full bg-warning-soft px-3 py-1 text-sm font-bold text-text">{unplacedCount}</span></div><p className="mt-3 text-sm leading-6 text-muted">Các đối tượng này không được rải ngẫu nhiên vì chưa có tọa độ layout.</p>{role === 'OWNER' ? <TwinLayoutButton leadingIcon={<LayoutDashboard size={18} />} onClick={onEdit2D}>Đặt trong chế độ 2D</TwinLayoutButton> : null}</section> : null}
      </aside>
    </div>
  </section>;
}
