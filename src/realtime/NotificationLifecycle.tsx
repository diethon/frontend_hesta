import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  loadNotifications,
  notificationScopeChanged,
  notificationsCleared,
  receiveNotificationFromRealtime,
} from '../store/notificationSlice';
import { selectAccessToken, selectCurrentHomeId, selectCurrentUser } from '../store/selectors';
import { realtimeEventDispatcher } from './realtimeEvents';

export function NotificationLifecycle() {
  const dispatch = useAppDispatch();
  const accessToken = useAppSelector(selectAccessToken);
  const user = useAppSelector(selectCurrentUser);
  const currentHomeId = useAppSelector(selectCurrentHomeId);

  useEffect(() => realtimeEventDispatcher.register('NOTIFICATION_CREATED', (event) => {
    void dispatch(receiveNotificationFromRealtime(event));
  }), [dispatch]);

  useEffect(() => {
    if (!accessToken || !user) {
      dispatch(notificationsCleared());
      return;
    }

    const scope = { userId: user.id, homeId: currentHomeId };
    dispatch(notificationScopeChanged(scope));
    void dispatch(loadNotifications(scope));
  }, [accessToken, currentHomeId, dispatch, user]);

  return null;
}
