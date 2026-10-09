import { configureStore } from '@reduxjs/toolkit';
import { readStoredSession } from '../services/session';
import { authReducer, sessionRestored } from './authSlice';
import { homeReducer } from './homeSlice';
import { notificationReducer } from './notificationSlice';
import { realtimeReducer } from './realtimeSlice';
import { twinReducer } from './twinSlice';
import { twinLayoutReducer } from './twinLayoutSlice';
import { twinCommandReducer } from './twinCommandSlice';

export function createAppStore() {
  const createdStore = configureStore({
    reducer: {
      auth: authReducer,
      home: homeReducer,
      notification: notificationReducer,
      realtime: realtimeReducer,
      twin: twinReducer,
      twinLayout: twinLayoutReducer,
      twinCommand: twinCommandReducer,
    },
  });
  createdStore.dispatch(sessionRestored(readStoredSession()));
  return createdStore;
}

export const store = createAppStore();

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
