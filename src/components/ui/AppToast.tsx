import { AlertCircle, Check, Info, TriangleAlert, X } from 'lucide-react';
import toast, { Toaster, type Toast } from 'react-hot-toast';

type ToastTone = 'success' | 'error' | 'warning' | 'info';

const presentation = {
  success: { label: 'Thành công', icon: Check, iconClass: 'bg-success-soft text-mint-hover', borderClass: 'border-l-success' },
  error: { label: 'Có lỗi xảy ra', icon: AlertCircle, iconClass: 'bg-error-soft text-error', borderClass: 'border-l-error' },
  warning: { label: 'Cần chú ý', icon: TriangleAlert, iconClass: 'bg-warning-soft text-text', borderClass: 'border-l-warning' },
  info: { label: 'Thông tin', icon: Info, iconClass: 'bg-info-soft text-primary-hover', borderClass: 'border-l-info' },
} as const;

export function ToastCard({ item, tone, message, detail }: { item: Toast; tone: ToastTone; message: string; detail?: string }) {
  const style = presentation[tone];
  const Icon = style.icon;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      data-visible={item.visible}
      className={`hesta-toast pointer-events-auto flex w-72 items-start gap-3 rounded-2xl border border-l-4 border-line bg-surface p-4 shadow-float sm:w-96 ${style.borderClass}`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.iconClass}`}>
        <Icon aria-hidden="true" size={20} strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-muted">{style.label}</span>
        <span className="mt-0.5 block break-words text-sm font-semibold leading-5 text-text">{message}</span>
        {detail ? <span className="mt-1 block break-words text-xs leading-5 text-muted">{detail}</span> : null}
      </span>
      <button
        type="button"
        onClick={() => toast.dismiss(item.id)}
        aria-label="Đóng thông báo"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-icon hover:bg-sidebar-hover hover:text-text focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <X aria-hidden="true" size={16} />
      </button>
    </div>
  );
}

export function AppToaster() {
  return <Toaster position="top-right" gutter={12} containerStyle={{ top: 20, right: 16 }} />;
}
