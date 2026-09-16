import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import type { UserResponse } from '../../types/auth';
import { NotificationBell } from '../notification/NotificationBell';
import { ProfileModal } from '../profile/ProfileModal';
import { AdminIcon, AppSidebar, HomeIcon } from '../ui/AppSidebar';

interface AdminDashboardProps {
  user: UserResponse;
  onLogout: () => void;
  onProfileUpdate: (user: UserResponse) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout, onProfileUpdate }) => {
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
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
    <div className="app-shell relative overflow-x-hidden">
      <AppSidebar
        activeItem="admin"
        contextLabel="Quản trị nền tảng"
        items={[
          { id: 'home', label: 'Nhà của tôi', icon: <HomeIcon />, onClick: () => navigate('/home') },
          { id: 'admin', label: 'Tổng quan hệ thống', icon: <AdminIcon />, onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
        ]}
      />
      <div className="lg:pl-64">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-line bg-white/90 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning text-white shadow-soft">
            <svg aria-hidden={true} className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold tracking-tight text-text sm:text-lg">HESTA Admin Center</h1>
            <p className="hidden text-xs font-medium text-muted sm:block">Theo dõi sức khỏe nền tảng HESTA</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <span className={`hidden sm:inline-block px-2.5 py-1 text-xs font-semibold rounded-full border ${
            user.platformRole === 'ADMIN'
              ? 'border-warning bg-warning-soft text-text'
              : 'border-info bg-info-soft text-primary-hover'
          }`}>
            {user.platformRole}
          </span>
          
          <NotificationBell />

          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              aria-label="Mở menu tài khoản quản trị"
              aria-expanded={isDropdownOpen}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-line bg-warning shadow-soft transition-colors hover:bg-warning-soft focus:outline-none focus:ring-2 focus:ring-warning focus:ring-offset-2 focus:ring-offset-surface"
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={`Ảnh đại diện của ${user.fullName}`} width={40} height={40} className="h-full w-full object-cover" />
              ) : (
                <span className="text-white font-bold text-sm">
                  {user.fullName.charAt(0).toUpperCase()}
                </span>
              )}
            </button>

            {isDropdownOpen && (
              <div className="gentle-rise absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-line bg-white py-1 shadow-float">
                <div className="px-4 py-2 border-b border-slate-800">
                  <p className="truncate text-sm font-medium text-text">{user.fullName}</p>
                  <p className="text-xs text-slate-400 truncate">{user.email}</p>
                </div>
                
                <div className="p-1">
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setIsProfileModalOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <svg aria-hidden={true} className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Hồ sơ & Bảo mật
                  </button>
                  
                  <button
                    className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <svg aria-hidden={true} className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Cấu hình Hệ thống
                  </button>
                </div>
                
                <div className="border-t border-slate-800 p-1">
                  <button
                    onClick={onLogout}
                    className="w-full text-left px-3 py-2 text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <svg aria-hidden={true} className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Đăng xuất
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content Dashboard */}
      <main id="main-content" className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Welcome Banner */}
        <div className="surface-card relative overflow-hidden p-6 lg:p-8">
          <div className="absolute left-0 top-0 bottom-0 w-1/3 bg-amber-500/10 blur-2xl pointer-events-none" />
          <p className="mb-2 text-sm font-semibold text-primary-hover">Quản trị hệ thống</p>
          <h2 className="mb-2 text-2xl font-bold text-text sm:text-3xl">Xin chào, {user.fullName}</h2>
          <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
            Chào mừng bạn đến với trang quản trị cấp cao của HESTA Smart Home. 
            Tại đây bạn có thể quản lý toàn bộ hệ thống, người dùng và thiết bị.
          </p>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="surface-card group p-6 transition hover:-translate-y-0.5 hover:border-primary">
            <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg aria-hidden={true} className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">124</h3>
            <p className="text-xs text-slate-400">Tổng người dùng</p>
          </div>

          <div className="surface-card group p-6 transition hover:-translate-y-0.5 hover:border-primary">
            <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg aria-hidden={true} className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">892</h3>
            <p className="text-xs text-slate-400">Thiết bị đang hoạt động</p>
          </div>

          <div className="surface-card group p-6 transition hover:-translate-y-0.5 hover:border-warning">
            <div className="w-12 h-12 bg-rose-500/10 text-rose-400 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg aria-hidden={true} className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">3</h3>
            <p className="text-xs text-slate-400">Cảnh báo hệ thống</p>
          </div>
          
          <div className="surface-card group p-6 transition hover:-translate-y-0.5 hover:border-mint">
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg aria-hidden={true} className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">99.9%</h3>
            <p className="text-xs text-slate-400">Uptime Server</p>
          </div>
        </div>
      </main>
      </div>

      {/* Profile Modal */}
      {isProfileModalOpen ? (
        <ProfileModal
          isOpen
          onClose={() => setIsProfileModalOpen(false)}
          user={user}
          onProfileUpdate={onProfileUpdate}
        />
      ) : null}
    </div>
  );
};
