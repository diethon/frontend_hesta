import { Layers } from 'lucide-react';
import type { TwinLayoutGeometry, TwinLayoutSelection } from '../../types/twinLayout';
import { geometryForFloor } from './twin3dGeometry';
import { TwinCanvas } from './TwinCanvas';
import type { TwinDraftingMetadata } from './twinDrafting';

export function Twin2DFloorOverview({ geometry, drafting, floors, selection, onSelect, onChooseFloor, zoom = 1, fitRequest = 0 }: {
  geometry: TwinLayoutGeometry;
  drafting: TwinDraftingMetadata;
  floors: number[];
  selection: TwinLayoutSelection | null;
  onSelect: (selection: TwinLayoutSelection) => void;
  onChooseFloor: (floor: number) => void;
  zoom?: number;
  fitRequest?: number;
}) {
  return <section aria-label="Tổng quan các tầng 2D" className="surface-card space-y-4 p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-info-soft text-primary"><Layers size={20} aria-hidden="true" /></span>
        <div><h3 className="font-semibold text-text">Tổng quan các tầng</h3><p className="mt-1 text-xs text-muted">Chọn một tầng trong danh sách để chỉnh sửa chi tiết.</p></div>
      </div>
      <span className="rounded-full bg-info-soft px-3 py-1 text-xs font-semibold text-primary-hover">{floors.length} tầng</span>
    </div>
    <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {floors.map((floor) => {
        const floorGeometry = geometryForFloor(geometry, floor);
        return <article key={floor} className="min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div><p className="text-sm font-semibold text-text">Tầng {floor}</p><p className="text-xs text-muted">{floorGeometry.rooms.length} phòng · {floorGeometry.nodes.length} marker</p></div>
            <button type="button" onClick={() => onChooseFloor(floor)} className="min-h-11 rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-primary-hover hover:bg-sidebar-hover">Mở tầng</button>
          </div>
          <TwinCanvas geometry={floorGeometry} drafting={drafting} floor={floor} editable={false} overview selection={selection} onSelect={onSelect} onChange={() => {}} zoom={zoom} fitRequest={fitRequest} />
        </article>;
      })}
    </div>
  </section>;
}
