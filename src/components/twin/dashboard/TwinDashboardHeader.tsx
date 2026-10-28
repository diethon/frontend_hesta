import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ChevronDown, ChevronRight, House, Menu, PanelLeftClose, PanelLeftOpen, RefreshCw } from 'lucide-react';
import { NotificationBell } from '../../notification/NotificationBell';
import { UserAvatar } from '../../ui/UserAvatar';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { selectCurrentUser } from '../../../store/selectors';
import { currentUserUpdated } from '../../../store/authSlice';
import { persistCurrentUser } from '../../../services/session';
import type { TwinRendererTheme } from '../scene/rendererTheme';
import { deviceHealthCounts } from './twinDashboardData';

const ProfileModal = lazy(() => import('../../profile/ProfileModal').then((module) => ({ default: module.ProfileModal })));
interface Props {
  homeId: string;
  connected: boolean;
  connectionLabel: string;
  loading: boolean;
  canReload: boolean;
  onReload: () => void;
  theme: TwinRendererTheme;
  onThemeChange: (theme: TwinRendererTheme) => void;
  navigationOpen?: boolean;
  onToggleNavigation?: () => void;
}

/** The Twin page's single application header. Renderer themes never change the app theme. */
export function TwinDashboardHeader({ homeId, connected, connectionLabel, loading, canReload, onReload, navigationOpen, onToggleNavigation }: Props) {
  const user = useAppSelector(selectCurrentUser);
  const homeName = useAppSelector((state) => state.twin.homeId === homeId ? state.twin.home?.name : undefined);
  const devices = useAppSelector((state) => state.twin.homeId === homeId ? state.twin.devicesById : null);
  const health = useMemo(() => deviceHealthCounts(devices ? Object.values(devices) : []), [devices]);
  const dispatch = useAppDispatch();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileButton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const roomCount = useAppSelector((state) => state.twin.homeId === homeId ? state.twin.roomIds.length : 0);
  const sensorCount = useAppSelector((state) => state.twin.homeId === homeId ? state.twin.sensorIds.length : 0);
  const encodedHome = encodeURIComponent(homeId);
  const links = [
    { label: 'Tổng quan', href: `/home?homeId=${encodedHome}` },
    { label: 'Thiết bị', href: `/home/${encodedHome}/devices` },
    { label: 'Kịch bản', href: `/homes/${encodedHome}/scenes` },
    { label: 'Tự động hóa', href: `/homes/${encodedHome}/automation-rules` },
    { label: 'Năng lượng', href: `/home/${encodedHome}/energy` },
    { label: 'Thành viên', href: `/home?homeId=${encodedHome}#members-section` },
    ...(user?.platformRole === 'ADMIN' ? [{ label: 'Quản trị hệ thống', href: '/admin' }] : []),
  ];
  const closeProfile = () => {
    setProfileOpen(false);
    profileButton.current?.focus();
  };

  return <>
    <header className="v2-topbar">
      <Link to={`/home?homeId=${encodedHome}`} className="v2-brand" aria-label="HESTA · Về trang chính"><span className="v2-brand-mark"><House size={25} strokeWidth={2} aria-hidden="true" /></span><span>HESTA<span className="v2-brand-period">.</span></span></Link>
      <span className="v2-topbar-divider" aria-hidden="true" />
      <div className="v2-breadcrumb"><span>Không gian sống</span><ChevronRight size={13} aria-hidden="true" /><strong>Digital Twin</strong><span className="v2-version-tag">V2</span></div>
      <span className="v2-data-badge"><span />DỮ LIỆU HESTA</span>
      <div className="v2-topbar-right">
        <p role="status" className="v2-connection"><span className={`v2-status-dot ${connected ? 'bg-success' : 'bg-warning'}`} /><span>{connectionLabel}</span></p>
        <button type="button" disabled={loading || !canReload} onClick={onReload} aria-label="Đồng bộ lại Digital Twin" className="v2-icon-button" title={loading ? 'Đang đồng bộ…' : 'Đồng bộ lại'}><RefreshCw size={17} aria-hidden="true" /></button>
        {onToggleNavigation ? <button type="button" aria-label={navigationOpen ? 'Thu gọn điều hướng HESTA' : 'Mở rộng điều hướng HESTA'} title={navigationOpen ? 'Thu gọn điều hướng HESTA' : 'Mở rộng điều hướng HESTA'} aria-expanded={!!navigationOpen} onClick={onToggleNavigation} className="v2-icon-button v2-navigation-toggle">{navigationOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}</button> : null}
        <details ref={menu} className="v2-navigation-menu" onKeyDown={(event) => { if (event.key === 'Escape' && menu.current?.open) { menu.current.open = false; menu.current.querySelector('summary')?.focus(); } }}>
          <summary aria-label="Điều hướng ứng dụng" className="v2-icon-button"><Menu size={18} aria-hidden="true" /><ChevronDown size={10} aria-hidden="true" /></summary>
          <nav aria-label="Điều hướng HESTA" className="v2-navigation-links">{links.map(({ label, href }) => <Link key={href} to={href} onClick={() => { if (menu.current) menu.current.open = false; }}>{label}</Link>)}<Link to="/home">Chọn ngôi nhà khác</Link></nav>
        </details>
        <NotificationBell />
        {user ? <button ref={profileButton} type="button" aria-label={`Mở hồ sơ ${user.fullName}`} aria-haspopup="dialog" onClick={() => setProfileOpen(true)} className="v2-profile"><UserAvatar src={user.avatarUrl} name={user.fullName} size={34} fallbackClassName="text-xs font-semibold" /><span><strong>{user.fullName}</strong><small>Không gian cá nhân</small></span></button> : null}
      </div>
    </header>
    <div className="v2-workspace-heading">
      <div className="v2-heading-copy"><p className="v2-eyebrow"><span className="v2-status-dot" />YOUR HOME, CONNECTED</p><h1>{homeName ?? 'Ngôi nhà của bạn'}<span>.</span></h1><p>Một góc nhìn trực quan cho không gian sống thông minh.</p></div>
      <dl className="v2-house-overview"><div><dt>Không gian</dt><dd>{roomCount}<small>phòng</small></dd></div><div><dt>Thiết bị kết nối</dt><dd>{health.online}<small>/ {health.total} trực tuyến</small><span className="v2-status-dot" /></dd></div><div><dt>Cảm biến</dt><dd>{sensorCount}<small>đã đăng ký</small></dd></div></dl>
    </div>
    {profileOpen && user ? <Suspense fallback={<div role="status" className="fixed inset-x-4 top-4 z-50 mx-auto max-w-sm rounded-2xl border border-line bg-surface p-4 text-center text-sm text-muted shadow-float">Đang tải hồ sơ…<button type="button" onClick={closeProfile} className="ml-3 rounded-lg px-3 py-2 font-semibold text-primary-hover">Hủy</button></div>}><ProfileModal isOpen user={user} onClose={closeProfile} onProfileUpdate={(updatedUser) => {
      persistCurrentUser(updatedUser);
      dispatch(currentUserUpdated(updatedUser));
    }} /></Suspense> : null}
  </>;
}
