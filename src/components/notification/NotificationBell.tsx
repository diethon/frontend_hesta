import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  loadNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  notificationFeedbackCleared,
} from '../../store/notificationSlice';
import { selectNotificationState } from '../../store/notificationSelectors';
import { selectCurrentHomeId, selectCurrentUser } from '../../store/selectors';
import type { NotificationPriority, NotificationResponse, NotificationType } from '../../types/notification';
import { notify } from '../ui/notify';

const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const priorityPresentation: Record<NotificationPriority, { label: string; className: string }> = {
  HIGH: { label: 'Ưu tiên cao', className: 'bg-error-soft text-error' },
  MEDIUM: { label: 'Ưu tiên vừa', className: 'bg-warning-soft text-text' },
  LOW: { label: 'Ưu tiên thấp', className: 'bg-info-soft text-primary-hover' },
};

const typeLabels: Record<NotificationType, string> = {
  SECURITY: 'Bảo mật',
  AUTOMATION: 'Tự động hóa',
  ANOMALY: 'Bất thường',
  SYSTEM: 'Hệ thống',
  DEVICE: 'Thiết bị',
};

function formatCreatedAt(createdAt: string) {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? createdAt : dateTimeFormatter.format(date);
}

function BellIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17H9m8-6a5 5 0 0 0-10 0c0 6-3 6-3 6h16s-3 0-3-6ZM13.7 21h-3.4" />
    </svg>
  );
}

interface NotificationPanelViewProps {
  items: NotificationResponse[];
  unreadCount: number;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  isLoadingMore: boolean;
  isLastPage: boolean;
  markingAll: boolean;
  markingReadIds: string[];
  onMarkRead: (notificationId: string) => void;
  onMarkAllRead: () => void;
  onLoadMore: () => void;
  onRetry: () => void;
}

