import type { RootState } from './store';

export const selectAccessToken = (state: RootState) => state.auth.accessToken;
export const selectCurrentUser = (state: RootState) => state.auth.user;
export const selectSessionInitialized = (state: RootState) => state.auth.initialized;
export const selectCurrentHomeId = (state: RootState) => state.home.currentHomeId;
export const selectCurrentHomeRole = (state: RootState) => state.home.currentHomeRole;
export const selectCurrentHomeAccessScope = (state: RootState) => state.home.currentHomeAccessScope;
export const selectRealtimeStatus = (state: RootState) => state.realtime.status;
export const selectRealtimeState = (state: RootState) => state.realtime;
