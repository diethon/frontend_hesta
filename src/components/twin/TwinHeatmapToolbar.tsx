import type { TwinHeatmapMode } from '../../types/twinView';
import { heatmapScales } from '../../services/twinAdapter';
import { HEAT_SCALES, heatGradient } from './neonplan/heatmap';

const modes: { value: TwinHeatmapMode; label: string }[] = [
  { value: 'normal', label: 'Bình thường' }, { value: 'temperature', label: 'Nhiệt độ' },
  { value: 'humidity', label: 'Độ ẩm' }, { value: 'air-quality', label: 'Chất lượng không khí' }, { value: 'co2', label: 'CO₂' },
];
export function TwinHeatmapToolbar({ value, onChange }: { value: TwinHeatmapMode; onChange: (mode: TwinHeatmapMode) => void }) {
  const scale = value === 'normal' || value === 'air-quality' ? null : HEAT_SCALES[value];
  return <div className="max-w-full space-y-2 rounded-2xl border border-line bg-surface/95 p-1 shadow-soft">
    <div aria-label="Heatmap" className="flex flex-wrap gap-1">{modes.map((mode) => <button type="button" key={mode.value} aria-pressed={value === mode.value} onClick={() => onChange(mode.value)} className={`min-h-11 rounded-xl px-3 text-xs font-semibold ${value === mode.value ? 'bg-info-soft text-primary-hover ring-1 ring-primary' : 'text-muted hover:bg-sidebar-hover'}`}>{mode.label}</button>)}</div>
    {value !== 'normal' ? <div role="status" className="px-2 pb-1 text-[10px] text-muted">{scale ? <div className="mb-1 h-1 rounded-full" style={{ background: heatGradient(value as 'temperature' | 'humidity' | 'co2') }} /> : null}{scale?.stops[0][0] ?? heatmapScales[value].min} → {scale?.stops.at(-1)?.[0] ?? heatmapScales[value].max} {heatmapScales[value].unit} · Thiếu dữ liệu ACTIVE: màu trung tính</div> : null}
  </div>;
}
