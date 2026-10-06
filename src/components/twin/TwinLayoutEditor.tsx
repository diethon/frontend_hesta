import { lazy, Suspense, useMemo, useState } from 'react';
import { shallowEqual, useStore } from 'react-redux';
import type { RootState } from '../../store/store';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { layoutDraftChanged, layoutArchitectureChanged, layoutMetadataDirtyChanged, layoutEditingCancelled, layoutEditingStarted, loadLayoutRole, loadTwinLayout, saveTwinLayout } from '../../store/twinLayoutSlice';
import { TwinCanvas } from './TwinCanvas';
import { Twin2DFloorOverview } from './Twin2DFloorOverview';
import { TwinFloorSelect } from './TwinFloorSelect';
import { TwinLayoutButton } from './TwinLayoutButton';
import { TwinLayoutInspector } from './TwinLayoutInspector';
import { TwinUnplacedPanel } from './TwinUnplacedPanel';
import type { TwinLayoutGeometry, TwinLayoutSelection } from '../../types/twinLayout';
import { Expand, MousePointer2, Move, Trash2, Eye, Pencil, Save } from 'lucide-react';
import { removeSelection } from './layoutPalette';
import { TwinViewSwitcher, type TwinViewMode } from './TwinViewSwitcher';
import { TwinOverview } from './TwinOverview';
import { geometryForFloor, layoutFloors, roomFloorLevel } from './twin3dGeometry';
import { TwinDraftingToolbar, type TwinDraftingMode } from './TwinDraftingToolbar';
import { notify } from '../ui/notify';
import { createTwinDraftingMetadata, draftingFromArchitecture, loadTwinDrafting, sameTwinDrafting, type TwinDraftingMetadata } from './twinDrafting';
import { inferTwinGeometry, twinGeometrySource } from '../../services/twinGeometrySource';

const Twin3DView = lazy(() => import('./Twin3DView').then((module) => ({ default: module.Twin3DView })));

