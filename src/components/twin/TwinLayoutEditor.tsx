import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { shallowEqual, useStore } from 'react-redux';
import type { RootState } from '../../store/store';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { layoutDraftChanged, layoutArchitectureChanged, layoutMetadataDirtyChanged, layoutEditingCancelled, layoutEditingStarted, loadLayoutRole, loadTwinLayout, saveTwinLayout } from '../../store/twinLayoutSlice';
import { TwinCanvas } from './TwinCanvas';
import { Twin2DFloorOverview } from './Twin2DFloorOverview';
import { TwinFloorSelect } from './TwinFloorSelect';
import { TwinLayoutButton } from './TwinLayoutButton';
import { TwinLayoutInspector } from './TwinLayoutInspector';
import { TwinRoomPanel } from './TwinRoomPanel';
import type { TwinLayoutGeometry, TwinLayoutSelection } from '../../types/twinLayout';
import { Expand, Eye, Pencil, Redo2, Save, Undo2 } from 'lucide-react';
import { positionNodeInRoom, sameGeometry } from './layoutGeometry';
import { TwinViewSwitcher, type TwinViewMode } from './TwinViewSwitcher';
import { TwinOverview } from './TwinOverview';
import { geometryForFloor, layoutFloors, roomFloorLevel } from './twin3dGeometry';
import { TwinDraftingToolbar, type TwinDraftingMode } from './TwinDraftingToolbar';
import { notify } from '../ui/notify';
import { confirmDialog } from '../ui/confirmDialog';
import { createTwinDraftingMetadata, draftingFromArchitecture, roomDrafting, sameTwinDrafting, type TwinDraftingMetadata } from './twinDrafting';
import { reconcileTwinGeometry, twinGeometrySource } from '../../services/twinGeometrySource';
import { createV2Illustration } from '../../services/twinV2Illustration';

import type { TwinRendererTheme } from './scene/rendererTheme';

type TwinEditSnapshot = { geometry: TwinLayoutGeometry; drafting: TwinDraftingMetadata };
const HISTORY_LIMIT = 100;
const isTextField = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

const Twin3DView = lazy(() => import('./Twin3DView').then((module) => ({ default: module.Twin3DView })));

