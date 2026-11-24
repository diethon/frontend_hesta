import { useEffect, useId, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface MaintenanceModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

/** Shared dialog shell for the maintenance screens (user + admin). */
export function MaintenanceModal({ title, subtitle, onClose, children, footer, wide }: MaintenanceModalProps) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-xs"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId}
        className={`w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'} max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-line bg-surface text-text shadow-2xl`}>
        <header className="flex items-start justify-between gap-3 border-b border-line/60 px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-bold truncate">{title}</h2>
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" aria-label="Đóng" onClick={onClose}
            className="rounded-xl p-2 text-muted hover:bg-surface-hover hover:text-text">
            <X className="w-5 h-5" />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4 space-y-5">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line/60 px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

export const btn = 'inline-flex items-center justify-center gap-1.5 min-h-[40px] rounded-xl px-4 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
export const btnPrimary = `${btn} bg-primary text-white hover:bg-primary-hover`;
export const btnGhost = `${btn} border border-line text-text hover:bg-surface-hover`;
export const btnDanger = `${btn} border border-rose-500/40 text-rose-600 hover:bg-rose-500/10`;
export const fieldClass = 'w-full min-h-[40px] rounded-xl border border-line bg-surface px-3 py-2 text-sm text-text placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';
export const labelClass = 'block text-xs font-semibold text-text mb-1';
