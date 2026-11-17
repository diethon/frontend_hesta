import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, Info, Loader2, Trash2 } from 'lucide-react';
import { subscribeConfirmDialog, type ConfirmRequest, type ConfirmVariant } from './confirmDialog';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const tones: Record<ConfirmVariant, { icon: React.ReactNode; badge: string; button: string }> = {
  danger: { icon: <Trash2 size={22} aria-hidden="true" />, badge: 'bg-error-soft text-error', button: 'bg-error text-text hover:brightness-95' },
  warning: { icon: <AlertTriangle size={22} aria-hidden="true" />, badge: 'bg-warning-soft text-text', button: 'bg-warning text-text hover:brightness-95' },
  primary: { icon: <Info size={22} aria-hidden="true" />, badge: 'bg-info-soft text-primary-hover', button: 'bg-primary text-text hover:bg-primary-hover' },
};

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  description,
  confirmText = 'Xóa vĩnh viễn',
  cancelText = 'Hủy bỏ',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  const titleId = useId();
  const descriptionId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    // Destructive actions start on "Hủy" so Enter never deletes by accident.
    (variant === 'danger' ? cancelButton : confirmButton).current?.focus();
    return () => previous?.focus?.();
  }, [isOpen, variant]);

  if (!isOpen) return null;
  const tone = tones[variant];

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && !loading) { event.stopPropagation(); onCancel(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...(panel.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])];
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-text/25 p-4 backdrop-blur-sm sm:items-center" onClick={() => { if (!loading) onCancel(); }}>
      <div
        ref={panel}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onKeyDown={onKeyDown}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 text-text shadow-float"
      >
        <div className="flex items-start gap-4">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone.badge}`}>{tone.icon}</span>
          <div className="min-w-0 flex-1 pt-1">
            <h2 id={titleId} className="text-base font-semibold leading-snug text-text">{title}</h2>
            {description ? <p id={descriptionId} className="mt-1.5 text-sm leading-relaxed text-muted">{description}</p> : null}
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <button ref={cancelButton} type="button" disabled={loading} onClick={onCancel} className="min-h-11 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-text hover:bg-sidebar-hover disabled:opacity-50">
            {cancelText}
          </button>
          <button ref={confirmButton} type="button" disabled={loading} onClick={onConfirm} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50 ${tone.button}`}>
            {loading ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

/** Mount once near the app root; serves every confirmDialog() call. */
export function ConfirmDialogHost() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  useEffect(() => subscribeConfirmDialog((next) => setRequest((previous) => { previous?.resolve(false); return next; })), []);
  const close = (confirmed: boolean) => { request?.resolve(confirmed); setRequest(null); };
  return <ConfirmModal
    isOpen={!!request}
    title={request?.title ?? ''}
    description={request?.description ?? ''}
    confirmText={request?.confirmText ?? 'Đồng ý'}
    cancelText={request?.cancelText ?? 'Hủy'}
    variant={request?.variant ?? 'primary'}
    onConfirm={() => close(true)}
    onCancel={() => close(false)}
  />;
}
