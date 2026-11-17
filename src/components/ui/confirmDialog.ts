export type ConfirmVariant = 'danger' | 'warning' | 'primary';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
}

export type ConfirmRequest = ConfirmOptions & { resolve: (confirmed: boolean) => void };

let listener: ((request: ConfirmRequest) => void) | null = null;

/** Styled replacement for window.confirm. Resolves true only when the user confirms. */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  if (!listener) {
    // Host not mounted (tests or very early boot): fall back to the native dialog.
    if (typeof window === 'undefined' || typeof window.confirm !== 'function') return Promise.resolve(false);
    return Promise.resolve(window.confirm(options.description ? `${options.title}\n\n${options.description}` : options.title));
  }
  return new Promise((resolve) => listener?.({ ...options, resolve }));
}

export function subscribeConfirmDialog(next: (request: ConfirmRequest) => void) {
  listener = next;
  return () => { if (listener === next) listener = null; };
}
