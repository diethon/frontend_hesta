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
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--text)] relative overflow-x-hidden">
      {/* Ambient Pastel Meshes for Unified HESTA Glassmorphism */}
      <div className="mesh mesh-one pointer-events-none" />
      <div className="mesh mesh-two pointer-events-none" />
      <div className="mesh mesh-three pointer-events-none" />

      <AppSidebar
        activeItem="diagnostics"
        contextLabel="Quản trị nền tảng"
        showSystemSummary={false}
        items={[
          { id: 'admin', label: 'Quản lý thiết bị & QR', icon: <AdminIcon />, onClick: () => navigate('/admin') },
          { id: 'users', label: 'Quản lý người dùng', icon: <PeopleIcon />, onClick: () => navigate('/admin/users') },
          { id: 'diagnostics', label: 'Chẩn đoán hạ tầng IoT', icon: <Activity className="w-5 h-5 text-primary" />, onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
        ]}
      />

      <div className="lg:pl-64 relative z-10">
        {/* Reusable Top Navbar */}
        <AdminNavbar
          title="Chẩn Đoán Kỹ Thuật & Hạ Tầng IoT"
          subtitle="Theo dõi độ trễ MQTT RTT, Circuit Breaker, DLQ & Cập nhật OTA"
          icon={<Cpu className="w-6 h-6 text-primary" />}
          showBackButton={true}
          user={user}
          onLogout={onLogout}
          onOpenProfile={() => setIsProfileModalOpen(true)}
        />

        {/* Main Content */}
        <main id="main-content" className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
          {/* Sub-Navigation Tabs */}
          <div className="glass-card glass-g2 p-1.5 rounded-2xl border border-[var(--border)] flex flex-wrap items-center gap-1.5 shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab('NODES')}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer ${
                activeTab === 'NODES'
                  ? 'bg-[var(--accent)] text-white shadow-xs'
                  : 'text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--g1)]'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Giám Sát Node &amp; Mạch Bảo Vệ</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('MQTT')}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer ${
                activeTab === 'MQTT'
                  ? 'bg-[var(--accent)] text-white shadow-xs'
                  : 'text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--g1)]'
              }`}
            >
              <Terminal className="w-4 h-4" />
              <span>Live MQTT Packet Sniffer</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('DLQ')}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer ${
                activeTab === 'DLQ'
                  ? 'bg-[var(--accent)] text-white shadow-xs'
                  : 'text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--g1)]'
              }`}
            >
              <ShieldAlert className={`w-4 h-4 ${activeTab === 'DLQ' ? 'text-white' : 'text-rose-500'}`} />
              <span>Cứu Tín Hiệu Thiết Bị (DLQ)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('OTA')}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer ${
                activeTab === 'OTA'
                  ? 'bg-[var(--accent)] text-white shadow-xs'
                  : 'text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--g1)]'
              }`}
            >
              <UploadCloud className={`w-4 h-4 ${activeTab === 'OTA' ? 'text-white' : 'text-indigo-500'}`} />
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
