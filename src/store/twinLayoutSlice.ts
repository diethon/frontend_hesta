import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { ApiError } from '../services/apiClient';
import { getMyHomes, type HomeSummary } from '../services/homeApi';
import { getTwinLayout, putTwinLayout } from '../services/twinLayoutApi';
import type { TwinArchitecture, TwinLayout, TwinLayoutGeometry } from '../types/twinLayout';
import { geometryError, layoutRequest, sameGeometry } from '../components/twin/layoutGeometry';
import { currentHomeChanged, currentHomeCleared } from './homeSlice';
import { sessionEnded } from './authSlice';
import { twinOpened, twinClosed } from './twinSlice';

interface LayoutFailure { kind: 'conflict' | 'forbidden' | 'error'; message: string }
export interface TwinLayoutState {
  homeId: string | null;
  confirmed: TwinLayout | null;
  draft: TwinLayoutGeometry | null;
  dirty: boolean;
  metadataDirty: boolean;
  loading: boolean;
  saving: boolean;
  requestId: string | null;
  roleRequestId: string | null;
  role: HomeSummary['role'] | null;
  roleError: string | null;
  error: LayoutFailure | null;
}
export const emptyLayoutState = (homeId: string | null = null): TwinLayoutState => ({
  homeId, confirmed: null, draft: null, dirty: false, metadataDirty: false, loading: false, saving: false,
  requestId: null, roleRequestId: null, role: null, roleError: null, error: null,
});
type ThunkConfig = { state: { twinLayout: TwinLayoutState }; rejectValue: LayoutFailure };
function failure(error: unknown): LayoutFailure {
  if (error instanceof ApiError && (error.status === 409 || error.code === 1130)) return {
    kind: 'conflict', message: 'Sơ đồ đã được lưu từ phiên khác. Bản nháp của bạn được giữ lại. Tải sơ đồ mới nhất sẽ thay thế bản nháp.',
  };
  if (error instanceof ApiError && error.status === 403) return {
    kind: 'forbidden', message: 'Bạn không có quyền thực hiện thao tác này. Bản nháp được giữ lại; hãy kiểm tra quyền thành viên trước khi tiếp tục.',
  };
  return { kind: 'error', message: error instanceof Error ? error.message : 'Không thể tải hoặc lưu sơ đồ. Vui lòng thử lại.' };
}
export const loadLayoutRole = createAsyncThunk<HomeSummary['role'] | null, string, ThunkConfig>(
  'twinLayout/loadRole', async (homeId, { rejectWithValue }) => {
    try { return (await getMyHomes()).find((home) => home.homeId === homeId)?.role ?? null; }
    catch (error) { return rejectWithValue(failure(error)); }
  }, { condition: (homeId, { getState }) => getState().twinLayout.homeId === homeId && !getState().twinLayout.roleRequestId },
);
export const loadTwinLayout = createAsyncThunk<TwinLayout, string, ThunkConfig>(
  'twinLayout/load', async (homeId, { signal, rejectWithValue }) => {
    try { return await getTwinLayout(homeId, signal); }
    catch (error) { return rejectWithValue(failure(error)); }
  }, { condition: (homeId, { getState }) => {
    const state = getState().twinLayout;
    return state.homeId === homeId && !state.loading && !state.saving;
  } },
);
export const saveTwinLayout = createAsyncThunk<TwinLayout, string, ThunkConfig>(
  'twinLayout/save', async (homeId, { getState, signal, rejectWithValue }) => {
    const { draft, confirmed } = getState().twinLayout;
    if (!draft || !confirmed) return rejectWithValue(failure(new Error('Chưa tải sơ đồ.')));
    const validation = geometryError(draft);
    if (validation) return rejectWithValue(failure(new Error(validation)));
    try { return await putTwinLayout(homeId, layoutRequest(draft, confirmed.revision), signal); }
    catch (error) { return rejectWithValue(failure(error)); }
  }, { condition: (homeId, { getState }) => {
    const state = getState().twinLayout;
    return state.homeId === homeId && state.role === 'OWNER' && !!state.draft && !!state.confirmed
      && (state.dirty || state.metadataDirty) && !state.loading && !state.saving && state.error?.kind !== 'conflict' && state.error?.kind !== 'forbidden';
  } },
);
const slice = createSlice({
  name: 'twinLayout', initialState: emptyLayoutState(),
  reducers: {
    layoutEditingStarted(state, action: PayloadAction<TwinLayoutGeometry | undefined>) {
      if (!state.confirmed || state.role !== 'OWNER' || state.loading || state.saving || state.draft) return;
      const { rooms, nodes, architecture } = layoutRequest(action.payload ?? state.confirmed, state.confirmed.revision);
      state.draft = { rooms, nodes, ...(architecture ? { architecture } : {}) };
      state.dirty = !sameGeometry(state.draft, state.confirmed);
      state.metadataDirty = false;
      state.error = null;
    },
    layoutDraftChanged(state, action: PayloadAction<TwinLayoutGeometry>) {
      if (!state.draft || !state.confirmed || state.saving || state.loading || state.role !== 'OWNER') return;
      if (geometryError(action.payload)) return;
      state.draft = { rooms: action.payload.rooms, nodes: action.payload.nodes, ...(state.draft.architecture ? { architecture: state.draft.architecture } : {}) };
      state.dirty = !sameGeometry(state.draft, state.confirmed);
    },
    layoutMetadataDirtyChanged(state, action: PayloadAction<boolean>) {
      if (!state.draft || state.saving || state.loading || state.role !== 'OWNER') return;
      state.metadataDirty = action.payload;
    },
    layoutArchitectureChanged(state, action: PayloadAction<TwinArchitecture>) {
      if (!state.draft || state.saving || state.loading || state.role !== 'OWNER') return;
      state.draft.architecture = action.payload;
      state.metadataDirty = true;
    },
    layoutEditingCancelled(state) {
      if (state.saving || state.loading) return;
      state.draft = null; state.dirty = false; state.metadataDirty = false; state.error = null;
    },
  },
  extraReducers: (builder) => builder
    .addCase(twinOpened, (_state, action) => emptyLayoutState(action.payload))
    .addCase(twinClosed, () => emptyLayoutState())
    .addCase(currentHomeCleared, () => emptyLayoutState())
    .addCase(currentHomeChanged, (state, action) => { if (state.homeId !== action.payload) return emptyLayoutState(); })
    .addCase(sessionEnded, () => emptyLayoutState())
    .addCase(loadLayoutRole.pending, (state, action) => { state.roleRequestId = action.meta.requestId; state.roleError = null; })
    .addCase(loadLayoutRole.fulfilled, (state, action) => {
      if (state.homeId !== action.meta.arg || state.roleRequestId !== action.meta.requestId) return;
      state.role = action.payload; state.roleRequestId = null;
      if (state.error?.kind === 'forbidden') state.error = null;
    })
    .addCase(loadLayoutRole.rejected, (state, action) => {
      if (state.homeId !== action.meta.arg || state.roleRequestId !== action.meta.requestId) return;
      state.roleRequestId = null;
      if (!action.meta.aborted) state.roleError = 'Không thể kiểm tra quyền sửa sơ đồ.';
    })
    .addCase(loadTwinLayout.pending, (state, action) => { state.loading = true; state.requestId = action.meta.requestId; state.error = null; })
    .addCase(saveTwinLayout.pending, (state, action) => { state.saving = true; state.requestId = action.meta.requestId; state.error = null; })
    .addMatcher((action) => loadTwinLayout.fulfilled.match(action) || saveTwinLayout.fulfilled.match(action), (state, action: ReturnType<typeof loadTwinLayout.fulfilled>) => {
      if (state.homeId !== action.meta.arg || state.requestId !== action.meta.requestId) return;
      state.confirmed = action.payload;
      state.draft = null; state.dirty = false; state.metadataDirty = false; state.loading = false; state.saving = false; state.requestId = null; state.error = null;
    })
    .addMatcher((action) => loadTwinLayout.rejected.match(action) || saveTwinLayout.rejected.match(action), (state, action: ReturnType<typeof loadTwinLayout.rejected>) => {
      if (state.homeId !== action.meta.arg || state.requestId !== action.meta.requestId) return;
      state.loading = false; state.saving = false; state.requestId = null;
      if (!action.meta.aborted) state.error = action.payload ?? failure(new Error('Không thể tải hoặc lưu sơ đồ. Vui lòng thử lại.'));
    }),
});
export const { layoutEditingStarted, layoutDraftChanged, layoutMetadataDirtyChanged, layoutArchitectureChanged, layoutEditingCancelled } = slice.actions;
export const twinLayoutReducer = slice.reducer;
