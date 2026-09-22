import { Component, useCallback, useMemo, useState, type ReactNode } from 'react';
import { Activity, Box, Cpu, Crosshair, House, Layers3, LayoutDashboard, UnfoldVertical, WifiOff } from 'lucide-react';
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
  const sensorIds = useAppSelector((state) => state.twin.sensorIds);
  const active = useAppSelector((state) => state.twin.deviceIds.filter((id) => state.twin.devicesById[id]?.healthStatus === 'ACTIVE').length
    + state.twin.sensorIds.filter((id) => state.twin.sensorsById[id]?.healthStatus === 'ACTIVE').length);
  const unavailable = useAppSelector((state) => state.twin.deviceIds.filter((id) => state.twin.devicesById[id]?.healthStatus === 'OFFLINE').length
    + state.twin.sensorIds.filter((id) => state.twin.sensorsById[id]?.healthStatus === 'OFFLINE').length);
  const [selection, setSelection] = useState<TwinLayoutSelection | null>(null);
  const [fitRequest, setFitRequest] = useState(0);
  const [activeFloor, setActiveFloor] = useState<number | 'all'>('all');
  const [exploded, setExploded] = useState(true);
  const [ready, setReady] = useState(false);
  const [sceneError, setSceneError] = useState<Error | null>(null);
  const supported = useMemo(() => supportsWebGL(), []);
  const compact = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches, []);
  const palette = useMemo(() => supported ? readTwin3DPalette() : null, [supported]);
  const placed = useMemo(() => resolvePlacedNodes(geometry, deviceIds, sensorIds), [deviceIds, geometry, sensorIds]);
  const unplaced = useMemo(() => resolveUnplacedNodes(geometry, deviceIds, sensorIds), [deviceIds, geometry, sensorIds]);
  const floors = useMemo(() => layoutFloors(geometry.rooms), [geometry.rooms]);
  const resolvedActiveFloor = activeFloor !== 'all' && !floors.includes(activeFloor) ? 'all' : activeFloor;
  const visibleGeometry = useMemo(() => geometryForFloor(geometry, resolvedActiveFloor), [geometry, resolvedActiveFloor]);
  const handleReady = useCallback(() => setReady(true), []);

  const chooseFloor = (floor: number | 'all') => {
    setActiveFloor(floor);
    setSelection(null);
    setFitRequest((value) => value + 1);
  };

  const toggleExploded = () => {
    setExploded((value) => !value);
    setFitRequest((value) => value + 1);
  };

  if (!geometry.rooms.length) return <section aria-label="Chế độ 3D" className="surface-card p-8 text-center sm:p-12">
    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-info-soft text-primary-hover"><House size={28} aria-hidden="true" /></span>
    <h2 className="mt-4 text-xl font-semibold text-text">Chưa có sơ đồ nhà.</h2>
    <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">Viewer 3D cần các phòng từ sơ đồ 2D đã lưu để tạo không gian trực quan.</p>
    {role === 'OWNER' ? <div className="mt-5 flex justify-center"><TwinLayoutButton variant="primary" leadingIcon={<LayoutDashboard size={18} />} onClick={onEdit2D}>Thiết kế trong chế độ 2D</TwinLayoutButton></div> : <p className="mt-4 text-sm font-medium text-muted">Chủ nhà chưa thiết kế sơ đồ 2D.</p>}
  </section>;

  if (!supported || sceneError || !palette) return <section role="alert" aria-label="Không thể mở chế độ 3D" className="surface-card border-error bg-error-soft p-6 text-center">
    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-surface text-muted"><Box size={24} aria-hidden="true" /></span>
    <h2 className="mt-4 font-semibold text-text">Không thể khởi tạo trình xem 3D.</h2>
    <p className="mt-2 text-sm text-muted">WebGL có thể đang bị tắt hoặc thiết bị không hỗ trợ chế độ này. Sơ đồ 2D vẫn hoạt động bình thường.</p>
    <div className="mt-5 flex justify-center"><TwinLayoutButton variant="primary" onClick={onEdit2D}>Chuyển sang 2D</TwinLayoutButton></div>
  </section>;

  const unplacedCount = unplaced.deviceIds.length + unplaced.sensorIds.length;
  return <section aria-label="Chế độ 3D" className="space-y-4">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat icon={<Layers3 size={20} aria-hidden="true" />} value={floors.length} label={`${geometry.rooms.length} phòng`} tone="info" />
      <Stat icon={<Cpu size={20} aria-hidden="true" />} value={placed.length} label="Marker đã đặt" tone="success" />
      <Stat icon={<Activity size={20} aria-hidden="true" />} value={active} label="Đang hoạt động" tone="warning" />
      <Stat icon={<WifiOff size={20} aria-hidden="true" />} value={unavailable} label="Ngoại tuyến" tone="off" />
    </div>
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-3">
        <div className="twin-3d-stage relative overflow-hidden rounded-3xl border border-line bg-app shadow-float">
          {!ready ? <div role="status" className="absolute inset-0 z-20 flex items-center justify-center bg-app"><div className="text-center"><span className="mx-auto block h-10 w-10 animate-pulse rounded-2xl bg-primary" /><p className="mt-3 text-sm font-semibold text-muted">Đang dựng không gian 3D…</p></div></div> : null}
          <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-xl border border-line bg-surface/90 px-3 py-2 shadow-soft"><strong className="block text-xs text-text">{resolvedActiveFloor === 'all' ? 'Toàn bộ ngôi nhà' : `Tầng ${resolvedActiveFloor}`}</strong><span className="text-[10px] text-muted">Kéo để xoay · Cuộn để thu phóng</span></div>
          {floors.length > 1 ? <div className="absolute right-3 top-20 z-10 sm:top-3"><TwinFloorSelect floors={floors} value={resolvedActiveFloor} ariaLabel="Chọn tầng trong mô hình 3D" onChange={chooseFloor} /></div> : null}
          <Twin3DErrorBoundary onError={setSceneError}><Twin3DCanvas geometry={geometry} drafting={drafting} activeFloor={resolvedActiveFloor} exploded={exploded} selection={selection} fitRequest={fitRequest} compact={compact} palette={palette} onSelect={setSelection} onReady={handleReady} /></Twin3DErrorBoundary>
          <div className="absolute bottom-3 left-3 z-10 flex gap-2"><button type="button" aria-label="Đưa mô hình vừa màn hình" onClick={() => setFitRequest((value) => value + 1)} className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface/95 px-3 text-sm font-semibold text-text shadow-soft hover:bg-sidebar-hover"><Crosshair size={17} aria-hidden="true" />Vừa ngôi nhà</button>{selection ? <button type="button" onClick={() => setSelection(null)} className="min-h-11 rounded-xl border border-line bg-surface/95 px-3 text-sm font-semibold text-muted shadow-soft hover:bg-sidebar-hover">Bỏ chọn</button> : null}</div>
          {floors.length > 1 && resolvedActiveFloor === 'all' ? <button type="button" aria-label={exploded ? 'Xếp chồng các tầng' : 'Tách các tầng'} aria-pressed={exploded} onClick={toggleExploded} className="absolute bottom-3 right-3 z-10 flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface/95 px-3 text-sm font-semibold text-text shadow-soft hover:bg-sidebar-hover"><UnfoldVertical size={17} aria-hidden="true" /><span className="hidden sm:inline">{exploded ? 'Xếp chồng' : 'Tách tầng'}</span></button> : null}
        </div>
        <p className="text-xs leading-5 text-muted">Không gian 3D được suy ra từ layout đã lưu; số tầng của mỗi phòng được đồng bộ với Backend. Nội thất, cửa, cửa sổ và cảnh quan là lớp minh họa tự động theo loại phòng.</p>
      </div>
      <aside className="min-w-0 space-y-4">
        <Twin3DInspector geometry={visibleGeometry} selection={selection} onSelect={setSelection} onEdit2D={onEdit2D} />
        {unplacedCount ? <section aria-label="Đối tượng chưa đặt" className="surface-card p-5"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold text-text">Đối tượng chưa đặt</h3><p className="mt-1 text-xs text-muted">{unplaced.deviceIds.length} thiết bị · {unplaced.sensorIds.length} cảm biến</p></div><span className="rounded-full bg-warning-soft px-3 py-1 text-sm font-bold text-text">{unplacedCount}</span></div><p className="mt-3 text-sm leading-6 text-muted">Các đối tượng này không được rải ngẫu nhiên vì chưa có tọa độ layout.</p>{role === 'OWNER' ? <TwinLayoutButton leadingIcon={<LayoutDashboard size={18} />} onClick={onEdit2D}>Đặt trong chế độ 2D</TwinLayoutButton> : null}</section> : null}
      </aside>
    </div>
  </section>;
}
