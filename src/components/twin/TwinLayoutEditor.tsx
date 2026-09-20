import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { layoutDraftChanged, layoutEditingCancelled, layoutEditingStarted, loadLayoutRole, loadTwinLayout, saveTwinLayout } from '../../store/twinLayoutSlice';
import { TwinCanvas, type LayoutSelection } from './TwinCanvas';
import { TwinLayoutButton } from './TwinLayoutButton';
import { TwinLayoutInspector } from './TwinLayoutInspector';
import { TwinUnplacedPanel } from './TwinUnplacedPanel';
import type { TwinLayoutGeometry } from '../../types/twinLayout';
import { Expand, MousePointer2, Move, Trash2, Eye, Pencil, House, Save } from 'lucide-react';
import { removeSelection } from './layoutPalette';

export function TwinLayoutEditor({ homeId }: { homeId: string }) {
  const state = useAppSelector((root) => root.twinLayout);
  const dispatch = useAppDispatch();
  const [selection, setSelection] = useState<LayoutSelection | null>(null);
  const [zoom, setZoom] = useState(1);
  if (state.homeId !== homeId) return null;
  const { confirmed, draft, dirty, loading, saving, error, role, roleError, roleRequestId } = state;
  const geometry = draft ?? confirmed;
  const blocked = loading || saving;
  const editable = !!draft && role === 'OWNER' && !blocked;
  const change = (next: TwinLayoutGeometry) => dispatch(layoutDraftChanged(next));
  const confirmDiscard = () => window.confirm('Bỏ các thay đổi sơ đồ chưa lưu? Dữ liệu thiết bị và cảm biến mới nhất vẫn được giữ.');
  const cancel = () => { if (!dirty || confirmDiscard()) dispatch(layoutEditingCancelled()); };
  const reload = () => { if (!dirty || confirmDiscard()) void dispatch(loadTwinLayout(homeId)); };
  return <section aria-label="Sơ đồ Digital Twin" className="min-w-0 space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-3xl font-bold tracking-tight text-text">Digital Twin</h1><p className="mt-2 text-sm text-muted">Trực quan hóa và quản lý bố cục ngôi nhà.</p></div>
      <div className="flex items-center gap-3 rounded-xl bg-info-soft px-4 py-3"><House size={32} className="shrink-0 text-primary-hover" aria-hidden="true" /><div><h2 className="text-sm font-semibold text-text">Thiết kế không gian sống thông minh</h2><p className="mt-1 text-xs text-muted">Kéo, thả và sắp xếp phòng, thiết bị, cảm biến</p></div></div>
      <div className="flex gap-2">{draft ? <>
        <TwinLayoutButton disabled={blocked} onClick={cancel}>Hủy</TwinLayoutButton>
        <TwinLayoutButton variant="primary" leadingIcon={<Save size={18} />} disabled={!dirty || blocked || role !== 'OWNER' || error?.kind === 'conflict' || error?.kind === 'forbidden'} onClick={() => void dispatch(saveTwinLayout(homeId))}>{saving ? 'Đang lưu…' : 'Lưu bố cục'}</TwinLayoutButton>
      </> : confirmed ? <TwinLayoutButton disabled={blocked} onClick={reload}>Tải mới nhất</TwinLayoutButton> : null}</div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line">
      <div className="flex gap-4" aria-label="Chế độ sơ đồ">
        <button type="button" aria-pressed={!draft} disabled={blocked} onClick={cancel} className={`flex min-h-12 items-center gap-2 border-b-2 px-3 text-sm font-semibold ${!draft ? 'border-primary text-primary-hover' : 'border-transparent text-muted'}`}><Eye size={18} aria-hidden="true" />Xem</button>
        {role === 'OWNER' ? <button type="button" aria-pressed={!!draft} disabled={!confirmed || blocked} onClick={() => { if (!draft) dispatch(layoutEditingStarted()); }} className={`flex min-h-12 items-center gap-2 border-b-2 px-3 text-sm font-semibold ${draft ? 'border-primary text-primary-hover' : 'border-transparent text-muted'}`}><Pencil size={18} aria-hidden="true" />Chỉnh sửa sơ đồ</button> : null}
      </div>
      <p role="status" className="pb-2 text-xs text-muted">{confirmed ? `Phiên bản ${confirmed.revision} · ${draft ? dirty ? 'Có thay đổi chưa lưu' : 'Đang chỉnh sửa' : 'Chế độ xem'}` : 'Đang tải sơ đồ…'}</p>
    </div>
    {roleRequestId ? <p role="status" className="text-sm text-muted">Đang kiểm tra quyền chỉnh sửa…</p> : null}
    {role === 'MEMBER' ? <p className="text-sm text-muted">Thành viên · Chỉ xem sơ đồ.</p> : null}
    {roleError ? <div role="alert" className="rounded-xl bg-warning-soft p-4"><p>{roleError}</p><TwinLayoutButton onClick={() => void dispatch(loadLayoutRole(homeId))}>Kiểm tra lại quyền</TwinLayoutButton></div> : null}
    {error ? <div role="alert" className="space-y-3 rounded-xl border border-error bg-error-soft p-4">
      <p>{error.message}</p>{error.kind === 'forbidden' ? <TwinLayoutButton disabled={!!roleRequestId} onClick={() => void dispatch(loadLayoutRole(homeId))}>Kiểm tra lại quyền</TwinLayoutButton> : null}
      {error.kind === 'conflict' || !draft ? <TwinLayoutButton disabled={blocked} onClick={reload}>{error.kind === 'conflict' ? 'Tải sơ đồ mới nhất' : 'Thử tải lại sơ đồ'}</TwinLayoutButton> : null}
      {draft && error.kind === 'error' ? <p className="text-sm">Bản nháp vẫn được giữ. Bạn có thể sửa và chọn Lưu sơ đồ để thử lại.</p> : null}
    </div> : null}
    {loading ? <p role="status" className="rounded-xl bg-info-soft p-4 text-sm">Đang tải sơ đồ…</p> : null}
    {geometry ? <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="min-w-0 space-y-3">
        {draft ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="twin-tool"><MousePointer2 size={20} aria-hidden="true" /><span><strong>Kéo & thả</strong><small>Đặt từ bảng bên cạnh</small></span></div>
          <div className="twin-tool"><Move size={20} aria-hidden="true" /><span><strong>Di chuyển</strong><small>Kéo đối tượng trên sơ đồ</small></span></div>
          <div className="twin-tool"><Expand size={20} aria-hidden="true" /><span><strong>Kích thước</strong><small>Kéo góc hoặc nhập số</small></span></div>
          <button type="button" disabled={!selection || !editable || !(selection.kind === 'room' ? geometry.rooms.some((room) => room.roomId === selection.id) : geometry.nodes.some((node) => `${node.nodeType}:${node.nodeId}` === selection.id))} onClick={() => { if (selection) { change(removeSelection(geometry, selection)); setSelection(null); } }} className="twin-tool text-left disabled:opacity-40"><Trash2 size={20} aria-hidden="true" /><span><strong>Bỏ vị trí</strong><small>Đối tượng đang chọn</small></span></button>
        </div> : null}
        <TwinCanvas key={draft ? 'edit' : 'view'} geometry={geometry} editable={editable} selection={selection} onSelect={setSelection} onChange={change} zoom={zoom} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2"><div className="flex items-center rounded-xl border border-line bg-surface p-1"><button type="button" aria-label="Thu nhỏ sơ đồ" disabled={zoom <= 0.5} onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))} className="h-11 w-11 rounded-lg text-lg text-muted hover:bg-sidebar-hover disabled:opacity-40">−</button><output aria-label="Mức thu phóng" className="min-w-14 text-center text-sm font-semibold text-text">{Math.round(zoom * 100)}%</output><button type="button" aria-label="Phóng to sơ đồ" disabled={zoom >= 2} onClick={() => setZoom((value) => Math.min(2, value + 0.25))} className="h-11 w-11 rounded-lg text-lg text-text hover:bg-sidebar-hover disabled:opacity-40">+</button></div><button type="button" aria-label="Đưa sơ đồ vừa màn hình" onClick={() => setZoom(1)} className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-text hover:bg-sidebar-hover"><Expand size={16} aria-hidden="true" />Vừa màn hình</button></div>
          <div className="flex items-center gap-3 text-xs text-muted"><span className="h-3 w-3 rounded-full bg-info" />Phòng<span className="h-3 w-3 rounded-full bg-mint" />Thiết bị<span className="h-3 w-3 rounded-full bg-warning" />Cảm biến</div>
        </div>
        <p className="text-xs text-muted">{draft ? 'Kéo ↘ ở góc phòng để thay đổi kích thước. Mọi thay đổi chỉ được lưu khi bạn bấm Lưu bố cục.' : 'Bố cục được lấy từ phiên bản đã lưu.'}</p>
      </div>
      <aside className="min-w-0 space-y-4">
        {draft ? <TwinUnplacedPanel geometry={geometry} disabled={!editable} onChange={change} /> : null}
        <TwinLayoutInspector geometry={geometry} selection={selection} editable={editable} onChange={change} />
      </aside>
    </div> : null}
  </section>;
}
