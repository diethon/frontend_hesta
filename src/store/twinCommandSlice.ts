import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { deviceCommandService, type TwinDeviceCommand } from '../services/deviceCommandService';
import type { TwinState } from './twinSlice';
import { twinClosed } from './twinSlice';
import { currentHomeChanged, currentHomeCleared } from './homeSlice';
import { sessionEnded } from './authSlice';

interface CommandFeedback { requestId: string; pending: boolean; error: string | null; acknowledged: boolean }
interface CommandState { byId: Record<string, CommandFeedback> }
const initialState: CommandState = { byId: {} };

export const executeTwinCommand = createAsyncThunk<void, { homeId: string; deviceId: string; command: TwinDeviceCommand },
  { state: { twin: TwinState; twinCommand: CommandState }; rejectValue: string }>(
  'twinCommand/execute',
  async ({ deviceId, command }, { rejectWithValue }) => {
    try { await deviceCommandService.execute(deviceId, command); }
    catch (error) { return rejectWithValue(error instanceof Error ? error.message : 'Không thể gửi lệnh.'); }
  },
  { condition: ({ homeId, deviceId }, { getState }) => {
    const state = getState();
    const device = state.twin.devicesById[deviceId];
    return state.twin.homeId === homeId && device?.status === 'ONLINE' && device.healthStatus === 'ACTIVE'
      && !state.twinCommand.byId[deviceId]?.pending;
  } },
);

const slice = createSlice({
  name: 'twinCommand', initialState, reducers: {},
  extraReducers: (builder) => builder
    .addCase(twinClosed, () => initialState)
    .addCase(currentHomeChanged, () => initialState)
    .addCase(currentHomeCleared, () => initialState)
    .addCase(sessionEnded, () => initialState)
    .addCase(executeTwinCommand.pending, (state, action) => {
      state.byId[action.meta.arg.deviceId] = { requestId: action.meta.requestId, pending: true, error: null, acknowledged: false };
    })
    .addCase(executeTwinCommand.fulfilled, (state, action) => {
      const feedback = state.byId[action.meta.arg.deviceId];
      if (feedback?.requestId !== action.meta.requestId) return;
      feedback.pending = false; feedback.acknowledged = true;
    })
    .addCase(executeTwinCommand.rejected, (state, action) => {
      const feedback = state.byId[action.meta.arg.deviceId];
      if (feedback?.requestId !== action.meta.requestId) return;
      feedback.pending = false; feedback.error = action.payload ?? 'Không thể gửi lệnh.';
    }),
});
export const twinCommandReducer = slice.reducer;
