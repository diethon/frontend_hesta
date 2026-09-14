import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AuthResponse, UserResponse } from '../types/auth';
import type { StoredSession } from '../services/session';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserResponse | null;
  initialized: boolean;
}

const initialState: AuthState = {
  accessToken: null,
  refreshToken: null,
  user: null,
  initialized: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    sessionRestored(state, action: PayloadAction<StoredSession | null>) {
      state.accessToken = action.payload?.accessToken ?? null;
      state.refreshToken = action.payload?.refreshToken ?? null;
      state.user = action.payload?.user ?? null;
      state.initialized = true;
    },
    sessionAuthenticated(state, action: PayloadAction<AuthResponse>) {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.user = action.payload.user;
      state.initialized = true;
    },
    currentUserUpdated(state, action: PayloadAction<UserResponse>) {
      state.user = action.payload;
    },
    sessionEnded(state) {
      state.accessToken = null;
      state.refreshToken = null;
      state.user = null;
      state.initialized = true;
    },
  },
});

export const { currentUserUpdated, sessionAuthenticated, sessionEnded, sessionRestored } = authSlice.actions;
export const authReducer = authSlice.reducer;
