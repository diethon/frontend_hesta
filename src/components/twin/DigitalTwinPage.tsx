import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { currentHomeChanged, currentHomeCleared } from '../../store/homeSlice';
import { loadTwinSnapshot, twinClosed, twinOpened } from '../../store/twinSlice';
import { TwinDashboardHeader } from './dashboard/TwinDashboardHeader';
import type { TwinRendererTheme } from './scene/rendererTheme';
import { TwinLayoutEditor } from './TwinLayoutEditor';
import { loadLayoutRole, loadTwinLayout } from '../../store/twinLayoutSlice';
import { useLayoutNavigationGuard } from './useLayoutNavigationGuard';
import type { TwinViewMode } from './TwinViewSwitcher';

const connectionLabels = {
  connected: 'Đã kết nối', connecting: 'Đang kết nối…', reconnecting: 'Đang kết nối lại…',
  disconnected: 'Đã ngắt kết nối', error: 'Kết nối bị gián đoạn',
};

export function DigitalTwinView({ homeId, initialMode }: { homeId: string; initialMode?: TwinViewMode }) {
  const dispatch = useAppDispatch();
  const [theme, setTheme] = useState<TwinRendererTheme>('DAYLIGHT');
  const matchesHome = useAppSelector((state) => state.twin.homeId === homeId);
  const loading = useAppSelector((state) => state.twin.loading);
  const initialized = useAppSelector((state) => state.twin.initialized);
  const error = useAppSelector((state) => state.twin.error);
  const status = useAppSelector((state) => state.realtime.status);
  const subscribedHome = useAppSelector((state) => state.realtime.activeHomeId);
  const connected = status === 'connected' && subscribedHome === homeId;
  const connectionLabel = status === 'connected' && !connected ? 'Đang đăng ký nhà…' : connectionLabels[status];
  return <div className="twin-premium-dashboard min-w-0 space-y-4 bg-app p-3 text-text sm:p-5">
    <TwinDashboardHeader homeId={homeId} connected={connected} connectionLabel={connectionLabel} loading={loading} canReload={matchesHome} onReload={() => void dispatch(loadTwinSnapshot(homeId))} theme={theme} onThemeChange={setTheme} />
    {!connected && matchesHome && initialized ? <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-text">Đang hiển thị dữ liệu gần nhất. Sau khi kết nối lại, chọn “Đồng bộ lại” để nhận những thay đổi đã bỏ lỡ.</p> : null}
    {matchesHome && error ? <div role="alert" className="rounded-2xl border border-error bg-error-soft p-5 text-text">
      <p>{error}</p><button type="button" disabled={loading} onClick={() => void dispatch(loadTwinSnapshot(homeId))} className="mt-3 rounded-xl bg-surface px-4 py-3 text-sm font-semibold disabled:opacity-50">Thử lại</button>
    </div> : null}
    {!matchesHome || (!initialized && !error) ? <div role="status" aria-label="Đang tải Digital Twin" className="surface-card p-6">
      <p className="text-sm text-muted">Đang tải Digital Twin…</p><div className="mt-4 h-32 animate-pulse rounded-2xl bg-off-soft" />
    </div> : initialized ? <>
      <TwinLayoutEditor key={homeId} homeId={homeId} initialMode={initialMode} rendererTheme={theme} onRendererThemeChange={setTheme} />
    </> : null}
  </div>;
}

export function DigitalTwinPage() {
  useLayoutNavigationGuard();
  const { homeId = '' } = useParams<{ homeId: string }>();
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(currentHomeChanged(homeId));
    dispatch(twinOpened(homeId));
    const request = dispatch(loadTwinSnapshot(homeId));
    const layoutRequest = dispatch(loadTwinLayout(homeId));
    const roleRequest = dispatch(loadLayoutRole(homeId));
    return () => {
      request.abort();
      layoutRequest.abort();
      roleRequest.abort();
      dispatch(twinClosed());
      dispatch(currentHomeCleared());
    };
  }, [dispatch, homeId]);
  return <div className="app-shell">
    <main id="main-content"><DigitalTwinView homeId={homeId} /></main>
  </div>;
}
