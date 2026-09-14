import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RealtimeEvent } from '../realtime/realtimeTypes';

export type RealtimeConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

interface RealtimeState {
  status: RealtimeConnectionStatus;
  activeHomeId: string | null;
  lastEventAt: string | null;
  error: string | null;
}

const initialState: RealtimeState = {
  status: 'disconnected',
  activeHomeId: null,
  lastEventAt: null,
  error: null,
};

const realtimeSlice = createSlice({
  name: 'realtime',
  initialState,
  reducers: {
    connectionStatusChanged(state, action: PayloadAction<RealtimeConnectionStatus>) {
      state.status = action.payload;
      if (action.payload !== 'error') state.error = null;
    },
    homeSubscriptionChanged(state, action: PayloadAction<string | null>) {
      state.activeHomeId = action.payload;
    },
    realtimeEventReceived(state, action: PayloadAction<RealtimeEvent>) {
      state.lastEventAt = action.payload.timestamp;
      state.error = null;
    },
    realtimeErrorOccurred(state, action: PayloadAction<string>) {
      state.status = 'error';
      state.error = action.payload;
    },
    realtimeReset() {
      return initialState;
    },
  },
});

export const {
  connectionStatusChanged,
  homeSubscriptionChanged,
  realtimeErrorOccurred,
  realtimeEventReceived,
  realtimeReset,
} = realtimeSlice.actions;
export const realtimeReducer = realtimeSlice.reducer;
