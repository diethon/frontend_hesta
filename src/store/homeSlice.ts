import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface HomeState {
  currentHomeId: string | null;
}

const initialState: HomeState = {
  currentHomeId: null,
};

const homeSlice = createSlice({
  name: 'home',
  initialState,
  reducers: {
    currentHomeChanged(state, action: PayloadAction<string | null>) {
      state.currentHomeId = action.payload;
    },
    currentHomeCleared(state) {
      state.currentHomeId = null;
    },
  },
});

export const { currentHomeChanged, currentHomeCleared } = homeSlice.actions;
export const homeReducer = homeSlice.reducer;
