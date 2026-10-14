import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import type { UserResponse } from '../../types/auth';
import { NotificationBell } from '../notification/NotificationBell';
import { ProfileModal } from '../profile/ProfileModal';
import { AdminIcon, AppSidebar, HomeIcon } from '../ui/AppSidebar';
import { UserAvatar } from '../ui/UserAvatar';
import { NodeDiagnosticsWidget } from './NodeDiagnosticsWidget';
import { MqttSnifferConsole } from './MqttSnifferConsole';
import { Activity, Terminal } from 'lucide-react';

interface AdminDashboardProps {
  user: UserResponse;
  onLogout: () => void;
  onProfileUpdate: (user: UserResponse) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout, onProfileUpdate }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'NODES' | 'MQTT'>('NODES');
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
              <UserAvatar
                src={user.avatarUrl}
                name={user.fullName}
                size={40}
                fallbackClassName="text-sm font-bold text-white"
              />
            </button>

            {isDropdownOpen && (
              <div className="gentle-rise absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-line bg-surface py-1 shadow-float">
                <div className="px-4 py-2 border-b border-line">
                  <p className="truncate text-sm font-medium text-text">{user.fullName}</p>
                  <p className="text-xs text-muted truncate">{user.email}</p>
                </div>
                
                <div className="p-1">
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setIsProfileModalOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-text hover:bg-sidebar-hover hover:text-primary-hover rounded-xl transition-colors flex items-center gap-2"
                  >
                    <svg aria-hidden={true} className="w-4 h-4 text-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Hồ sơ & Bảo mật
                  </button>
                  
                  <button
                    className="w-full text-left px-3 py-2 text-sm text-text hover:bg-sidebar-hover hover:text-primary-hover rounded-xl transition-colors flex items-center gap-2"
                  >
                    <svg aria-hidden={true} className="w-4 h-4 text-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Cấu hình Hệ thống
                  </button>
                </div>
                
                <div className="border-t border-line p-1">
                  <button
                    onClick={onLogout}
                    className="w-full text-left px-3 py-2 text-sm text-error hover:bg-error-soft rounded-xl transition-colors flex items-center gap-2"
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
          <p className="text-sm text-muted max-w-2xl leading-relaxed">
            Chào mừng bạn đến với trang quản trị cấp cao của HESTA Smart Home. 
            Tại đây bạn có thể quản lý toàn bộ hệ thống, người dùng và thiết bị.
          </p>
        </div>

        {/* ── Admin Sub-Navigation Tabs ── */}
        <div className="flex items-center gap-2 border-b border-line pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('NODES')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition shadow-xs ${
              activeTab === 'NODES'
                ? 'bg-primary text-white shadow-soft'
                : 'bg-surface text-muted hover:text-text hover:bg-off-soft'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Giám Sát Node &amp; Mạch Bảo Vệ</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('MQTT')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition shadow-xs ${
              activeTab === 'MQTT'
                ? 'bg-primary text-white shadow-soft'
                : 'bg-surface text-muted hover:text-text hover:bg-off-soft'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Live MQTT Packet Sniffer</span>
          </button>
        </div>

        {/* ── Active Tab View ── */}
        {activeTab === 'NODES' ? <NodeDiagnosticsWidget /> : <MqttSnifferConsole />}
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