export function TwinLayoutEditor({ homeId, initialMode = '3d', rendererTheme, onRendererThemeChange }: { homeId: string; initialMode?: TwinViewMode; rendererTheme?: TwinRendererTheme; onRendererThemeChange?: (theme: TwinRendererTheme) => void }) {
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
  // Shared by the 2D plan and the furniture list so selecting in one highlights the other.
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fitRequest, setFitRequest] = useState(0);
  const [selectedViewMode, setViewMode] = useState<TwinViewMode | null>(null);
  const [selected2DFloor, setSelected2DFloor] = useState<number | 'all'>('all');
  const [draftingMode, setDraftingMode] = useState<TwinDraftingMode>('quick');
  const [drafting, setDrafting] = useState<TwinDraftingMetadata>(createTwinDraftingMetadata);
  const confirmedDrafting = useMemo(() => draftingFromArchitecture(state.confirmed?.architecture), [state.confirmed?.architecture]);
  const confirmedGeometry = useMemo(() => state.confirmed && !state.confirmed.rooms.length && !state.confirmed.revision
    ? createV2Illustration(roomIds, JSON.parse(nodeRooms), names)
    : reconcileTwinGeometry(state.confirmed, roomIds, JSON.parse(nodeRooms)), [state.confirmed, roomIds, nodeRooms, names]);
  // Undo history is per editing session; each entry is the draft just before one user change.
  const [history, setHistory] = useState<{ past: TwinEditSnapshot[]; future: TwinEditSnapshot[] }>({ past: [], future: [] });
  const reconciledDraft = useMemo(() => state.draft ? reconcileTwinGeometry(state.draft, roomIds, JSON.parse(nodeRooms), drafting) : null, [state.draft, roomIds, nodeRooms, drafting]);
  const { confirmed, draft, loading, saving, error, role, roleError, roleRequestId } = state;
  const source = twinGeometrySource(confirmed, roomCount);
  const nameInferredFloors = !confirmed?.rooms.length && confirmedGeometry.rooms.some(room => (room.floor ?? 1) > 1);
  const geometry = reconciledDraft ?? confirmedGeometry;
  const displayedDrafting = draft ? drafting : confirmedDrafting;
  const viewMode: TwinViewMode = selectedViewMode ?? initialMode;
  const floorLevels = layoutFloors(geometry?.rooms ?? []);
  const active2DFloor = selected2DFloor !== 'all' && floorLevels.includes(selected2DFloor) ? selected2DFloor : 'all';
  const visible2DGeometry = geometry ? geometryForFloor(geometry, active2DFloor) : null;
  const blocked = loading || saving || preparing;
  const editable = !!draft && role === 'OWNER' && !blocked;
  const draftingDirty = !!draft && !sameTwinDrafting(drafting, confirmedDrafting);
  // Baseline is the reconciled layout the user sees, not the raw saved one, so opening the editor is not a change.
  const hasUnsavedChanges = draftingDirty || (!!draft && (!sameGeometry(draft, confirmedGeometry) || source === 'INFERRED'));
  const canEdit2DSelection = editable && (floorLevels.length <= 1 || active2DFloor !== 'all');
  const applyDraft = (next: TwinLayoutGeometry) => dispatch(layoutDraftChanged(next));
  const record = () => {
    if (!draft) return;
    setHistory(({ past }) => ({ past: [...past, { geometry: draft, drafting }].slice(-HISTORY_LIMIT), future: [] }));
  };
  const restore = (direction: 'undo' | 'redo') => {
    const snapshot = (direction === 'undo' ? history.past : history.future).at(-1);
    if (!snapshot || !draft || !editable) return;
    const current = { geometry: draft, drafting };
    setHistory(direction === 'undo'
      ? { past: history.past.slice(0, -1), future: [...history.future, current] }
      : { past: [...history.past, current], future: history.future.slice(0, -1) });
    setDrafting(snapshot.drafting);
    applyDraft(snapshot.geometry);
    dispatch(layoutMetadataDirtyChanged(!sameTwinDrafting(snapshot.drafting, confirmedDrafting)));
  };
  const undo = () => restore('undo');
  const redo = () => restore('redo');
  const change = (next: TwinLayoutGeometry) => { record(); applyDraft(next); };
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
    record();
    setDrafting(next);
    applyDraft({ ...geometry, nodes: geometry.nodes.map((node) => positionNodeInRoom(node, node.x, node.y, geometry.rooms, (id) => roomDrafting(next, id).points)) });
    dispatch(layoutMetadataDirtyChanged(!sameTwinDrafting(next, confirmedDrafting)));
  };
  const confirmDiscard = () => confirmDialog({ title: 'Bỏ các thay đổi sơ đồ chưa lưu?', description: 'Dữ liệu thiết bị và cảm biến mới nhất vẫn được giữ.', confirmText: 'Bỏ thay đổi', cancelText: 'Tiếp tục chỉnh', variant: 'warning' });
  const cancel = async () => {
    if (!hasUnsavedChanges || await confirmDiscard()) {
      setDrafting(confirmedDrafting);
      dispatch(layoutEditingCancelled());
    }
  };
  const reload = async () => {
    if (!hasUnsavedChanges || await confirmDiscard()) {
      setDrafting(confirmedDrafting);
      void dispatch(loadTwinLayout(homeId));
    }
  };
  const save = async () => {
    if (!geometry || !draft || !hasUnsavedChanges) return;
    try {
    const { materializeTwinArchitecture, refreshResizedFurniture } = await import('../../services/twinLayoutMaterialize');
    if (store.getState().twinLayout.homeId !== homeId || store.getState().twinLayout.draft !== draft) return;
    const live = store.getState().twin;
    const toSave = reconcileTwinGeometry(geometry, live.roomIds, [
      ...live.deviceIds.map((id) => ({ nodeType: 'DEVICE' as const, nodeId: id, roomId: live.devicesById[id].roomId })),
      ...live.sensorIds.map((id) => ({ nodeType: 'SENSOR' as const, nodeId: id, roomId: live.sensorsById[id].roomId })),
    ], drafting);
    applyDraft(toSave);
    // Resized rooms get furniture generated for their new size instead of the stale frozen set.
    dispatch(layoutArchitectureChanged(materializeTwinArchitecture(homeId, toSave, refreshResizedFurniture(drafting, confirmedDrafting, toSave, confirmedGeometry), names)));
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
      setHistory({ past: [], future: [] });
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
  // Re-subscribed each render so the shortcut always sees the latest draft.
  useEffect(() => {
    if (!editable) return;
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || isTextField(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) { event.preventDefault(); undo(); }
      else if (key === 'y' || (key === 'z' && event.shiftKey)) { event.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  if (state.homeId !== homeId) return null;
  return <section aria-label="Sơ đồ Digital Twin" className={`twin-v2-layout-editor min-w-0 space-y-3 ${viewMode === '3d' ? 'twin-v2-layout-live' : ''}`}>
    <div className={viewMode === '3d' ? 'twin-v2-layout-meta' : 'space-y-3'}>
    {confirmed ? <p role="status" data-geometry-source={source} className={`rounded-xl border px-3 py-2 text-xs ${source === 'INFERRED' ? 'border-warning bg-warning-soft text-text' : 'border-line bg-info-soft text-muted'}`}><strong className="font-semibold">Dữ liệu HESTA</strong> · {source === 'PERSISTED' ? 'Bố cục đã lưu. Phòng và thiết bị được đồng bộ từ ngôi nhà.' : source === 'INFERRED' ? `Bố cục và nội thất minh họa từ phòng thật.${nameInferredFloors ? ' Tầng suy từ tên phòng.' : ''} Chưa phải bản đo thực tế.` : 'Chưa có dữ liệu phòng để hiển thị.'}</p> : null}
    <div className="flex flex-wrap items-center justify-between gap-4">
      {viewMode === '3d' ? <p className="text-sm text-muted">Chọn phòng để xem thiết bị · Nhấp đúp để xem gần</p> : <div><h2 className="text-2xl font-semibold tracking-tight text-text">Sơ đồ Digital Twin</h2><p className="mt-2 text-sm text-muted">Chọn tầng, căn chỉnh phòng và vị trí thiết bị có sẵn trong nhà.</p></div>}

       <div className="flex flex-wrap items-center gap-2"><TwinViewSwitcher mode={viewMode} disabled={loading} onChange={setViewMode} />{viewMode === '3d' ? <TwinLayoutButton leadingIcon={<Pencil size={17} />} onClick={editIn2D}>{role === 'OWNER' ? 'Chỉnh sửa trong 2D' : 'Xem sơ đồ 2D'}</TwinLayoutButton> : null}{viewMode === '2d' && floorLevels.length > 1 ? <TwinFloorSelect floors={floorLevels} value={active2DFloor} allLabel="Tất cả tầng" ariaLabel="Chọn tầng trong sơ đồ 2D" onChange={(floor) => { setSelection(null); setSelected2DFloor(floor); }} /> : null}{viewMode === '2d' && draft ? <>
        <TwinLayoutButton leadingIcon={<Undo2 size={17} />} title="Hoàn tác (Ctrl+Z)" disabled={!editable || !history.past.length} onClick={undo}>Hoàn tác</TwinLayoutButton>
        <TwinLayoutButton leadingIcon={<Redo2 size={17} />} title="Làm lại (Ctrl+Y)" disabled={!editable || !history.future.length} onClick={redo}>Làm lại</TwinLayoutButton>
        <TwinLayoutButton disabled={blocked} onClick={cancel}>Hủy</TwinLayoutButton>
        <TwinLayoutButton variant="primary" leadingIcon={<Save size={18} />} disabled={!hasUnsavedChanges || blocked || role !== 'OWNER' || error?.kind === 'conflict' || error?.kind === 'forbidden'} onClick={() => void save()}>{saving ? 'Đang lưu…' : 'Lưu bố cục'}</TwinLayoutButton>
      </> : viewMode === '2d' && confirmed ? <TwinLayoutButton disabled={blocked} onClick={reload}>Tải mới nhất</TwinLayoutButton> : null}</div>
    </div>
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
    {roleError ? <div role="alert" className="rounded-xl bg-warning-soft p-4"><p>{roleError}</p><TwinLayoutButton onClick={() => void dispatch(loadLayoutRole(homeId))}>Kiểm tra lại quyền</TwinLayoutButton></div> : null}
    {error ? <div role="alert" className="space-y-3 rounded-xl border border-error bg-error-soft p-4">
      <p>{error.message}</p>{error.kind === 'forbidden' ? <TwinLayoutButton disabled={!!roleRequestId} onClick={() => void dispatch(loadLayoutRole(homeId))}>Kiểm tra lại quyền</TwinLayoutButton> : null}
      {error.kind === 'conflict' || !draft ? <TwinLayoutButton disabled={blocked} onClick={reload}>{error.kind === 'conflict' ? 'Tải sơ đồ mới nhất' : 'Thử tải lại sơ đồ'}</TwinLayoutButton> : null}
      {draft && error.kind === 'error' ? <p className="text-sm">Bản nháp vẫn được giữ. Bạn có thể sửa và chọn Lưu sơ đồ để thử lại.</p> : null}
    </div> : null}
    {loading ? <p role="status" className="rounded-xl bg-info-soft p-4 text-sm">Đang tải sơ đồ…</p> : null}
    {viewMode === 'overview' ? <TwinOverview geometry={confirmedGeometry} /> : null}
    {!roomCount && viewMode !== 'overview' ? <section className="surface-card space-y-4 p-8 text-center"><h2 className="text-xl font-semibold">Chưa có phòng</h2><p className="mt-2 text-sm text-muted">Digital Twin sử dụng phòng và thiết bị hiện có của ngôi nhà. Khi có dữ liệu, hãy đồng bộ lại để căn chỉnh bố cục.</p><TwinRoomPanel geometry={geometry} saved={confirmed} selection={selection} onSelect={setSelection} /></section> : null}
    {roomCount > 0 && confirmed && viewMode === '3d' ? <Suspense fallback={<div role="status" className="surface-card p-8 text-center text-sm text-muted">Đang tải trình xem 3D…</div>}><Twin3DView geometry={confirmedGeometry} drafting={confirmedDrafting} role={role} onEdit2D={editIn2D} rendererTheme={rendererTheme} onRendererThemeChange={onRendererThemeChange} /></Suspense> : null}
     {roomCount > 0 && geometry && viewMode === '2d' ? <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
       <div className="min-w-0 space-y-3">
        {draft ? <TwinDraftingToolbar metadata={drafting} selection={selection} floor={active2DFloor === 'all' ? floorLevels[0] ?? 1 : active2DFloor} disabled={!editable} mode={draftingMode} onModeChange={setDraftingMode} onChange={changeDrafting} /> : null}
         {active2DFloor === 'all' && floorLevels.length > 1 ? <Twin2DFloorOverview zoom={zoom} fitRequest={fitRequest} geometry={geometry} drafting={displayedDrafting} floors={floorLevels} selection={selection} onSelect={setSelection} onChooseFloor={(floor) => { setSelection(null); setSelected2DFloor(floor); }} /> : <TwinCanvas key={`${draft ? 'edit' : 'view'}-${active2DFloor}`} geometry={visible2DGeometry ?? geometry} drafting={displayedDrafting} floor={active2DFloor === 'all' ? undefined : active2DFloor} editable={editable} selection={selection} onSelect={setSelection} onChange={changeVisible2D} onDraftingChange={changeDrafting} zoom={zoom} fitRequest={fitRequest} selectedObjectId={selectedObjectId} onSelectObject={setSelectedObjectId} />}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2"><div className="flex items-center rounded-xl border border-line bg-surface p-1"><button type="button" aria-label="Thu nhỏ sơ đồ" disabled={zoom <= 0.5} onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))} className="h-11 w-11 rounded-lg text-lg text-muted hover:bg-sidebar-hover disabled:opacity-40">−</button><output aria-label="Mức thu phóng" className="min-w-14 text-center text-sm font-semibold text-text">{Math.round(zoom * 100)}%</output><button type="button" aria-label="Phóng to sơ đồ" disabled={zoom >= 2} onClick={() => setZoom((value) => Math.min(2, value + 0.25))} className="h-11 w-11 rounded-lg text-lg text-text hover:bg-sidebar-hover disabled:opacity-40">+</button></div><button type="button" aria-label="Đưa sơ đồ vừa màn hình" onClick={() => { setZoom(1); setFitRequest((value) => value + 1); }} className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-text hover:bg-sidebar-hover"><Expand size={16} aria-hidden="true" />Vừa sơ đồ</button></div>
          <div className="flex items-center gap-3 text-xs text-muted"><span className="h-3 w-3 rounded-full bg-info" />Phòng<span className="h-3 w-3 rounded-full bg-mint" />Thiết bị<span className="h-3 w-3 rounded-full bg-warning" />Cảm biến</div>
        </div>
         <p className="text-xs text-muted">{draft ? active2DFloor === 'all' && floorLevels.length > 1 ? 'Đang xem tổng quan. Chọn một tầng trong bộ chọn để chỉnh sửa.' : 'Kéo cạnh phòng để phóng to/thu nhỏ, kéo điểm tròn ở góc để chỉnh hình dạng. Ctrl+Z để hoàn tác, Ctrl+Y để làm lại. Mọi thay đổi chỉ được lưu khi bạn bấm Lưu bố cục.' : 'Bố cục được lấy từ phiên bản đã lưu.'}</p>
      </div>
      <aside className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:self-start xl:overflow-y-auto xl:pr-1">
         <TwinRoomPanel geometry={geometry} saved={confirmed} floor={active2DFloor === 'all' ? undefined : active2DFloor} selection={selection} onSelect={(next) => {
           setSelection(next);
           const roomId = next.kind === 'room' ? next.id : geometry.nodes.find((node) => `${node.nodeType}:${node.nodeId}` === next.id)?.roomId;
           const room = geometry.rooms.find((item) => item.roomId === roomId);
           if (room) setSelected2DFloor(roomFloorLevel(room));
         }} />
         <TwinLayoutInspector geometry={visible2DGeometry ?? geometry} drafting={displayedDrafting} mode={draftingMode} selection={selection} editable={canEdit2DSelection} onChange={changeVisible2D} onDraftingChange={changeDrafting} selectedObjectId={selectedObjectId} onSelectObject={setSelectedObjectId} />
      </aside>
    </div> : null}
  </section>;
}
