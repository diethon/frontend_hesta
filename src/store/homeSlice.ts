import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface HomeState {
  currentHomeId: string | null;
  currentHomeRole: 'OWNER' | 'MEMBER' | null;
  currentHomeAccessScope: 'ALL' | 'CUSTOM' | null;
}

const initialState: HomeState = {
  currentHomeId: null,
  currentHomeRole: null,
  currentHomeAccessScope: null,
};

const homeSlice = createSlice({
  name: 'home',
  initialState,
  reducers: {
    currentHomeChanged(state, action: PayloadAction<string | null>) {
      state.currentHomeId = action.payload;
    },
    currentHomeDetailsChanged(
      state,
      action: PayloadAction<{
        homeId: string | null;
        role?: 'OWNER' | 'MEMBER' | null;
        accessScope?: 'ALL' | 'CUSTOM' | null;
      }>
    ) {
      state.currentHomeId = action.payload.homeId;
      if (action.payload.role !== undefined) state.currentHomeRole = action.payload.role;
      if (action.payload.accessScope !== undefined) state.currentHomeAccessScope = action.payload.accessScope;
    },
    currentHomeCleared(state) {
      state.currentHomeId = null;
      state.currentHomeRole = null;
      state.currentHomeAccessScope = null;
    },
  },
});

export const { currentHomeChanged, currentHomeDetailsChanged, currentHomeCleared } = homeSlice.actions;
export const homeReducer = homeSlice.reducer;
