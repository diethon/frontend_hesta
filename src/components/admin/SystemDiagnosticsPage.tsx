import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import type { UserResponse } from '../../types/auth';
import { ProfileModal } from '../profile/ProfileModal';
import { DashboardNavRail } from '../home/DashboardNavRail';
import { DashboardBottomNav } from '../home/DashboardBottomNav';
import { NotificationBell } from '../notification/NotificationBell';
import { AdminAvatarMenu } from './AdminAvatarMenu';
import { NodeDiagnosticsWidget } from './NodeDiagnosticsWidget';
import { MqttSnifferConsole } from './MqttSnifferConsole';
import { DeadLetterQueueConsole } from './DeadLetterQueueConsole';
import { OtaCampaignManager } from './OtaCampaignManager';
import { Activity, Terminal, ShieldAlert, UploadCloud } from 'lucide-react';

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
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const adminNavRailItems = [
    {
      id: 'admin',
      icon: 'grid' as const,
      label: 'Quản lý thiết bị & QR',
      onClick: () => navigate('/admin'),
      active: false,
    },
    {
      id: 'users',
      icon: 'users' as const,
      label: 'Quản lý người dùng',
      onClick: () => navigate('/admin/users'),
      active: false,
    },
    {
      id: 'diagnostics',
      icon: 'activity' as const,
      label: 'Chẩn đoán hạ tầng IoT',
      onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
      active: true,
    },
  ];

  const adminBottomNavItems = [
    {
      id: 'admin',
      icon: 'grid' as const,
      label: 'Thiết bị & QR',
      onClick: () => navigate('/admin'),
      active: false,
    },
    {
      id: 'users',
      icon: 'users' as const,
      label: 'Người dùng',
      onClick: () => navigate('/admin/users'),
      active: false,
    },
    {
      id: 'diagnostics',
      icon: 'activity' as const,
      label: 'Hạ tầng',
      onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
      active: true,
    },
  ];

  return (
    <div className="app-shell admin-diagnostics-page min-h-screen bg-app text-text relative">
      {/* Unified HESTA ambient background meshes */}
      <div className="mesh mesh-one pointer-events-none" />
      <div className="mesh mesh-two pointer-events-none" />
      <div className="mesh mesh-three pointer-events-none" />

      {/* Shared NavRail with 3 admin destinations */}
      <DashboardNavRail
        activeItem="diagnostics"
        items={adminNavRailItems}
        user={user}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        hideSettings
        brandTitle="HESTA Admin Center"
      />

      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 pb-24 lg:pb-12">
        <span className="sr-only">HESTA Admin Center</span>

        {/* TopBar */}
        <header className="flex items-center justify-between gap-4 py-2 border-b border-line/60">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text truncate">
              Chẩn đoán hạ tầng IoT
            </h1>
            <p className="text-xs text-muted mt-0.5 truncate">
              Độ trễ MQTT, mạch ngắt Circuit Breaker, hàng đợi DLQ &amp; cập nhật OTA
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-line bg-surface/80 text-muted">
              Quản trị viên
            </span>

            <NotificationBell />

            <AdminAvatarMenu
              user={user}
              onOpenProfile={() => setIsProfileModalOpen(true)}
              onLogout={onLogout}
            />
          </div>
        </header>

        {/* Neutral single-line explanation */}
        <p className="text-xs text-muted leading-relaxed">
          Theo dõi tình trạng kết nối broker MQTT, mạch bảo vệ phần cứng, bắt gói tin trực tiếp và quản lý cập nhật firmware OTA.
        </p>

        {/* Sub-Navigation Tabs */}
        <div className="p-1.5 rounded-2xl border border-line bg-surface/90 flex flex-wrap items-center gap-1.5 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('NODES')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'NODES'
                ? 'bg-primary text-white shadow-xs'
                : 'text-muted hover:text-text hover:bg-surface-hover'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Giám sát node &amp; mạch bảo vệ</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('MQTT')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'MQTT'
                ? 'bg-primary text-white shadow-xs'
                : 'text-muted hover:text-text hover:bg-surface-hover'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Live MQTT packet sniffer</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('DLQ')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'DLQ'
                ? 'bg-primary text-white shadow-xs'
                : 'text-muted hover:text-text hover:bg-surface-hover'
            }`}
          >
            <ShieldAlert className={`w-4 h-4 ${activeTab === 'DLQ' ? 'text-white' : 'text-rose-500'}`} />
            <span>Hàng đợi chết (DLQ)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('OTA')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'OTA'
                ? 'bg-primary text-white shadow-xs'
                : 'text-muted hover:text-text hover:bg-surface-hover'
            }`}
          >
            <UploadCloud className={`w-4 h-4 ${activeTab === 'OTA' ? 'text-white' : 'text-primary'}`} />
            <span>Cập nhật firmware từ xa (OTA)</span>
          </button>
        </div>

        {/* Active Tab Content */}
        {activeTab === 'NODES' && <NodeDiagnosticsWidget />}
        {activeTab === 'MQTT' && <MqttSnifferConsole />}
        {activeTab === 'DLQ' && <DeadLetterQueueConsole />}
        {activeTab === 'OTA' && <OtaCampaignManager />}
      </main>

      {/* Mobile Bottom Navigation */}
      <DashboardBottomNav activeItem="diagnostics" items={adminBottomNavItems} />

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
