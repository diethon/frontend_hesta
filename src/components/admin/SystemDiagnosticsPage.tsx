import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { UserResponse } from '../../types/auth';
import type { DiagnosticsSummary } from '../../types/diagnostics';
import { ProfileModal } from '../profile/ProfileModal';
import { DashboardNavRail } from '../home/DashboardNavRail';
import { DashboardBottomNav } from '../home/DashboardBottomNav';
import { NotificationBell } from '../notification/NotificationBell';
import { AdminAvatarMenu } from './AdminAvatarMenu';
import { NodeDiagnosticsWidget } from './NodeDiagnosticsWidget';
import { MqttSnifferConsole } from './MqttSnifferConsole';
import { DeadLetterQueueConsole } from './DeadLetterQueueConsole';
import { OtaCampaignManager } from './OtaCampaignManager';
import { getDiagnosticsSummary, getDeadLetters, getOtaCampaigns } from '../../services/diagnosticsApi';
import {
  Activity,
  Terminal,
  ShieldAlert,
  UploadCloud,
  Server,
  CheckCircle2,
  WifiOff,
  Home,
} from 'lucide-react';

type DiagnosticsTab = 'NODES' | 'MQTT' | 'DLQ' | 'OTA';

const TAB_TO_PARAM: Record<DiagnosticsTab, string> = {
  NODES: 'nodes',
  MQTT: 'mqtt',
  DLQ: 'dlq',
  OTA: 'ota',
};

const PARAM_TO_TAB: Record<string, DiagnosticsTab> = {
  nodes: 'NODES',
  mqtt: 'MQTT',
  dlq: 'DLQ',
  ota: 'OTA',
};

