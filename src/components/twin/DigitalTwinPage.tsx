import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { currentHomeChanged, currentHomeCleared } from '../../store/homeSlice';
import { loadTwinSnapshot, twinClosed, twinOpened } from '../../store/twinSlice';
import { AppSidebar, DeviceIcon, HomeIcon, TwinIcon } from '../ui/AppSidebar';
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
  const matchesHome = useAppSelector((state) => state.twin.homeId === homeId);
  const home = useAppSelector((state) => state.twin.home);
  const loading = useAppSelector((state) => state.twin.loading);
  const initialized = useAppSelector((state) => state.twin.initialized);
  const error = useAppSelector((state) => state.twin.error);
  const status = useAppSelector((state) => state.realtime.status);
  const subscribedHome = useAppSelector((state) => state.realtime.activeHomeId);
  const connected = status === 'connected' && subscribedHome === homeId;
  const connectionLabel = status === 'connected' && !connected ? 'Đang đăng ký nhà…' : connectionLabels[status];
  return <div className="mx-auto max-w-screen-2xl space-y-4 p-4 sm:p-6">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
      <nav aria-label="Điều hướng Digital Twin" className="flex flex-wrap items-center gap-3 text-sm font-medium text-text">
        <Link className="rounded-lg py-3 hover:text-primary-hover" to="/home">← Chọn nhà</Link><span aria-hidden="true" className="text-icon">/</span>
        <p className="text-xs text-muted">Không gian sống{matchesHome && home ? ` · ${home.name}` : ''}</p>
        <Link className="rounded-lg p-3 hover:bg-sidebar-hover" to={`/home/${encodeURIComponent(homeId)}/devices`}>Thiết bị</Link>
      </nav>
      <div className="flex flex-wrap items-center gap-3">
        <p role="status" className={`rounded-full border px-3 py-2 text-xs font-semibold text-text ${connected ? 'border-success bg-success-soft' : 'border-warning bg-warning-soft'}`}>Realtime: {connectionLabel}</p>
        <button type="button" disabled={loading || !matchesHome} onClick={() => void dispatch(loadTwinSnapshot(homeId))}
          className="rounded-xl border border-line bg-surface px-3 py-3 text-xs font-semibold text-text hover:bg-sidebar-hover disabled:opacity-50">{loading && initialized ? 'Đang đồng bộ…' : 'Đồng bộ lại'}</button>
      </div>
    </header>
    {!connected && matchesHome && initialized ? <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-text">Đang hiển thị dữ liệu gần nhất. Sau khi kết nối lại, chọn “Đồng bộ lại” để nhận những thay đổi đã bỏ lỡ.</p> : null}
    {matchesHome && error ? <div role="alert" className="rounded-2xl border border-error bg-error-soft p-5 text-text">
      <p>{error}</p><button type="button" disabled={loading} onClick={() => void dispatch(loadTwinSnapshot(homeId))} className="mt-3 rounded-xl bg-surface px-4 py-3 text-sm font-semibold disabled:opacity-50">Thử lại</button>
    </div> : null}
    {!matchesHome || (!initialized && !error) ? <div role="status" aria-label="Đang tải Digital Twin" className="surface-card p-6">
      <p className="text-sm text-muted">Đang tải Digital Twin…</p><div className="mt-4 h-32 animate-pulse rounded-2xl bg-off-soft" />
    </div> : initialized ? <>
      <TwinLayoutEditor key={homeId} homeId={homeId} initialMode={initialMode} />
    </> : null}
  </div>;
}

export function DigitalTwinPage() {
  useLayoutNavigationGuard();
  const { homeId = '' } = useParams<{ homeId: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
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
    <AppSidebar activeItem="twin" contextLabel="Không gian sống" showSystemSummary={false} items={[
      { id: 'home', label: 'Tổng quan', icon: <HomeIcon />, onClick: () => navigate('/home') },
      { id: 'devices', label: 'Thiết bị', icon: <DeviceIcon />, onClick: () => navigate(`/home/${encodeURIComponent(homeId)}/devices`) },
      { id: 'twin', label: 'Digital Twin', icon: <TwinIcon />, onClick: () => window.scrollTo({ top: 0 }) },
    ]} />
    <main id="main-content" className="lg:pl-64"><DigitalTwinView homeId={homeId} /></main>
  </div>;
}