export function TwinLayoutEditor({ homeId, initialMode = '3d' }: { homeId: string; initialMode?: TwinViewMode }) {
  const state = useAppSelector((root) => root.twinLayout);
  const roomCount = useAppSelector((root) => root.twin.roomIds.length);
  const roomIds = useAppSelector((root) => root.twin.roomIds);
  const names = useAppSelector((root) => Object.fromEntries(root.twin.roomIds.map(id => [id, root.twin.roomsById[id].name])), shallowEqual);
  const nodeRooms = useAppSelector((root) => JSON.stringify([
    ...root.twin.deviceIds.map(id => ({nodeType:'DEVICE',nodeId:id,roomId:root.twin.devicesById[id].roomId})),
    ...root.twin.sensorIds.map(id => ({nodeType:'SENSOR',nodeId:id,roomId:root.twin.sensorsById[id].roomId})),
  ]));
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const [preparing, setPreparing] = useState(false);
  const [selection, setSelection] = useState<TwinLayoutSelection | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fitRequest, setFitRequest] = useState(0);
  const [selectedViewMode, setViewMode] = useState<TwinViewMode | null>(null);
  const [selected2DFloor, setSelected2DFloor] = useState<number | 'all'>('all');
  const [draftingMode, setDraftingMode] = useState<TwinDraftingMode>('quick');
  const [drafting, setDrafting] = useState<TwinDraftingMetadata>(createTwinDraftingMetadata);
  const confirmedDrafting = useMemo(() => draftingFromArchitecture(state.confirmed?.architecture), [state.confirmed?.architecture]);
  const inferred = useMemo(() => inferTwinGeometry(roomIds, JSON.parse(nodeRooms)), [roomIds,nodeRooms]);
  if (state.homeId !== homeId) return null;
  const { confirmed, draft, dirty, loading, saving, error, role, roleError, roleRequestId } = state;
  const source = twinGeometrySource(confirmed, roomCount);
  const confirmedGeometry = confirmed?.rooms.length ? confirmed : inferred;
  const geometry = draft ?? confirmedGeometry;
  const displayedDrafting = draft ? drafting : confirmedDrafting;
  const viewMode: TwinViewMode = selectedViewMode ?? initialMode;
  const floorLevels = layoutFloors(geometry?.rooms ?? []);
  const active2DFloor = selected2DFloor !== 'all' && floorLevels.includes(selected2DFloor) ? selected2DFloor : 'all';
  const visible2DGeometry = geometry ? geometryForFloor(geometry, active2DFloor) : null;
  const blocked = loading || saving || preparing;
  const editable = !!draft && role === 'OWNER' && !blocked;
  const draftingDirty = !!draft && !sameTwinDrafting(drafting, confirmedDrafting);
  const hasUnsavedChanges = dirty || draftingDirty || (!!draft && source === 'INFERRED');
  const canEdit2DSelection = editable && (floorLevels.length <= 1 || active2DFloor !== 'all');
  const change = (next: TwinLayoutGeometry) => dispatch(layoutDraftChanged(next));
  const changeVisible2D = (next: TwinLayoutGeometry) => {
    if (!geometry || active2DFloor === 'all') {
      change(next);
      return;
    }
    const floorRoomIds = new Set(geometry.rooms.filter((room) => roomFloorLevel(room) === active2DFloor).map((room) => room.roomId));
    const floorNodeKeys = new Set(geometry.nodes.filter((node) => node.roomId !== null && floorRoomIds.has(node.roomId)).map((node) => `${node.nodeType}:${node.nodeId}`));
    const nextRooms = new Map(next.rooms.map((room) => [room.roomId, room]));
    change({
      rooms: geometry.rooms.flatMap((room) => floorRoomIds.has(room.roomId) ? (nextRooms.has(room.roomId) ? [nextRooms.get(room.roomId)!] : []) : [room]),
      nodes: geometry.nodes.filter((node) => !floorNodeKeys.has(`${node.nodeType}:${node.nodeId}`)).concat(next.nodes),
    });
  };
  const changeDrafting = (next: TwinDraftingMetadata) => {
    if (!editable) return;
    setDrafting(next);
    dispatch(layoutMetadataDirtyChanged(!sameTwinDrafting(next, confirmedDrafting)));
  };
  const confirmDiscard = () => window.confirm('Bỏ các thay đổi sơ đồ chưa lưu? Dữ liệu thiết bị và cảm biến mới nhất vẫn được giữ.');
  const cancel = () => {
    if (!hasUnsavedChanges || confirmDiscard()) {
      setDrafting(confirmedDrafting);
      dispatch(layoutEditingCancelled());
    }
  };
  const reload = () => {
    if (!hasUnsavedChanges || confirmDiscard()) {
      setDrafting(confirmedDrafting);
      void dispatch(loadTwinLayout(homeId));
    }
  };
  const save = async () => {
    if (!geometry || !draft || !hasUnsavedChanges) return;
    try {
    const { materializeTwinArchitecture } = await import('../../services/twinLayoutMaterialize');
    if (store.getState().twinLayout.homeId !== homeId || store.getState().twinLayout.draft !== draft) return;
    dispatch(layoutArchitectureChanged(materializeTwinArchitecture(homeId, geometry, drafting, names)));
    const action = await dispatch(saveTwinLayout(homeId));
    if (saveTwinLayout.fulfilled.match(action)) notify.success('Đã lưu toàn bộ bố cục vào HESTA');
    } catch { notify.error('Không thể chuẩn bị geometry để lưu. Bản nháp vẫn được giữ.'); }
  };
  const beginEditing = async () => {
    if (draft || !confirmed || role !== 'OWNER' || blocked) return;
    setPreparing(true);
    try {
      const { materializeTwinArchitecture } = await import('../../services/twinLayoutMaterialize');
      const current = store.getState().twinLayout;
      if (current.homeId !== homeId || current.confirmed !== confirmed || current.draft) return;
      // Make inferred furniture/openings editable, but keep them unsaved until PUT succeeds.
      setDrafting(source === 'INFERRED' ? draftingFromArchitecture(materializeTwinArchitecture(homeId, confirmedGeometry, confirmedDrafting, names)) : confirmedDrafting);
      dispatch(layoutEditingStarted(confirmedGeometry));
      if (source === 'INFERRED') dispatch(layoutMetadataDirtyChanged(true));
    } catch {
      notify.error('Không thể chuẩn bị geometry. Hãy thử lại.');
    } finally { setPreparing(false); }
  };
  const editIn2D = () => {
    setViewMode('2d');
    if (floorLevels.length > 1) setSelected2DFloor(floorLevels[0]);
    void beginEditing();
  };
  const startEditing2D = () => {
    if (floorLevels.length > 1 && active2DFloor === 'all') setSelected2DFloor(floorLevels[0]);
    void beginEditing();
  };
  return <section aria-label="Sơ đồ Digital Twin" className="min-w-0 space-y-5">
    {confirmed ? <p role="status" data-geometry-source={source} className={`rounded-xl border p-3 text-sm ${source === 'INFERRED' ? 'border-warning bg-warning-soft text-text' : 'border-line bg-info-soft text-muted'}`}>{source === 'PERSISTED' ? 'PERSISTED · Bố cục đã lưu trên HESTA' : source === 'INFERRED' ? 'INFERRED · Kiến trúc minh họa, chưa được xác nhận. Chỉnh sửa và Lưu bố cục để lưu vào HESTA.' : 'DEFAULT · Chưa có geometry'}</p> : null}
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-3xl font-bold tracking-tight text-text">Digital Twin</h1><p className="mt-2 text-sm text-muted">Trực quan hóa và quản lý bố cục ngôi nhà.</p></div>

       <div className="flex flex-wrap items-center gap-2"><TwinViewSwitcher mode={viewMode} disabled={loading} onChange={setViewMode} />{viewMode === '3d' ? <TwinLayoutButton leadingIcon={<Pencil size={17} />} onClick={editIn2D}>{role === 'OWNER' ? 'Chỉnh sửa trong 2D' : 'Xem sơ đồ 2D'}</TwinLayoutButton> : null}{viewMode === '2d' && floorLevels.length > 1 ? <TwinFloorSelect floors={floorLevels} value={active2DFloor} allLabel="Tất cả tầng" ariaLabel="Chọn tầng trong sơ đồ 2D" onChange={(floor) => { setSelection(null); setSelected2DFloor(floor); }} /> : null}{viewMode === '2d' && draft ? <>
        <TwinLayoutButton disabled={blocked} onClick={cancel}>Hủy</TwinLayoutButton>
        <TwinLayoutButton variant="primary" leadingIcon={<Save size={18} />} disabled={!hasUnsavedChanges || blocked || role !== 'OWNER' || error?.kind === 'conflict' || error?.kind === 'forbidden'} onClick={() => void save()}>{saving ? 'Đang lưu…' : 'Lưu bố cục'}</TwinLayoutButton>
      </> : confirmed ? <TwinLayoutButton disabled={blocked} onClick={reload}>Tải mới nhất</TwinLayoutButton> : null}</div>
    </div>
    {viewMode === '2d' ? <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line">
      <div className="flex gap-4" aria-label="Chế độ sơ đồ">
        <button type="button" aria-pressed={!draft} disabled={blocked} onClick={cancel} className={`flex min-h-12 items-center gap-2 border-b-2 px-3 text-sm font-semibold ${!draft ? 'border-primary text-primary-hover' : 'border-transparent text-muted'}`}><Eye size={18} aria-hidden="true" />Xem</button>
         {role === 'OWNER' ? <button type="button" aria-pressed={!!draft} disabled={!confirmed || blocked} onClick={startEditing2D} className={`flex min-h-12 items-center gap-2 border-b-2 px-3 text-sm font-semibold ${draft ? 'border-primary text-primary-hover' : 'border-transparent text-muted'}`}><Pencil size={18} aria-hidden="true" />Chỉnh sửa sơ đồ</button> : null}
      </div>
      <p role="status" className="pb-2 text-xs text-muted">{confirmed ? `Phiên bản ${confirmed.revision} · ${draft ? hasUnsavedChanges ? 'Có thay đổi chưa lưu' : 'Đang chỉnh sửa' : 'Chế độ xem'}` : 'Đang tải sơ đồ…'}</p>
    </div> : null}
    {roleRequestId ? <p role="status" className="text-sm text-muted">Đang kiểm tra quyền chỉnh sửa…</p> : null}
    {role === 'MEMBER' ? <p className="text-sm text-muted">Thành viên · Chỉ xem sơ đồ.</p> : null}
    {draft ? <TwinLayoutButton disabled={blocked} onClick={() => changeDrafting(loadTwinDrafting(homeId))}>Nhập metadata trình duyệt cũ thành bản nháp</TwinLayoutButton> : null}
    {roleError ? <div role="alert" className="rounded-xl bg-warning-soft p-4"><p>{roleError}</p><TwinLayoutButton onClick={() => void dispatch(loadLayoutRole(homeId))}>Kiểm tra lại quyền</TwinLayoutButton></div> : null}
    {error ? <div role="alert" className="space-y-3 rounded-xl border border-error bg-error-soft p-4">
      <p>{error.message}</p>{error.kind === 'forbidden' ? <TwinLayoutButton disabled={!!roleRequestId} onClick={() => void dispatch(loadLayoutRole(homeId))}>Kiểm tra lại quyền</TwinLayoutButton> : null}
      {error.kind === 'conflict' || !draft ? <TwinLayoutButton disabled={blocked} onClick={reload}>{error.kind === 'conflict' ? 'Tải sơ đồ mới nhất' : 'Thử tải lại sơ đồ'}</TwinLayoutButton> : null}
      {draft && error.kind === 'error' ? <p className="text-sm">Bản nháp vẫn được giữ. Bạn có thể sửa và chọn Lưu sơ đồ để thử lại.</p> : null}
    </div> : null}
    {loading ? <p role="status" className="rounded-xl bg-info-soft p-4 text-sm">Đang tải sơ đồ…</p> : null}
    {viewMode === 'overview' ? <TwinOverview geometry={confirmed} /> : null}
    {!roomCount && viewMode !== 'overview' ? <section className="surface-card space-y-4 p-8 text-center"><h2 className="text-xl font-semibold">Chưa có phòng</h2><p className="mt-2 text-sm text-muted">Hãy tạo phòng cho ngôi nhà trước khi thiết kế Digital Twin.</p>{role === 'OWNER' && confirmed ? <TwinLayoutButton onClick={editIn2D}>Tạo phòng và thiết kế sơ đồ</TwinLayoutButton> : null}{draft && geometry ? <div className="text-left"><TwinUnplacedPanel drafting={displayedDrafting} geometry={geometry} disabled={!editable} onChange={change} /></div> : null}</section> : null}
    {roomCount > 0 && confirmed && viewMode === '3d' ? <Suspense fallback={<div role="status" className="surface-card p-8 text-center text-sm text-muted">Đang tải trình xem 3D…</div>}><Twin3DView geometry={confirmedGeometry} drafting={confirmedDrafting} role={role} onEdit2D={editIn2D} /></Suspense> : null}
     {roomCount > 0 && geometry && viewMode === '2d' ? <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
       <div className="min-w-0 space-y-3">
        {draft ? <TwinDraftingToolbar metadata={drafting} selection={selection} floor={active2DFloor === 'all' ? floorLevels[0] ?? 1 : active2DFloor} disabled={!editable} mode={draftingMode} onModeChange={setDraftingMode} onChange={changeDrafting} /> : null}
        {draft ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="twin-tool"><MousePointer2 size={20} aria-hidden="true" /><span><strong>Kéo & thả</strong><small>Đặt từ bảng bên cạnh</small></span></div>
          <div className="twin-tool"><Move size={20} aria-hidden="true" /><span><strong>Di chuyển</strong><small>Kéo đối tượng trên sơ đồ</small></span></div>
          <div className="twin-tool"><Expand size={20} aria-hidden="true" /><span><strong>Kích thước</strong><small>Kéo góc hoặc nhập số</small></span></div>
           <button type="button" disabled={!selection || !canEdit2DSelection || !(selection.kind === 'room' ? visible2DGeometry?.rooms.some((room) => room.roomId === selection.id) : visible2DGeometry?.nodes.some((node) => `${node.nodeType}:${node.nodeId}` === selection.id))} onClick={() => { if (selection && visible2DGeometry) { changeVisible2D(removeSelection(visible2DGeometry, selection)); if (selection.kind === 'room') { const rooms = { ...drafting.rooms }; delete rooms[selection.id]; changeDrafting({ ...drafting, rooms }); } setSelection(null); } }} className="twin-tool text-left disabled:opacity-40"><Trash2 size={20} aria-hidden="true" /><span><strong>Bỏ vị trí</strong><small>{active2DFloor === 'all' && floorLevels.length > 1 ? 'Chọn một tầng trước' : 'Đối tượng đang chọn'}</small></span></button>
         </div> : null}
         {active2DFloor === 'all' && floorLevels.length > 1 ? <Twin2DFloorOverview zoom={zoom} fitRequest={fitRequest} geometry={geometry} drafting={displayedDrafting} floors={floorLevels} selection={selection} onSelect={setSelection} onChooseFloor={(floor) => { setSelection(null); setSelected2DFloor(floor); }} /> : <TwinCanvas key={`${draft ? 'edit' : 'view'}-${active2DFloor}`} geometry={visible2DGeometry ?? geometry} drafting={displayedDrafting} floor={active2DFloor === 'all' ? undefined : active2DFloor} editable={editable} selection={selection} onSelect={setSelection} onChange={changeVisible2D} onDraftingChange={changeDrafting} zoom={zoom} fitRequest={fitRequest} />}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2"><div className="flex items-center rounded-xl border border-line bg-surface p-1"><button type="button" aria-label="Thu nhỏ sơ đồ" disabled={zoom <= 0.5} onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))} className="h-11 w-11 rounded-lg text-lg text-muted hover:bg-sidebar-hover disabled:opacity-40">−</button><output aria-label="Mức thu phóng" className="min-w-14 text-center text-sm font-semibold text-text">{Math.round(zoom * 100)}%</output><button type="button" aria-label="Phóng to sơ đồ" disabled={zoom >= 2} onClick={() => setZoom((value) => Math.min(2, value + 0.25))} className="h-11 w-11 rounded-lg text-lg text-text hover:bg-sidebar-hover disabled:opacity-40">+</button></div><button type="button" aria-label="Đưa sơ đồ vừa màn hình" onClick={() => { setZoom(1); setFitRequest((value) => value + 1); }} className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-text hover:bg-sidebar-hover"><Expand size={16} aria-hidden="true" />Vừa sơ đồ</button></div>
          <div className="flex items-center gap-3 text-xs text-muted"><span className="h-3 w-3 rounded-full bg-info" />Phòng<span className="h-3 w-3 rounded-full bg-mint" />Thiết bị<span className="h-3 w-3 rounded-full bg-warning" />Cảm biến</div>
        </div>
         <p className="text-xs text-muted">{draft ? active2DFloor === 'all' && floorLevels.length > 1 ? 'Đang xem tổng quan. Chọn một tầng trong bộ chọn để chỉnh sửa.' : 'Kéo các điểm tròn để chỉnh góc phòng, kéo góc dưới để đổi khung bao. Mọi thay đổi chỉ được lưu khi bạn bấm Lưu bố cục.' : 'Bố cục được lấy từ phiên bản đã lưu.'}</p>
      </div>
      <aside className="min-w-0 space-y-4">
         {draft && (floorLevels.length <= 1 || active2DFloor !== 'all') ? <TwinUnplacedPanel drafting={displayedDrafting} geometry={geometry} floor={active2DFloor === 'all' ? undefined : active2DFloor} disabled={!editable} onChange={change} /> : null}
         <TwinLayoutInspector geometry={visible2DGeometry ?? geometry} drafting={displayedDrafting} mode={draftingMode} selection={selection} editable={canEdit2DSelection} onChange={changeVisible2D} onDraftingChange={changeDrafting} />
      </aside>
    </div> : null}
  </section>;
}
