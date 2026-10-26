import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import type { UserResponse } from '../../types/auth';
import { ProfileModal } from '../profile/ProfileModal';
import { AdminIcon, AppSidebar, PeopleIcon } from '../ui/AppSidebar';
import { NodeDiagnosticsWidget } from './NodeDiagnosticsWidget';
import { MqttSnifferConsole } from './MqttSnifferConsole';
import { DeadLetterQueueConsole } from './DeadLetterQueueConsole';
import { OtaCampaignManager } from './OtaCampaignManager';
import { AdminNavbar } from './AdminNavbar';
import { Activity, Terminal, Cpu, ShieldAlert, UploadCloud } from 'lucide-react';

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

  return (
    <div className="app-shell relative overflow-x-hidden min-h-screen">
      <AppSidebar
        activeItem="diagnostics"
        contextLabel="Quản trị nền tảng"
        items={[
          { id: 'admin', label: 'Quản lý thiết bị & QR', icon: <AdminIcon />, onClick: () => navigate('/admin') },
          { id: 'users', label: 'Quản lý người dùng', icon: <PeopleIcon />, onClick: () => navigate('/admin/users') },
          { id: 'diagnostics', label: 'Chẩn đoán hạ tầng IoT', icon: <Activity className="w-5 h-5 text-primary" />, onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
        ]}
      />

      <div className="lg:pl-64">
        {/* Reusable Top Navbar */}
        <AdminNavbar
          title="Chẩn Đoán Kỹ Thuật & Hạ Tầng IoT"
          subtitle="Theo dõi độ trễ MQTT RTT, Circuit Breaker & Live Packet Sniffer"
          icon={<Cpu className="w-6 h-6 text-primary" />}
          showBackButton={true}
          user={user}
          onLogout={onLogout}
          onOpenProfile={() => setIsProfileModalOpen(true)}
        />

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
              <span>Cứu Tín Hiệu Thiết Bị (DLQ)</span>
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
              <span>Cập Nhật Phần Mềm Từ Xa (OTA)</span>
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
