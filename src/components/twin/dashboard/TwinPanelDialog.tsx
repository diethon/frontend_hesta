import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** Native modal owns focus trapping, Escape and focus restoration. */
export function TwinPanelDialog({ open, title, side, onDismiss, children }: {
  open: boolean; title: string; side: 'left' | 'right'; onDismiss: () => void; children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    else if (!open && element.open) element.close();
  }, [open]);
  return <dialog ref={dialog} aria-labelledby={titleId} className={`twin-panel-dialog twin-panel-${side}`}
    onCancel={(event) => { event.preventDefault(); onDismiss(); }} onClose={() => { if (open) onDismiss(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onDismiss(); }}>
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-4 py-3"><h2 id={titleId} className="text-sm font-semibold text-text">{title}</h2><button type="button" aria-label="Đóng bảng điều khiển" onClick={onDismiss} className="flex h-11 w-11 items-center justify-center rounded-xl text-muted hover:bg-app"><X size={18} /></button></header>
    {open ? children : null}
  </dialog>;
}
