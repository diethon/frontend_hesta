import { Box, LayoutDashboard, Activity } from 'lucide-react';

export type TwinViewMode = 'overview' | '2d' | '3d';

export function TwinViewSwitcher({ mode, disabled = false, onChange }: {
  mode: TwinViewMode;
  disabled?: boolean;
  onChange: (mode: TwinViewMode) => void;
}) {
  const button = (value: TwinViewMode, label: string, icon: React.ReactNode) => <button
    type="button"
    aria-label={`Chế độ ${value === '2d' ? '2D' : value === '3d' ? '3D' : 'Overview'}`}
    aria-pressed={mode === value}
    disabled={disabled}
    onClick={() => onChange(value)}
    className={`flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold disabled:opacity-50 ${mode === value ? 'bg-surface text-primary-hover shadow-soft' : 'text-muted hover:bg-surface'}`}
  >{icon}{label}</button>;
  return <div aria-label="Chọn chế độ hiển thị Digital Twin" className="flex flex-wrap rounded-2xl border border-line bg-info-soft p-1">
    {button('overview', 'Overview', <Activity size={16} aria-hidden="true" />)}
    {button('2d', '2D Layout', <LayoutDashboard size={16} aria-hidden="true" />)}
    {button('3d', '3D Live', <Box size={16} aria-hidden="true" />)}
  </div>;
}
