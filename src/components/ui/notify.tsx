import toast from 'react-hot-toast';
import { ToastCard } from './AppToast';

type ToastTone = 'success' | 'error' | 'warning' | 'info';

function show(tone: ToastTone, message: string, detail?: string, id?: string) {
  return toast.custom((item) => <ToastCard item={item} tone={tone} message={message} detail={detail} />, {
    id,
    duration: tone === 'error' ? 6000 : 4000,
    ariaProps: { role: tone === 'error' ? 'alert' : 'status', 'aria-live': tone === 'error' ? 'assertive' : 'polite' },
  });
}

interface NotifyFn {
  (message: string, tone?: ToastTone, detail?: string): unknown;
  success: (message: string, detail?: string) => unknown;
  error: (message: string, detail?: string) => unknown;
  warning: (message: string, detail?: string) => unknown;
  info: (message: string, detail?: string, id?: string) => unknown;
  dismissAll: () => void;
}

const notifyFn = ((message: string, tone: ToastTone = 'info', detail?: string) => {
  return show(tone, message, detail);
}) as NotifyFn;

notifyFn.success = (message: string, detail?: string) => show('success', message, detail);
notifyFn.error = (message: string, detail?: string) => show('error', message, detail);
notifyFn.warning = (message: string, detail?: string) => show('warning', message, detail);
notifyFn.info = (message: string, detail?: string, id?: string) => show('info', message, detail, id);
notifyFn.dismissAll = () => toast.dismiss();

export const notify = notifyFn;