const TERMINAL_CAMPAIGN_STATUSES = new Set([
  'COMPLETED',
  'CANCELLED',
  'ABORTED',
  'ABORTED_AUTO',
  'ABORTED_FAILURE_THRESHOLD',
]);

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
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTabParam = (searchParams.get('tab') || '').toLowerCase();
  const activeTab: DiagnosticsTab = PARAM_TO_TAB[rawTabParam] ?? 'NODES';

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [summary, setSummary] = useState<DiagnosticsSummary | null>(null);
  const [unhandledDlqCount, setUnhandledDlqCount] = useState(0);
  const [activeOtaCount, setActiveOtaCount] = useState(0);

  const handleTabChange = (nextTab: DiagnosticsTab) => {
    const nextParams: Record<string, string> = { tab: TAB_TO_PARAM[nextTab] };
    if (nextTab === 'MQTT') {
      const existingHomeId = searchParams.get('homeId');
      const existingNode = searchParams.get('node');
      if (existingHomeId) nextParams.homeId = existingHomeId;
      if (existingNode) nextParams.node = existingNode;
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handleInspectNode = useCallback(
    (nodeCode: string, homeId?: string) => {
      setSearchParams({
        tab: 'mqtt',
        ...(homeId ? { homeId } : {}),
        node: nodeCode,
      });
    },
    [setSearchParams]
  );

  const fetchOverviewBadges = useCallback(async () => {
    try {
      const [sumRes, dlqRes, otaRes] = await Promise.allSettled([
        getDiagnosticsSummary(),
        getDeadLetters(100, true),
        getOtaCampaigns(),
      ]);
      if (sumRes.status === 'fulfilled') {
        setSummary(sumRes.value);
      }
      if (dlqRes.status === 'fulfilled') {
        setUnhandledDlqCount(dlqRes.value.filter((item) => !item.replayed).length);
      }
      if (otaRes.status === 'fulfilled') {
        setActiveOtaCount(
          otaRes.value.filter((camp) => !TERMINAL_CAMPAIGN_STATUSES.has(camp.status)).length
        );
      }
    } catch {
      // Non-blocking overview telemetry poll
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchOverviewBadges();
    const timer = setInterval(() => {
      void fetchOverviewBadges();
    }, 8000);
    return () => clearInterval(timer);
  }, [fetchOverviewBadges]);

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
    {
      id: 'maintenance',
      icon: 'wrench' as const,
      label: 'Bảo trì thiết bị',
      onClick: () => navigate('/admin/maintenance'),
      active: false,
    },
    {
      id: 'contracts',
      icon: 'briefcase' as const,
      label: 'Hợp đồng lắp đặt',
      onClick: () => navigate('/admin/contracts'),
      active: false,
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
    {
      id: 'maintenance',
      icon: 'wrench' as const,
      label: 'Bảo trì',
      onClick: () => navigate('/admin/maintenance'),
      active: false,
    },
    {
      id: 'contracts',
      icon: 'briefcase' as const,
      label: 'Hợp đồng',
      onClick: () => navigate('/admin/contracts'),
      active: false,
    },
  ];

  const tabs: Array<{
    id: DiagnosticsTab;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
    badge?: React.ReactNode;
  }> = [
    {
      id: 'NODES',
      label: 'Nhà & Edge Nodes',
      shortLabel: 'Nodes',
      icon: <Activity className="w-4 h-4 shrink-0" />,
      badge: summary ? (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
            activeTab === 'NODES'
              ? 'bg-white/25 text-white'
              : summary.quarantinedNodes > 0
              ? 'bg-error-soft text-rose-700 border border-rose-200'
              : 'bg-sidebar text-text border border-line'
          }`}
        >
          {summary.quarantinedNodes > 0 && (
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
          )}
          {summary.onlineNodes}/{summary.totalNodes}
        </span>
      ) : null,
    },
    {
      id: 'MQTT',
      label: 'Soi gói tin MQTT',
      shortLabel: 'Sniffer',
      icon: <Terminal className="w-4 h-4 shrink-0" />,
      badge: summary ? (
        <span
          className={`w-2 h-2 rounded-full ${
            summary.brokerConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
          }`}
          title={summary.brokerConnected ? 'Cloud Broker đang kết nối' : 'Cloud Broker mất kết nối'}
        />
      ) : null,
    },
    {
      id: 'DLQ',
      label: 'Hàng đợi chết (DLQ)',
      shortLabel: 'DLQ',
      icon: (
        <ShieldAlert
          className={`w-4 h-4 shrink-0 ${activeTab === 'DLQ' ? 'text-white' : 'text-rose-600'}`}
        />
      ),
      badge:
        unhandledDlqCount > 0 ? (
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              activeTab === 'DLQ'
                ? 'bg-white/25 text-white'
                : 'bg-error-soft text-rose-700 border border-rose-200'
            }`}
          >
            {unhandledDlqCount}
          </span>
        ) : null,
    },
    {
      id: 'OTA',
      label: 'Cập nhật Firmware (OTA)',
      shortLabel: 'OTA Firmware',
      icon: (
        <UploadCloud
          className={`w-4 h-4 shrink-0 ${activeTab === 'OTA' ? 'text-white' : 'text-sky-600'}`}
        />
      ),
      badge:
        activeOtaCount > 0 ? (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
              activeTab === 'OTA'
                ? 'bg-white/25 text-white'
                : 'bg-info-soft text-sky-700 border border-sky-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            {activeOtaCount} chạy
          </span>
        ) : null,
    },
  ];

  return (
    <div className="app-shell admin-diagnostics-page min-h-screen bg-app text-text relative">
      {/* Unified HESTA ambient background meshes */}
      <div className="mesh mesh-one pointer-events-none" />
      <div className="mesh mesh-two pointer-events-none" />
      <div className="mesh mesh-three pointer-events-none" />

      <DashboardNavRail
        activeItem="diagnostics"
        items={adminNavRailItems}
        user={user}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        hideSettings
        brandTitle="HESTA Admin Center"
      />

      <main
        id="main-content"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 pb-24 lg:pb-12"
      >
        <span className="sr-only">HESTA Admin Center</span>

        {/* TopBar */}
        <header className="flex items-center justify-between gap-4 py-2 border-b border-line/70">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text truncate">
              Chẩn đoán hạ tầng IoT
            </h1>
            <p className="text-xs text-muted mt-0.5 truncate">
              Giám sát Cloud Broker trung tâm, cụm Edge Nodes từng ngôi nhà, soi gói tin MQTT mục tiêu &amp; OTA Canary
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border border-line bg-surface/85 text-muted shadow-2xs">
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

        {/* Glassmorphic Infrastructure Status Strip */}
        <section
          aria-label="Tổng quan kiến trúc Cloud Broker và các ngôi nhà"
          className="rounded-3xl border border-line bg-surface/90 backdrop-blur-xl shadow-[0_14px_34px_rgba(62,113,147,0.08)] p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4"
        >
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-info-soft border border-sky-200/80 text-sky-700 flex items-center justify-center shrink-0">
              <Server className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-text">
                Cloud MQTT Broker Trung Tâm &amp; Mạng Edge Nodes Gia Đình
              </div>
              <p className="text-xs text-muted mt-0.5 leading-relaxed">
                <strong>Cloud Broker</strong> là đường trục hội tụ toàn hệ thống; từng cục{' '}
                <strong>Orange Pi 5 / ESP32</strong> tại mỗi nhà được gom nhóm quản lý riêng trong tab <em>Nhà &amp; Edge Nodes</em>.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 tabular-nums">
            {/* Live Cloud Broker Pill */}
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl border text-xs font-semibold ${
                summary?.brokerConnected
                  ? 'bg-success-soft border-emerald-200 text-emerald-700'
                  : 'bg-error-soft border-rose-200 text-rose-700'
              }`}
              title={summary?.brokerUrl || 'Cloud MQTT Broker'}
            >
              {summary?.brokerConnected ? (
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>
                {summary
                  ? summary.brokerConnected
                    ? 'Cloud Broker: CONNECTED'
                    : 'Cloud Broker: DISCONNECTED'
                  : 'Đang kiểm tra Cloud Broker...'}
              </span>
              {summary?.brokerUrl && (
                <span className="hidden xl:inline font-mono text-[11px] opacity-80 border-l border-current/25 pl-2">
                  {summary.brokerUrl}
                </span>
              )}
            </div>

            {/* Homes & Nodes Scale Pill */}
            {summary && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border border-line bg-sidebar/80 text-xs font-semibold text-text">
                <Home className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                <span>
                  {summary.totalHomes ?? 0} ngôi nhà &bull; {summary.onlineNodes}/{summary.totalNodes} node
                </span>
              </div>
            )}

            {/* Reliability Pill */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border border-line bg-sidebar/80 text-xs font-semibold text-text">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span className="text-muted font-medium">Độ tin cậy:</span>
              <span className="font-bold text-text">
                {summary ? `${summary.systemReliabilityPct.toFixed(1)}%` : '--'}
              </span>
            </div>
          </div>
        </section>

        {/* Sub-Navigation Segmented Tabs */}
        <nav
          aria-label="Phân hệ chẩn đoán và OTA"
          className="p-1.5 rounded-2xl border border-line bg-surface/90 backdrop-blur-md shadow-soft"
        >
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-stretch sm:items-center gap-1.5">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleTabChange(tab.id)}
                  className={`inline-flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                    isActive
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-muted hover:text-text hover:bg-sidebar-hover/70'
                  }`}
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden truncate">{tab.shortLabel}</span>
                  {tab.badge}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Active Tab Content */}
        <div className="gentle-rise">
          {activeTab === 'NODES' && (
            <NodeDiagnosticsWidget
              onStatsChange={fetchOverviewBadges}
              onInspectNode={handleInspectNode}
            />
          )}
          {activeTab === 'MQTT' && <MqttSnifferConsole />}
          {activeTab === 'DLQ' && <DeadLetterQueueConsole onQueueChange={fetchOverviewBadges} />}
          {activeTab === 'OTA' && <OtaCampaignManager onCampaignChange={fetchOverviewBadges} />}
        </div>
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
