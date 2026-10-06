import { RotateCcw, RotateCw, Plus, Minus } from 'lucide-react';
import { cameraViews, type TwinCameraAction, type TwinCameraView } from './twin3dCamera';

export function Twin3DCameraControls({ activeView, onChange }: {
  activeView: TwinCameraView | null;
  onChange: (action: TwinCameraAction) => void;
}) {
  return <div aria-label="Góc nhìn 3D" className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-2 shadow-soft">
    <div className="order-2 flex flex-wrap items-center gap-2">
      <span className="sr-only">Góc nhìn nhanh</span>
      <div className="flex gap-1">
        <button type="button" aria-label="Phóng to mô hình 3D" onClick={() => onChange('zoom-in')} className="flex min-h-11 items-center rounded-xl border border-line px-3 text-text hover:bg-sidebar-hover"><Plus size={16} aria-hidden="true" /></button>
        <button type="button" aria-label="Thu nhỏ mô hình 3D" onClick={() => onChange('zoom-out')} className="flex min-h-11 items-center rounded-xl border border-line px-3 text-text hover:bg-sidebar-hover"><Minus size={16} aria-hidden="true" /></button>
        <button type="button" aria-label="Xoay trái 90°" onClick={() => onChange('turn-left')} className="flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-xs font-semibold text-text hover:bg-sidebar-hover"><RotateCcw size={16} aria-hidden="true" />90°</button>
        <button type="button" aria-label="Xoay phải 90°" onClick={() => onChange('turn-right')} className="flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-xs font-semibold text-text hover:bg-sidebar-hover"><RotateCw size={16} aria-hidden="true" />90°</button>
      </div>
    </div>
    <div className="flex flex-wrap gap-1">
      {cameraViews.map((view) => <button key={view.id} type="button" aria-label={`Góc nhìn ${view.label}`} aria-pressed={activeView === view.id} onClick={() => onChange(view.id)} className={`min-h-11 rounded-xl px-2 text-xs font-semibold transition-colors duration-150 ${activeView === view.id ? 'bg-info-soft text-primary-hover ring-1 ring-primary' : 'bg-app text-muted hover:bg-sidebar-hover hover:text-text'}`}>{view.label}</button>)}
    </div>
  </div>;
}
