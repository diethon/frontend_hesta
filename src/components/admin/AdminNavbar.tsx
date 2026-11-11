import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Shield, ArrowLeft, Users, Layers, Activity } from 'lucide-react';
import { UserAvatar } from '../ui/UserAvatar';
import { NotificationBell } from '../notification/NotificationBell';

interface AdminNavbarProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  showBackButton?: boolean;
  user: {
    fullName: string;
    email: string;
    avatarUrl?: string;
  };
  onLogout: () => void;
  onOpenProfile: () => void;
}

export const AdminNavbar: React.FC<AdminNavbarProps> = ({
  title,
  subtitle,
  icon,
  showBackButton = false,
  user,
  onLogout,
  onOpenProfile,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur-xl sm:px-6">
      {/* Left: Optional Back + Icon + Title */}
      <div className="flex min-w-0 items-center gap-3">
        {showBackButton && (
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-muted hover:text-text hover:bg-sidebar transition-colors cursor-pointer"
            title="Quay lại trang quản trị thiết bị"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 shadow-soft">
          {icon || <Layers className="w-6 h-6" />}
        </div>

        <div className="min-w-0">
          <h1 className="truncate text-base font-bold tracking-tight text-text sm:text-lg">
            {title}
          </h1>
          {subtitle && (
            <p className="hidden text-xs font-medium text-muted sm:block truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right: Role Badge + Notification + Avatar Dropdown */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full border border-warning/40 bg-warning-soft text-text shadow-xs">
          <Shield className="w-3.5 h-3.5 text-warning" />
          Quản trị viên (ADMIN)
        </span>

        <NotificationBell />

        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            aria-label="Mở menu tài khoản quản trị"
            aria-expanded={isDropdownOpen}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-line bg-warning shadow-soft transition-colors hover:bg-warning-soft focus:outline-none focus:ring-2 focus:ring-warning cursor-pointer"
          >
            <UserAvatar
              src={user.avatarUrl}
              name={user.fullName}
              size={40}
              fallbackClassName="text-sm font-bold text-white"
            />
          </button>

          {isDropdownOpen && (
            <div className="gentle-rise absolute right-0 z-50 mt-2 w-60 rounded-2xl border border-line bg-surface py-1 shadow-float">
              <div className="px-4 py-2.5 border-b border-line">
                <p className="text-xs text-muted">Đăng nhập với tư cách</p>
                <p className="truncate text-sm font-bold text-text">{user.fullName}</p>
                <p className="text-xs text-muted truncate">{user.email}</p>
              </div>

              <div className="p-1 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onOpenProfile();
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-text hover:bg-surface-hover rounded-xl transition-colors flex items-center gap-2.5 cursor-pointer"
                >
                  <UserAvatar src={user.avatarUrl} name={user.fullName} size={20} />
                  <span>Hồ sơ &amp; Bảo mật</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    if (location.pathname !== '/admin') navigate('/admin');
                  }}
                  className={`w-full text-left px-3 py-2 text-sm rounded-xl transition-colors flex items-center gap-2.5 cursor-pointer ${
                    location.pathname === '/admin'
                      ? 'bg-amber-500/10 text-amber-600 font-semibold'
                      : 'text-text hover:bg-surface-hover'
                  }`}
                >
                  <Layers className="w-4 h-4 text-amber-500" />
                  <span>Quản lý Thiết bị &amp; QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    if (location.pathname !== '/admin/users') navigate('/admin/users');
                  }}
                  className={`w-full text-left px-3 py-2 text-sm rounded-xl transition-colors flex items-center gap-2.5 cursor-pointer ${
                    location.pathname === '/admin/users'
                      ? 'bg-amber-500/10 text-amber-600 font-semibold'
                      : 'text-text hover:bg-surface-hover'
                  }`}
                >
                  <Users className="w-4 h-4 text-primary" />
                  <span>Quản lý Người Dùng</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    if (location.pathname !== '/admin/diagnostics') navigate('/admin/diagnostics');
                  }}
                  className={`w-full text-left px-3 py-2 text-sm rounded-xl transition-colors flex items-center gap-2.5 cursor-pointer ${
                    location.pathname === '/admin/diagnostics'
                      ? 'bg-amber-500/10 text-amber-600 font-semibold'
                      : 'text-text hover:bg-surface-hover'
                  }`}
                >
                  <Activity className="w-4 h-4 text-emerald-500" />
                  <span>Chẩn đoán hạ tầng IoT</span>
                </button>
              </div>

              <div className="border-t border-line p-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onLogout();
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors flex items-center gap-2.5 cursor-pointer"
                >
                  <svg aria-hidden={true} className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
