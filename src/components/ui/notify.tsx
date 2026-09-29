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

export const notify = {
  success: (message: string, detail?: string) => show('success', message, detail),
  error: (message: string, detail?: string) => show('error', message, detail),
  warning: (message: string, detail?: string) => show('warning', message, detail),
  info: (message: string, detail?: string, id?: string) => show('info', message, detail, id),
  dismissAll: () => toast.dismiss(),
};
