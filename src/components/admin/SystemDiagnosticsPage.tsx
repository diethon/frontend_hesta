import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import type { UserResponse } from '../../types/auth';
import { NotificationBell } from '../notification/NotificationBell';
import { ProfileModal } from '../profile/ProfileModal';
import { AdminIcon, AppSidebar, HomeIcon } from '../ui/AppSidebar';
import { UserAvatar } from '../ui/UserAvatar';
import { NodeDiagnosticsWidget } from './NodeDiagnosticsWidget';
import { MqttSnifferConsole } from './MqttSnifferConsole';
import { DeadLetterQueueConsole } from './DeadLetterQueueConsole';
import { OtaCampaignManager } from './OtaCampaignManager';
import { Activity, Terminal, ArrowLeft, Cpu, ShieldAlert, UploadCloud } from 'lucide-react';

interface SystemDiagnosticsPageProps {
  user: UserResponse;
  onLogout: () => void;
  onProfileUpdate: (user: UserResponse) => void;
}

export const SystemDiagnosticsPage: React.FC<SystemDiagnosticsPageProps> = ({
  user,
  onLogout,
  onProfileUpdate,
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'NODES' | 'MQTT' | 'DLQ' | 'OTA'>('NODES');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
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
    <div className="app-shell relative overflow-x-hidden min-h-screen">
      <AppSidebar
        activeItem="diagnostics"
        contextLabel="Quản trị nền tảng"
        items={[
          { id: 'home', label: 'Nhà của tôi', icon: <HomeIcon />, onClick: () => navigate('/home') },
          { id: 'admin', label: 'Quản lý thiết bị & QR', icon: <AdminIcon />, onClick: () => navigate('/admin') },
          { id: 'diagnostics', label: 'Chẩn đoán hạ tầng IoT', icon: <Activity className="w-5 h-5 text-primary" />, onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
        ]}
      />

      <div className="lg:pl-64">
        {/* Top Navbar */}
        <nav className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-muted hover:text-text hover:bg-sidebar transition-colors"
              title="Quay lại trang quản trị"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-soft">
              <Cpu className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold tracking-tight text-text sm:text-lg">
                Chẩn Đoán Kỹ Thuật &amp; Hạ Tầng IoT
              </h1>
              <p className="hidden text-xs font-medium text-muted sm:block">
                Theo dõi độ trễ MQTT RTT, Circuit Breaker &amp; Live Packet Sniffer
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <span className="hidden sm:inline-block px-2.5 py-1 text-xs font-semibold rounded-full border border-primary/30 bg-primary/10 text-primary">
              ADMIN DIAGNOSTICS
            </span>

            <NotificationBell />

            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                aria-label="Mở menu tài khoản quản trị"
                aria-expanded={isDropdownOpen}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-line bg-warning shadow-soft transition-colors hover:bg-warning-soft focus:outline-none focus:ring-2 focus:ring-warning"
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
                      className="w-full text-left px-3 py-2 text-sm text-text hover:bg-sidebar-hover hover:text-primary-hover rounded-lg transition-colors flex items-center gap-2"
                    >
                      Hồ sơ &amp; Bảo mật
                    </button>
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        navigate('/admin');
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-text hover:bg-sidebar-hover hover:text-primary-hover rounded-lg transition-colors flex items-center gap-2"
                    >
                      Trang Quản trị Thiết bị
                    </button>
                  </div>

                  <div className="border-t border-line p-1">
                    <button
                      onClick={onLogout}
                      className="w-full text-left px-3 py-2 text-sm text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-2"
                    >
                      Đăng xuất
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main id="main-content" className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
          {/* Sub-Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-line pb-1">
            <button
              type="button"
              onClick={() => setActiveTab('NODES')}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition shadow-xs ${
                activeTab === 'NODES'
                  ? 'bg-primary text-white shadow-soft'
                  : 'bg-surface text-muted hover:text-text hover:bg-sidebar'
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
                  : 'bg-surface text-muted hover:text-text hover:bg-sidebar'
              }`}
            >
              <Terminal className="w-4 h-4" />
              <span>Live MQTT Packet Sniffer</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('DLQ')}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition shadow-xs ${
                activeTab === 'DLQ'
                  ? 'bg-primary text-white shadow-soft'
                  : 'bg-surface text-muted hover:text-text hover:bg-sidebar'
              }`}
            >
              <ShieldAlert className="w-4 h-4 text-red-500" />
              <span>Hộp Thư Rác DLQ &amp; Ingress</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('OTA')}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition shadow-xs ${
                activeTab === 'OTA'
                  ? 'bg-primary text-white shadow-soft'
                  : 'bg-surface text-muted hover:text-text hover:bg-sidebar'
              }`}
            >
              <UploadCloud className="w-4 h-4 text-indigo-400" />
              <span>Chiến Dịch OTA Firmware</span>
            </button>
          </div>

          {/* Active Tab Content */}
          {activeTab === 'NODES' && <NodeDiagnosticsWidget />}
          {activeTab === 'MQTT' && <MqttSnifferConsole />}
          {activeTab === 'DLQ' && <DeadLetterQueueConsole />}
          {activeTab === 'OTA' && <OtaCampaignManager />}
        </main>
      </div>

      {isProfileModalOpen && (
        <ProfileModal
          isOpen
          onClose={() => setIsProfileModalOpen(false)}
          user={user}
          onProfileUpdate={onProfileUpdate}
        />
      )}
    </div>
  );
};
