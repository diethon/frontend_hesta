import { Box, LayoutDashboard } from 'lucide-react';

export type TwinViewMode = '2d' | '3d';

export function TwinViewSwitcher({ mode, disabled = false, onChange }: {
  mode: TwinViewMode;
  disabled?: boolean;
  onChange: (mode: TwinViewMode) => void;
}) {
  const button = (value: TwinViewMode, label: string, icon: React.ReactNode) => <button
    type="button"
    aria-label={`Chế độ ${label}`}
    aria-pressed={mode === value}
    disabled={disabled}
    onClick={() => onChange(value)}
    className={`flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50 ${mode === value ? 'bg-surface text-primary-hover shadow-soft' : 'text-muted hover:bg-surface'}`}
  >{icon}{label}</button>;
  return <div aria-label="Chọn chế độ hiển thị Digital Twin" className="flex rounded-2xl border border-line bg-info-soft p-1">
    {button('2d', '2D', <LayoutDashboard size={18} aria-hidden="true" />)}
    {button('3d', '3D', <Box size={18} aria-hidden="true" />)}
  </div>;
}
