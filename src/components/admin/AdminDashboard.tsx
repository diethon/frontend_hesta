import React, { useState, useRef, useEffect } from 'react';
import type { UserResponse } from '../../types/auth';
import { ProfileModal } from '../profile/ProfileModal';

interface AdminDashboardProps {
  user: UserResponse;
  onLogout: () => void;
  onProfileUpdate: (user: UserResponse) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout, onProfileUpdate }) => {
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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans relative overflow-x-hidden">
      {/* Top Navbar */}
      <nav className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">HESTA Admin Center</h1>
            <p className="text-xs text-amber-400 font-medium">Bảng điều khiển Quản trị viên [/admin]</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className={`hidden sm:inline-block px-2.5 py-1 text-xs font-semibold rounded-full border ${
            user.platformRole === 'ADMIN'
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
          }`}>
            {user.platformRole}
          </span>
          
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 shadow-md hover:shadow-amber-500/40 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-slate-900 border-2 border-slate-800 overflow-hidden"
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold text-sm">
                  {user.fullName.charAt(0).toUpperCase()}
                </span>
              )}
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="px-4 py-2 border-b border-slate-800">
                  <p className="text-sm font-medium text-white truncate">{user.fullName}</p>
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
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Hồ sơ & Bảo mật
                  </button>
                  
                  <button
                    className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-slate-900 border border-amber-900/50 rounded-3xl p-8 shadow-xl relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1/3 bg-amber-500/10 blur-2xl pointer-events-none" />
          <h2 className="text-2xl font-bold text-white mb-2">Xin chào Admin, {user.fullName}! 👑</h2>
          <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
            Chào mừng bạn đến với trang quản trị cấp cao của HESTA Smart Home. 
            Tại đây bạn có thể quản lý toàn bộ hệ thống, người dùng và thiết bị.
          </p>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 hover:border-amber-500/40 transition-all shadow-lg group">
            <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">124</h3>
            <p className="text-xs text-slate-400">Tổng người dùng</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 hover:border-blue-500/40 transition-all shadow-lg group">
            <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">892</h3>
            <p className="text-xs text-slate-400">Thiết bị đang hoạt động</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 hover:border-rose-500/40 transition-all shadow-lg group">
            <div className="w-12 h-12 bg-rose-500/10 text-rose-400 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">3</h3>
            <p className="text-xs text-slate-400">Cảnh báo hệ thống</p>
          </div>
          
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 hover:border-emerald-500/40 transition-all shadow-lg group">
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">99.9%</h3>
            <p className="text-xs text-slate-400">Uptime Server</p>
          </div>
        </div>
      </main>

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
