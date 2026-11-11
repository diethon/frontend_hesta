import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  selectAccessToken,
  selectCurrentHomeId,
  selectCurrentHomeAccessScope,
} from '../store/selectors';
import {
  connectionStatusChanged,
  homeSubscriptionChanged,
  realtimeErrorOccurred,
  realtimeEventReceived,
} from '../store/realtimeSlice';
import { realtimeClient } from './realtimeClient';
import { realtimeEventDispatcher } from './realtimeEvents';

export function RealtimeLifecycle() {
  const dispatch = useAppDispatch();
  const accessToken = useAppSelector(selectAccessToken);
  const currentHomeId = useAppSelector(selectCurrentHomeId);
  const currentAccessScope = useAppSelector(selectCurrentHomeAccessScope);
  const isCustom = currentAccessScope === 'CUSTOM';

  useEffect(() => {
    realtimeClient.setCallbacks({
      onStatusChange: (status) => dispatch(connectionStatusChanged(status)),
      onHomeSubscriptionChange: (homeId) => dispatch(homeSubscriptionChanged(homeId)),
      onEvent: (event) => {
        dispatch(realtimeEventReceived(event));
        realtimeEventDispatcher.dispatch(event);
      },
      onError: (message) => dispatch(realtimeErrorOccurred(message)),
    });
  }, [dispatch]);

  useEffect(() => {
    if (accessToken) void realtimeClient.connect(accessToken);
    else void realtimeClient.disconnect();
    return () => {
      void realtimeClient.disconnect();
    };
  }, [accessToken]);

  useEffect(() => {
    if (currentHomeId) realtimeClient.subscribeToHome(currentHomeId, isCustom);
    else realtimeClient.unsubscribeFromHome();
    return () => {
      realtimeClient.unsubscribeFromHome(currentHomeId ?? undefined);
    };
  }, [currentHomeId, isCustom]);

  return null;
}
