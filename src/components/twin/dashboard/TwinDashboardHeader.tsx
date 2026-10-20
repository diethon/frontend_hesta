import { lazy, Suspense, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ChevronDown, Menu, RefreshCw, Sun } from 'lucide-react';
import { NotificationBell } from '../../notification/NotificationBell';
import { BrandMark } from '../../ui/AppSidebar';
import { UserAvatar } from '../../ui/UserAvatar';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { selectCurrentUser } from '../../../store/selectors';
import { currentUserUpdated } from '../../../store/authSlice';
import { persistCurrentUser } from '../../../services/session';
import type { TwinRendererTheme } from '../scene/rendererTheme';

const ProfileModal = lazy(() => import('../../profile/ProfileModal').then((module) => ({ default: module.ProfileModal })));
const rendererThemes: { value: TwinRendererTheme; label: string }[] = [
  { value: 'DAYLIGHT', label: 'Daylight' }, { value: 'COZY', label: 'Cozy' },
  { value: 'BLUEPRINT', label: 'Blueprint' }, { value: 'NIGHT', label: 'Night' },
];

interface Props {
  homeId: string;
  connected: boolean;
  connectionLabel: string;
  loading: boolean;
  canReload: boolean;
  onReload: () => void;
  theme: TwinRendererTheme;
  onThemeChange: (theme: TwinRendererTheme) => void;
}

/** The Twin page's single application header. Renderer themes never change the app theme. */
export function TwinDashboardHeader({ homeId, connected, connectionLabel, loading, canReload, onReload, theme, onThemeChange }: Props) {
  const user = useAppSelector(selectCurrentUser);
  const dispatch = useAppDispatch();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileButton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const themeId = useId();
  const encodedHome = encodeURIComponent(homeId);
  const links = [
    { label: 'Tổng quan', href: `/home?homeId=${encodedHome}` },
    { label: 'Thiết bị', href: `/home/${encodedHome}/devices` },
    { label: 'Kịch bản', href: `/homes/${encodedHome}/scenes` },
    { label: 'Tự động hóa', href: `/homes/${encodedHome}/automation-rules` },
    { label: 'Năng lượng', href: `/home/${encodedHome}/energy` },
  ];
  const closeProfile = () => {
    setProfileOpen(false);
    profileButton.current?.focus();
  };

  return <>
    <header className="relative z-40 border-b border-line bg-surface px-4 py-3 shadow-soft sm:px-6">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <Link to="/home" aria-label="HESTA — Chọn ngôi nhà" className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-primary">
          <BrandMark compact />
          <div className="min-w-0"><p className="truncate text-base font-bold tracking-tight text-text">HESTA</p><h1 className="truncate text-xs font-medium text-muted sm:text-sm">Digital Twin Dashboard</h1></div>
        </Link>
        <nav aria-label="Điều hướng HESTA" className="hidden min-w-0 items-center gap-1 xl:flex">
          {links.map(({ label, href }) => <Link key={href} to={href} className="rounded-xl px-3 py-3 text-xs font-medium text-muted transition-colors hover:bg-app hover:text-text focus-visible:outline-2 focus-visible:outline-primary">{label}</Link>)}
          <span aria-current="page" className="rounded-xl bg-info-soft px-3 py-3 text-xs font-semibold text-primary-hover">Digital Twin</span>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <NotificationBell />
          {user ? <button ref={profileButton} type="button" aria-label={`Mở hồ sơ ${user.fullName}`} aria-haspopup="dialog" onClick={() => setProfileOpen(true)} className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-info-soft text-primary-hover transition-colors hover:bg-sidebar-hover focus-visible:outline-2 focus-visible:outline-primary"><UserAvatar src={user.avatarUrl} name={user.fullName} size={44} fallbackClassName="text-sm font-bold" /></button> : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <details ref={menu} className="relative xl:hidden" onKeyDown={(event) => {
            if (event.key === 'Escape' && menu.current?.open) {
              menu.current.open = false;
              menu.current.querySelector('summary')?.focus();
            }
          }}>
            <summary aria-label="Điều hướng ứng dụng" className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-line px-3 text-xs font-semibold text-text focus-visible:outline-2 focus-visible:outline-primary"><Menu size={16} aria-hidden="true" /><span className="hidden sm:inline">Điều hướng</span><ChevronDown size={12} aria-hidden="true" /></summary>
            <nav aria-label="Điều hướng HESTA trên màn hình nhỏ" className="absolute left-0 top-full z-50 mt-2 w-56 rounded-2xl border border-line bg-surface p-2 shadow-float">{links.map(({ label, href }) => <Link key={href} to={href} onClick={() => { if (menu.current) menu.current.open = false; }} className="block rounded-xl px-3 py-3 text-sm text-text hover:bg-app focus-visible:outline-2 focus-visible:outline-primary">{label}</Link>)}<Link to="/home" className="block rounded-xl border-t border-line px-3 py-3 text-sm text-muted">Chọn ngôi nhà khác</Link></nav>
          </details>
          <p role="status" className="flex min-w-0 items-center gap-2 text-xs text-muted"><span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${connected ? 'bg-success' : 'bg-warning'}`} /><span className="min-w-0 break-words"><span className="font-semibold text-text">Realtime</span> · {connectionLabel}</span></p>
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-2">
          <label htmlFor={themeId} className="sr-only">Ánh sáng mô hình 3D</label>
          <div className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface pl-3"><Sun size={16} className="text-icon" aria-hidden="true" /><select id={themeId} aria-label="Ánh sáng mô hình 3D" value={theme} onChange={(event) => {
            const selected = rendererThemes.find((item) => item.value === event.target.value);
            if (selected) onThemeChange(selected.value);
          }} className="min-h-11 rounded-xl bg-surface pr-3 text-xs font-semibold text-text focus-visible:outline-2 focus-visible:outline-primary">{rendererThemes.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></div>
          <button type="button" disabled={loading || !canReload} onClick={onReload} aria-label="Đồng bộ lại Digital Twin" className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-text transition-colors hover:bg-app focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw size={15} aria-hidden="true" /><span>{loading ? 'Đang đồng bộ…' : 'Đồng bộ lại'}</span></button>
        </div>
      </div>
    </header>
    {profileOpen && user ? <Suspense fallback={<div role="status" className="fixed inset-x-4 top-4 z-50 mx-auto max-w-sm rounded-2xl border border-line bg-surface p-4 text-center text-sm text-muted shadow-float">Đang tải hồ sơ…<button type="button" onClick={closeProfile} className="ml-3 rounded-lg px-3 py-2 font-semibold text-primary-hover">Hủy</button></div>}><ProfileModal isOpen user={user} onClose={closeProfile} onProfileUpdate={(updatedUser) => {
      persistCurrentUser(updatedUser);
      dispatch(currentUserUpdated(updatedUser));
    }} /></Suspense> : null}
  </>;
}
