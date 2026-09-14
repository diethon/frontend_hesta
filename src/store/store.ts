import { configureStore } from '@reduxjs/toolkit';
import { readStoredSession } from '../services/session';
import { authReducer, sessionRestored } from './authSlice';
import { homeReducer } from './homeSlice';
import { realtimeReducer } from './realtimeSlice';

export function createAppStore() {
  const createdStore = configureStore({
    reducer: {
      auth: authReducer,
      home: homeReducer,
      realtime: realtimeReducer,
    },
  });
  createdStore.dispatch(sessionRestored(readStoredSession()));
  return createdStore;
}

export const store = createAppStore();

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
