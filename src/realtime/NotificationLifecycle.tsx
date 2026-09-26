import { useEffect } from 'react';
import { useStore } from 'react-redux';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type { RootState } from '../store/store';
import {
  loadNotifications,
  notificationScopeChanged,
  notificationsCleared,
  receiveNotificationFromRealtime,
} from '../store/notificationSlice';
import { selectAccessToken, selectCurrentHomeId, selectCurrentUser } from '../store/selectors';
import { realtimeEventDispatcher } from './realtimeEvents';
import { notify } from '../components/ui/notify';

export function NotificationLifecycle() {
  const dispatch = useAppDispatch();
  const reduxStore = useStore<RootState>();
  const accessToken = useAppSelector(selectAccessToken);
  const user = useAppSelector(selectCurrentUser);
  const currentHomeId = useAppSelector(selectCurrentHomeId);

  useEffect(() => realtimeEventDispatcher.register('NOTIFICATION_CREATED', (event) => {
    void dispatch(receiveNotificationFromRealtime(event)).then((action) => {
      if (receiveNotificationFromRealtime.fulfilled.match(action) && action.payload) {
        const state = reduxStore.getState();
        if (state.auth.user?.id !== action.payload.userId || state.home.currentHomeId !== action.payload.homeId) return;
        notify.info(action.payload.title, action.payload.message, `notification-${action.payload.id}`);
      }
    });
  }), [dispatch, reduxStore]);

  useEffect(() => {
    if (!accessToken || !user) {
      notify.dismissAll();
      dispatch(notificationsCleared());
      return;
    }

    const scope = { userId: user.id, homeId: currentHomeId };
    dispatch(notificationScopeChanged(scope));
    void dispatch(loadNotifications(scope));
  }, [accessToken, currentHomeId, dispatch, user]);

  return null;
}
