import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { currentHomeChanged, currentHomeCleared } from '../../store/homeSlice';
import { loadTwinSnapshot, twinClosed, twinOpened } from '../../store/twinSlice';
import { TwinDashboardHeader } from './dashboard/TwinDashboardHeader';
import { DashboardNavRail } from '../home/DashboardNavRail';
import { DashboardBottomNav } from '../home/DashboardBottomNav';
import type { TwinRendererTheme } from './scene/rendererTheme';
import { TwinLayoutEditor } from './TwinLayoutEditor';
import { loadLayoutRole, loadTwinLayout } from '../../store/twinLayoutSlice';
import { useLayoutNavigationGuard } from './useLayoutNavigationGuard';
import type { TwinViewMode } from './TwinViewSwitcher';

const connectionLabels = {
  connected: 'Đã kết nối', connecting: 'Đang kết nối…', reconnecting: 'Đang kết nối lại…',
  disconnected: 'Đã ngắt kết nối', error: 'Kết nối bị gián đoạn',
};

export function DigitalTwinView({ homeId, initialMode, navigationOpen, onToggleNavigation }: { homeId: string; initialMode?: TwinViewMode; navigationOpen?: boolean; onToggleNavigation?: () => void }) {
  const dispatch = useAppDispatch();
  const [theme, setTheme] = useState<TwinRendererTheme>('DAYLIGHT');
  const matchesHome = useAppSelector((state) => state.twin.homeId === homeId);
  const loading = useAppSelector((state) => state.twin.loading);
  const initialized = useAppSelector((state) => state.twin.initialized);
  const error = useAppSelector((state) => state.twin.error);
  const editingLayout = useAppSelector((state) => state.twinLayout.homeId === homeId && !!state.twinLayout.draft);
  const status = useAppSelector((state) => state.realtime.status);
  const subscribedHome = useAppSelector((state) => state.realtime.activeHomeId);
  const connected = status === 'connected' && subscribedHome === homeId;
  const connectionLabel = status === 'connected' && !connected ? 'Đang đăng ký nhà…' : connectionLabels[status];
  const reload = () => {
    void dispatch(loadTwinSnapshot(homeId));
    if (!editingLayout) void dispatch(loadTwinLayout(homeId));
  };
  return <div className="twin-premium-dashboard twin-v2-dashboard min-w-0 bg-app text-text">
    <TwinDashboardHeader homeId={homeId} connected={connected} connectionLabel={connectionLabel} loading={loading} canReload={matchesHome} onReload={reload} theme={theme} onThemeChange={setTheme} navigationOpen={navigationOpen} onToggleNavigation={onToggleNavigation} />
    <div className="v2-workspace">
    {!connected && matchesHome && initialized ? <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-text">Đang hiển thị dữ liệu gần nhất. Sau khi kết nối lại, chọn “Đồng bộ lại” để nhận những thay đổi đã bỏ lỡ.</p> : null}
    {matchesHome && error ? <div role="alert" className="rounded-2xl border border-error bg-error-soft p-5 text-text">
      <p>{error}</p><button type="button" disabled={loading} onClick={() => void dispatch(loadTwinSnapshot(homeId))} className="mt-3 rounded-xl bg-surface px-4 py-3 text-sm font-semibold disabled:opacity-50">Thử lại</button>
    </div> : null}
    {!matchesHome || (!initialized && !error) ? <div role="status" aria-label="Đang tải Digital Twin" className="surface-card p-6">
      <p className="text-sm text-muted">Đang tải Digital Twin (Mô hình 3D)…</p><div className="mt-4 h-32 animate-pulse rounded-2xl bg-off-soft" />
    </div> : initialized ? <>
      <TwinLayoutEditor key={homeId} homeId={homeId} initialMode={initialMode} rendererTheme={theme} onRendererThemeChange={setTheme} />
    </> : null}
    </div>
  </div>;
}

export function DigitalTwinPage() {
  useLayoutNavigationGuard();
  const { homeId = '' } = useParams<{ homeId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.auth.user);

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

  return (
    <div className="app-shell digital-twin-shell">
      {/* 3 Pastel glowing meshes matching Figma design */}
      <div className="mesh mesh-one" />
      <div className="mesh mesh-two" />
      <div className="mesh mesh-three" />

      {/* Modern Unified NavRail sidebar */}
      <DashboardNavRail
        homeId={homeId}
        activeItem="twin"
        user={currentUser || undefined}
        onSelectOverview={() => navigate('/home')}
      />

      <main id="main-content">
        <DigitalTwinView homeId={homeId} />
      </main>

      {/* Mobile Bottom Navigation */}
      <DashboardBottomNav
        homeId={homeId}
        activeItem="overview"
        onSelectOverview={() => navigate('/home')}
      />
    </div>
  );
}