export function NotificationPanelView({
  items,
  unreadCount,
  status,
  error,
  isLoadingMore,
  isLastPage,
  markingAll,
  markingReadIds,
  onMarkRead,
  onMarkAllRead,
  onLoadMore,
  onRetry,
}: NotificationPanelViewProps) {
  const isInitialLoading = status === 'loading' && items.length === 0;

  return (
    <section
      id="notification-panel"
      aria-labelledby="notification-title"
      className="gentle-rise fixed inset-x-4 top-16 z-50 overflow-hidden rounded-2xl border border-line bg-surface shadow-float sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96"
    >
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 id="notification-title" className="text-base font-bold text-text">Thông báo</h2>
          <p className="text-xs text-muted">{unreadCount} thông báo chưa đọc</p>
        </div>
        <button
          type="button"
          onClick={onMarkAllRead}
          disabled={markingAll || unreadCount === 0}
          className="min-h-11 rounded-xl px-3 text-xs font-semibold text-primary-hover transition-colors hover:bg-info-soft disabled:text-muted disabled:opacity-60"
        >
          {markingAll ? 'Đang xử lý…' : 'Đọc tất cả'}
        </button>
      </header>

      <div className="custom-scrollbar max-h-96 overflow-y-auto">
        {isInitialLoading ? (
          <div aria-label="Đang tải thông báo" className="space-y-3 p-4">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-24 animate-pulse rounded-2xl bg-off-soft" />
            ))}
          </div>
        ) : status === 'failed' && items.length === 0 ? (
          <div className="p-6 text-center">
            <p role="alert" className="text-sm text-text">{error || 'Không thể tải thông báo.'}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              Thử lại
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-info-soft text-primary">
              <BellIcon />
            </div>
            <p className="mt-3 text-sm font-semibold text-text">Chưa có thông báo</p>
            <p className="mt-1 text-xs leading-5 text-muted">Các cập nhật mới của ngôi nhà sẽ xuất hiện tại đây.</p>
          </div>
        ) : (
          <>
            {error ? (
              <div role="alert" className="flex items-center justify-between gap-3 border-b border-line bg-error-soft px-4 py-2 text-xs text-text">
                <span>{error}</span>
                <button type="button" onClick={onRetry} className="shrink-0 font-semibold text-primary-hover">Thử lại</button>
              </div>
            ) : null}
            <ul className="divide-y divide-line">
              {items.map((notification) => {
                const priority = priorityPresentation[notification.priority];
                const markingRead = markingReadIds.includes(notification.id);
                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => onMarkRead(notification.id)}
                      disabled={notification.isRead || markingRead}
                      aria-label={notification.isRead
                        ? `${notification.title}, đã đọc`
                        : `${notification.title}, đánh dấu là đã đọc`}
                      className={`w-full px-4 py-3 text-left transition-colors disabled:cursor-default ${
                        notification.isRead ? 'bg-surface' : 'bg-info-soft/60 hover:bg-info-soft'
                      }`}
                    >
                      <span className="flex items-start gap-3">
                        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${notification.isRead ? 'bg-off' : 'bg-primary'}`} />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-text">{notification.title}</span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${priority.className}`}>
                              {priority.label}
                            </span>
                          </span>
                          <span className="mt-1 block text-sm leading-5 text-muted">{notification.message}</span>
                          <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                            <span>{typeLabels[notification.type]}</span>
                            <span aria-hidden="true">•</span>
                            <time dateTime={notification.createdAt}>{formatCreatedAt(notification.createdAt)}</time>
                            {markingRead ? <span>Đang cập nhật…</span> : null}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {!isLastPage ? (
              <div className="border-t border-line p-3 text-center">
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={isLoadingMore}
                  className="min-h-11 rounded-xl px-4 text-sm font-semibold text-primary-hover transition-colors hover:bg-info-soft disabled:text-muted"
                >
                  {isLoadingMore ? 'Đang tải…' : 'Xem thông báo cũ hơn'}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

export function NotificationBell() {
  const dispatch = useAppDispatch();
  const notificationState = useAppSelector(selectNotificationState);
  const user = useAppSelector(selectCurrentUser);
  const currentHomeId = useAppSelector(selectCurrentHomeId);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const reload = () => {
    if (!user) return;
    dispatch(notificationFeedbackCleared());
    void dispatch(loadNotifications({ userId: user.id, homeId: currentHomeId }));
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={notificationState.unreadCount > 0
          ? `Mở thông báo, ${notificationState.unreadCount} chưa đọc`
          : 'Mở thông báo'}
        aria-expanded={open}
        aria-controls="notification-panel"
        onClick={() => setOpen((current) => !current)}
        className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-surface text-icon shadow-soft transition-colors hover:bg-sidebar-hover hover:text-primary-hover"
      >
        <BellIcon />
        {notificationState.unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 text-xs font-bold text-white">
            {notificationState.unreadCount > 99 ? '99+' : notificationState.unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <NotificationPanelView
          items={notificationState.items}
          unreadCount={notificationState.unreadCount}
          status={notificationState.status}
          error={notificationState.error}
          isLoadingMore={notificationState.isLoadingMore}
          isLastPage={notificationState.last}
          markingAll={notificationState.markingAll}
          markingReadIds={notificationState.markingReadIds}
          onMarkRead={(notificationId) => {
            const notification = notificationState.items.find((item) => item.id === notificationId);
            if (!notification || notification.isRead) return;
            void dispatch(markNotificationAsRead(notificationId)).then((action) => {
              if (markNotificationAsRead.fulfilled.match(action)) notify.success('Đã đánh dấu thông báo là đã đọc');
              else notify.error(action.payload ?? 'Không thể đánh dấu thông báo đã đọc.');
            });
          }}
          onMarkAllRead={() => {
            void dispatch(markAllNotificationsAsRead(currentHomeId)).then((action) => {
              if (markAllNotificationsAsRead.fulfilled.match(action)) {
                notify.success(action.payload.updatedCount > 0
                  ? `Đã đánh dấu ${action.payload.updatedCount} thông báo là đã đọc`
                  : 'Tất cả thông báo đã được đọc');
              } else {
                notify.error(action.payload ?? 'Không thể đánh dấu tất cả thông báo đã đọc.');
              }
            });
          }}
          onLoadMore={() => {
            if (!user || notificationState.last || notificationState.isLoadingMore) return;
            void dispatch(loadNotifications({
              userId: user.id,
              homeId: currentHomeId,
              page: notificationState.page + 1,
            }));
          }}
          onRetry={reload}
        />
      ) : null}
    </div>
  );
}
