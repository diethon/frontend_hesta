import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useAppSelector } from '../../store/hooks';
import { DashboardNavRail } from '../home/DashboardNavRail';
import { DashboardBottomNav } from '../home/DashboardBottomNav';
import { VoiceAssistantButton } from '../ui/VoiceAssistant';
import { NotificationBell } from '../notification/NotificationBell';
import { getHomeEnergyAnalytics, energyAnalyticsKey } from '../../services/energyApi';
import { peekCache } from '../../services/queryCache';
import type { EnergyAnalyticsResponse, DeviceEnergyBreakdown } from '../../types/energy';
import { getErrorMessage } from '../../utils/errors';
import {
  Zap,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  DollarSign,
  RefreshCw,
  PieChart,
  BarChart3,
  ShieldCheck,
  Activity,
  Layers,
} from 'lucide-react';
import { DemandResponseCard } from './DemandResponseCard';
import { EnergyTrendChart } from './EnergyTrendChart';
import { EvnTierLadder } from './EvnTierLadder';
import { RoomBreakdownCard } from './RoomBreakdownCard';
import { TopConsumersCard } from './TopConsumersCard';
import { formatVnd, formatKwh, getTierColorClass } from './energyUtils';
import './energy.css';

const DONUT_COLORS = [
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#8b5cf6', // Violet
  '#f43f5e', // Rose
  '#3b82f6', // Blue
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#eab308', // Yellow
  '#6366f1', // Indigo
];

export const EnergyDashboardPage: React.FC = () => {
  const { homeId } = useParams<{ homeId: string }>();
  const navigate = useNavigate();
  const authUser = useAppSelector((state) => state.auth.user);
  const userInitial = authUser?.fullName ? authUser.fullName.charAt(0).toUpperCase() : 'U';

  const [activeTab, setActiveTab] = useState<'overview' | 'protection'>('overview');
  const [period, setPeriod] = useState<'24H' | '7D' | '30D'>('30D');
  const [data, setData] = useState<EnergyAnalyticsResponse | null>(
    () => (homeId ? peekCache<EnergyAnalyticsResponse>(energyAnalyticsKey(homeId, '30D')) ?? null : null)
  );
  const [loading, setLoading] = useState(
    () => !(homeId && peekCache(energyAnalyticsKey(homeId, '30D')))
  );
  const [error, setError] = useState('');
  const [hoveredBreakdown, setHoveredBreakdown] = useState<DeviceEnergyBreakdown | null>(null);
  const [showZeroDevices, setShowZeroDevices] = useState(false);

  // Fetch energy data on mount and period changes
  useEffect(() => {
    let active = true;
    if (!homeId) return;

    // Fast-path: if cached data exists, render immediately with 0ms delay
    const cached = peekCache<EnergyAnalyticsResponse>(energyAnalyticsKey(homeId, period));
    if (cached) {
      setData(cached);
      setLoading(false);
    }

    getHomeEnergyAnalytics(homeId, period)
      .then((res) => {
        if (!active) return;
        setData(res);
        setError('');
        setLoading(false);

        // Silently prefetch remaining periods so future tab switches are instant (0ms)
        const otherPeriods = (['24H', '7D', '30D'] as const).filter((p) => p !== period);
        setTimeout(() => {
          if (!active) return;
          otherPeriods.forEach((p) => {
            getHomeEnergyAnalytics(homeId, p).catch(() => null);
          });
        }, 150);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(getErrorMessage(err, 'Không thể tải dữ liệu phân tích năng lượng'));
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [homeId, period]);

  const handlePeriodChange = (newPeriod: '24H' | '7D' | '30D') => {
    if (newPeriod !== period) {
      const cached = homeId ? peekCache<EnergyAnalyticsResponse>(energyAnalyticsKey(homeId, newPeriod)) : undefined;
      if (cached) {
        setData(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }
      setPeriod(newPeriod);
    }
  };

  const handleRefresh = async () => {
    if (!homeId) return;
    setLoading(true);
    try {
      const res = await getHomeEnergyAnalytics(homeId, period, true);
      setData(res);
      setError('');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Không thể tải dữ liệu phân tích năng lượng'));
    } finally {
      setLoading(false);
    }
  };

  const summary = data?.summary;
  const timeSeries = useMemo(() => data?.timeSeries || [], [data?.timeSeries]);
  const breakdown = useMemo(() => data?.breakdown || [], [data?.breakdown]);
  const sortedBreakdown = useMemo(
    () => [...breakdown].sort((a, b) => (b.kwh || 0) - (a.kwh || 0)),
    [breakdown]
  );

  // Compute average per point and peak point from timeSeries
  const { avgPointKwh, peakPoint } = useMemo(() => {
    if (!timeSeries || timeSeries.length === 0) {
      return { avgPointKwh: 0, peakPoint: null };
    }
    const sum = timeSeries.reduce((s, p) => s + (p.kwh || 0), 0);
    const avg = sum / timeSeries.length;
    let peak = timeSeries[0];
    for (const p of timeSeries) {
      if ((p.kwh || 0) > (peak.kwh || 0)) {
        peak = p;
      }
    }
    return { avgPointKwh: avg, peakPoint: peak };
  }, [timeSeries]);

  const tierColors = getTierColorClass(summary?.currentTier ?? 1);

  return (
    <div className="app-shell energy-page">
      {/* 3 Pastel glowing background meshes matching Figma v2/v3 design */}
      <div className="mesh mesh-one" />
      <div className="mesh mesh-two" />
      <div className="mesh mesh-three" />

      {/* Unified NavRail sidebar */}
      <DashboardNavRail
        homeId={homeId}
        activeItem="energy"
        user={authUser || undefined}
        onSelectOverview={() => navigate('/home')}
      />

      <main>
        {/* Topbar matching Figma v2/v3 design */}
        <header className="topbar scenes-topbar">
          <div>
            <span className="eyebrow">QUẢN LÝ ĐIỆN NĂNG &amp; HÓA ĐƠN</span>
            <h2>
              Tiêu thụ điện năng <span className="sr-only">Phân tích năng lượng</span>
            </h2>
          </div>
          <div className="top-actions">
            <VoiceAssistantButton />
            <NotificationBell />
            <div className="avatar">{userInitial}</div>
          </div>
        </header>

        {/* Actions Bar matching scenes-actions */}
        <div className="scenes-actions">
          {/* Segmented Tab Control */}
          <div className="scene-filter cols-2">
            <button
              type="button"
              className={activeTab === 'overview' ? 'active' : ''}
              onClick={() => setActiveTab('overview')}
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
              <span>Tổng quan &amp; Hóa đơn</span>
            </button>
            <button
              type="button"
              className={activeTab === 'protection' ? 'active' : ''}
              onClick={() => setActiveTab('protection')}
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Bảo vệ quá tải</span>
            </button>
          </div>

          {/* Right Action Tools */}
          <div className="scene-actions-right">
            {activeTab === 'overview' && (
              <div className="flex items-center gap-1 bg-[var(--g1)] p-1 rounded-full border border-[var(--border)] shadow-xs">
                {(['24H', '7D', '30D'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePeriodChange(p)}
                    className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                      period === p
                        ? 'bg-[var(--accent)] text-white shadow-xs'
                        : 'text-[var(--secondary)] hover:text-[var(--text)]'
                    }`}
                  >
                    {p === '24H' ? '24 Giờ' : p === '7D' ? '7 Ngày' : 'Tháng Này'}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={loading}
              className="scene-ghost flex items-center gap-1.5 cursor-pointer"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Làm mới</span>
            </button>

            <button
              type="button"
              className="scene-ghost flex items-center gap-1.5 cursor-pointer"
              onClick={() => navigate(homeId ? `/home/${homeId}/devices` : '/home')}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Thiết bị</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 mb-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-sm flex items-center gap-2.5 backdrop-blur-md">
            <AlertCircle className="h-5 w-5 shrink-0" />
            {error}
          </div>
        )}

        {/* TAB 1: TỔNG QUAN & HÓA ĐƠN */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 1. KPI ROW: 4 CARDS */}
            {loading && !data ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="glass-card glass-g2 p-5 rounded-2xl h-36 border border-[var(--border)] flex flex-col justify-between"
                  >
                    <div className="h-3 w-24 bg-[var(--border)] rounded" />
                    <div className="h-8 w-32 bg-[var(--border)] rounded" />
                    <div className="h-3 w-40 bg-[var(--border)] rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
                {/* KPI Card 1: Tổng điện năng tiêu thụ */}
                <div className="glass-card glass-g2 p-5 rounded-2xl relative overflow-hidden shadow-xs border border-[var(--border)] transition-all duration-200 hover:-translate-y-0.5">
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--secondary)]">
                      Điện Năng Tiêu Thụ
                    </span>
                    <span className="p-2 bg-amber-500/15 text-amber-500 rounded-xl border border-amber-500/20">
                      <Zap className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-[var(--text)] tracking-tight">
                      {formatKwh(summary?.totalKwh)}
                    </span>
                    <span className="text-sm font-bold text-amber-500">kWh</span>
                  </div>
                  <div className="mt-2 text-xs text-[var(--secondary)] flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="truncate">
                        Hoạt động: {summary?.activeDeviceCount ?? 0}/{summary?.totalDeviceCount ?? 0}
                      </span>
                    </div>
                    {summary?.comparisonLastPeriodPercent !== undefined && summary.comparisonLastPeriodPercent !== 0 && (
                      <span
                        className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                          summary.comparisonLastPeriodPercent > 0
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                            : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        }`}
                        title="So sánh với chu kỳ trước"
                      >
                        {summary.comparisonLastPeriodPercent > 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        <span>
                          {summary.comparisonLastPeriodPercent > 0
                            ? `+${summary.comparisonLastPeriodPercent}%`
                            : `${summary.comparisonLastPeriodPercent}%`}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                {/* KPI Card 2: Tiền điện tạm tính */}
                <div className="glass-card glass-g2 p-5 rounded-2xl relative overflow-hidden shadow-xs border border-[var(--border)] transition-all duration-200 hover:-translate-y-0.5">
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--secondary)]">
                      Tiền Điện Tạm Tính
                    </span>
                    <span className="p-2 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20">
                      <DollarSign className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="mt-3">
                    <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
                      {formatVnd(summary?.estimatedCostVnd)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tierColors.badge}`}
                    >
                      Bậc {summary?.currentTier ?? 1}
                    </span>
                    <span className="text-xs text-[var(--secondary)]">Đã gồm VAT 8%</span>
                  </div>
                </div>

                {/* KPI Card 3: Dự báo cuối tháng */}
                <div className="glass-card glass-g2 p-5 rounded-2xl relative overflow-hidden shadow-xs border border-[var(--border)] transition-all duration-200 hover:-translate-y-0.5">
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--secondary)]">
                      Dự Báo Cuối Tháng
                    </span>
                    <span className="p-2 bg-[var(--accent-soft)] text-[var(--accent)] rounded-xl border border-[var(--accent)]/20">
                      <TrendingUp className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-[var(--text)] tracking-tight">
                      {formatKwh(summary?.projectedMonthKwh)}
                    </span>
                    <span className="text-sm font-bold text-[var(--accent)]">kWh</span>
                  </div>
                  <div className="mt-2 text-xs text-[var(--secondary)]">
                    Ước tính:{' '}
                    <span className="font-semibold text-[var(--text)] font-mono">
                      {formatVnd(summary?.projectedMonthCostVnd)}
                    </span>
                  </div>
                </div>

                {/* KPI Card 4: Trung bình mỗi mốc / Đỉnh tiêu thụ */}
                <div className="glass-card glass-g2 p-5 rounded-2xl relative overflow-hidden shadow-xs border border-[var(--border)] transition-all duration-200 hover:-translate-y-0.5">
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--secondary)]">
                      Trung Bình &amp; Đỉnh Mốc
                    </span>
                    <span className="p-2 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-500/20">
                      <Activity className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-[var(--text)] tracking-tight">
                      {formatKwh(avgPointKwh, 1)}
                    </span>
                    <span className="text-sm font-bold text-indigo-500">kWh/mốc</span>
                  </div>
                  <div className="mt-2 text-xs text-[var(--secondary)] truncate">
                    {peakPoint ? (
                      <span>
                        Đỉnh: <strong className="text-rose-500 font-mono">{formatKwh(peakPoint.kwh)} kWh</strong> ({peakPoint.label})
                      </span>
                    ) : (
                      <span>Chưa có mốc phát sinh</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 2. GRID ROW: TREND CHART (SPAN 8) + EVN TIER LADDER (SPAN 4) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              <div className="lg:col-span-8 flex flex-col">
                <EnergyTrendChart
                  timeSeries={timeSeries}
                  period={period}
                  comparisonPercent={summary?.comparisonLastPeriodPercent}
                  isLoading={loading && !data}
                />
              </div>

              <div className="lg:col-span-4 flex flex-col">
                <EvnTierLadder
                  totalKwh={summary?.totalKwh ?? 0}
                  projectedMonthKwh={summary?.projectedMonthKwh ?? 0}
                  currentTier={summary?.currentTier ?? 1}
                  period={period}
                />
              </div>
            </div>

            {/* 3. GRID ROW: DEVICE BREAKDOWN DONUT (SPAN 7) + ROOM BREAKDOWN (SPAN 5) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Device Breakdown Donut & List (span 7) */}
              <div className="lg:col-span-7 flex flex-col">
                <div className="glass-card glass-g2 p-5 sm:p-6 rounded-3xl border border-[var(--border)] shadow-xs space-y-6 h-full flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2 border-b border-[var(--border)]/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-amber-500/15 text-amber-500">
                        <PieChart className="h-4 w-4" />
                      </span>
                      <h3 className="text-base sm:text-lg font-bold text-[var(--text)] tracking-tight">
                        Theo Thiết Bị
                      </h3>
                    </div>
                    {hoveredBreakdown && (
                      <button
                        type="button"
                        onClick={() => setHoveredBreakdown(null)}
                        className="scene-ghost text-xs px-2.5 py-1 cursor-pointer"
                      >
                        Bỏ chọn lọc
                      </button>
                    )}
                  </div>

                  {sortedBreakdown.length === 0 ? (
                    <div className="py-12 text-center text-xs text-[var(--secondary)] flex flex-col items-center justify-center space-y-2">
                      <Layers className="w-8 h-8 text-[var(--tertiary)] stroke-[1.5]" />
                      <p>Chưa có dữ liệu tiêu thụ điện của thiết bị trong khoảng thời gian này.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center my-auto">
                      {/* Left: SVG Donut Chart */}
                      <div className="md:col-span-5 flex flex-col items-center justify-center relative">
                        <div className="relative w-56 h-56 sm:w-64 sm:h-64">
                          <svg viewBox="0 0 280 280" className="w-full h-full transform -rotate-90">
                            {/* Background track circle */}
                            <circle
                              cx="140"
                              cy="140"
                              r="90"
                              fill="none"
                              stroke="currentColor"
                              className="text-[var(--border)] opacity-40"
                              strokeWidth="32"
                              style={{ pointerEvents: 'none' }}
                            />
                            {/* Slices */}
                            {(() => {
                              const activeBreakdown = sortedBreakdown.filter((d) => (d.kwh || 0) > 0.001);
                              const totalActiveKwh = activeBreakdown.reduce((sum, d) => sum + (d.kwh || 0), 0);
                              const circumference = 2 * Math.PI * 90;

                              if (activeBreakdown.length === 0 || totalActiveKwh <= 0.001) {
                                return (
                                  <circle
                                    cx="140"
                                    cy="140"
                                    r="90"
                                    fill="none"
                                    stroke="currentColor"
                                    className="text-[var(--border)] opacity-60"
                                    strokeWidth="24"
                                    strokeDasharray="6 8"
                                    style={{ pointerEvents: 'none' }}
                                  />
                                );
                              }

                              if (activeBreakdown.length === 1) {
                                const dev = activeBreakdown[0];
                                const originalIdx = sortedBreakdown.findIndex((d) => d.deviceId === dev.deviceId);
                                const color = DONUT_COLORS[(originalIdx >= 0 ? originalIdx : 0) % DONUT_COLORS.length];
                                const isHovered = hoveredBreakdown?.deviceId === dev.deviceId;
                                return (
                                  <circle
                                    key={dev.deviceId}
                                    cx="140"
                                    cy="140"
                                    r="90"
                                    fill="none"
                                    stroke={color}
                                    strokeWidth={isHovered ? 34 : 28}
                                    strokeLinecap="butt"
                                    className="transition-all duration-300 cursor-pointer"
                                    style={{
                                      pointerEvents: 'stroke',
                                      opacity: hoveredBreakdown && !isHovered ? 0.35 : 1,
                                      filter: isHovered ? `drop-shadow(0 0 10px ${color}80)` : undefined,
                                    }}
                                    onMouseEnter={() => setHoveredBreakdown(dev)}
                                    onMouseLeave={() => setHoveredBreakdown(null)}
                                  />
                                );
                              }

                              let accumulated = 0;
                              return activeBreakdown.map((dev) => {
                                const originalIdx = sortedBreakdown.findIndex((d) => d.deviceId === dev.deviceId);
                                const color = DONUT_COLORS[(originalIdx >= 0 ? originalIdx : 0) % DONUT_COLORS.length];
                                const pct = (dev.kwh / totalActiveKwh) * 100;
                                const sliceLen = (pct / 100) * circumference;
                                const gap = 3;
                                const dashLength = Math.max(sliceLen - gap, 1);
                                const strokeDasharray = `${dashLength} ${circumference - dashLength}`;
                                const strokeDashoffset = -accumulated;
                                accumulated += sliceLen;

                                const isHovered = hoveredBreakdown?.deviceId === dev.deviceId;

                                return (
                                  <circle
                                    key={dev.deviceId}
                                    cx="140"
                                    cy="140"
                                    r="90"
                                    fill="none"
                                    stroke={color}
                                    strokeWidth={isHovered ? 34 : 28}
                                    strokeDasharray={strokeDasharray}
                                    strokeDashoffset={strokeDashoffset}
                                    strokeLinecap="butt"
                                    className="transition-all duration-300 cursor-pointer"
                                    style={{
                                      pointerEvents: 'stroke',
                                      opacity: hoveredBreakdown && !isHovered ? 0.35 : 1,
                                      filter: isHovered ? `drop-shadow(0 0 10px ${color}80)` : undefined,
                                    }}
                                    onMouseEnter={() => setHoveredBreakdown(dev)}
                                    onMouseLeave={() => setHoveredBreakdown(null)}
                                  />
                                );
                              });
                            })()}
                          </svg>

                          {/* Center hole statistics */}
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 pointer-events-none tabular-nums">
                            <span className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider truncate max-w-[130px]">
                              {hoveredBreakdown ? hoveredBreakdown.deviceName : 'Tổng Tiêu Thụ'}
                            </span>
                            <div className="flex items-baseline gap-1 my-0.5">
                              <span className="text-2xl font-extrabold text-[var(--text)] tracking-tight">
                                {formatKwh(hoveredBreakdown ? hoveredBreakdown.kwh : (summary?.totalKwh ?? 0))}
                              </span>
                              <span className="text-xs font-bold text-amber-500">kWh</span>
                            </div>
                            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 truncate max-w-[140px]">
                              {hoveredBreakdown
                                ? `${hoveredBreakdown.percentage}% (${formatVnd(hoveredBreakdown.costVnd)})`
                                : (summary?.totalKwh ?? 0) <= 0
                                ? 'Chưa phát sinh tiêu thụ'
                                : formatVnd(summary?.estimatedCostVnd)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Device list */}
                      <div className="md:col-span-7 space-y-2">
                        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1 energy-scroll-area">
                          {(() => {
                            const activeDevs = sortedBreakdown.filter((d) => (d.kwh || 0) > 0.001);
                            const zeroCount = sortedBreakdown.length - activeDevs.length;
                            const visibleDevs = showZeroDevices ? sortedBreakdown : activeDevs;

                            return (
                              <>
                                {visibleDevs.map((dev, idx) => {
                                  const color = DONUT_COLORS[idx % DONUT_COLORS.length];
                                  const isHovered = hoveredBreakdown?.deviceId === dev.deviceId;

                                  return (
                                    <div
                                      key={dev.deviceId}
                                      onMouseEnter={() => setHoveredBreakdown(dev)}
                                      onMouseLeave={() => setHoveredBreakdown(null)}
                                      className={`p-3 rounded-2xl border transition-all cursor-pointer space-y-1.5 ${
                                        isHovered
                                          ? 'bg-[var(--solid)] border-[var(--accent)] shadow-md ring-1 ring-[var(--accent)]/30'
                                          : 'bg-[var(--g1)] border-[var(--border)] hover:bg-[var(--solid)]/80'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span
                                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                                            style={{ backgroundColor: color }}
                                          />
                                          <div className="min-w-0">
                                            <span className="text-xs font-bold text-[var(--text)] truncate block">
                                              {dev.deviceName}
                                            </span>
                                            <span className="text-[10px] text-[var(--secondary)] truncate block">
                                              {dev.roomName || dev.deviceType}
                                              {dev.totalOnHours ? ` • ${dev.totalOnHours}h` : ''}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="text-right shrink-0 font-mono">
                                          <div className="flex items-baseline justify-end gap-1.5">
                                            <span className="text-xs font-bold text-amber-500">
                                              {formatKwh(dev.kwh)} kWh
                                            </span>
                                            <span className="text-[11px] font-semibold text-[var(--secondary)]">
                                              ({dev.percentage}%)
                                            </span>
                                          </div>
                                          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 block">
                                            {formatVnd(dev.costVnd)}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="w-full h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
                                        <div
                                          style={{
                                            width: `${Math.min(dev.percentage, 100)}%`,
                                            backgroundColor: color,
                                          }}
                                          className="h-full rounded-full transition-all duration-300"
                                        />
                                      </div>
                                    </div>
                                  );
                                })}

                                {zeroCount > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setShowZeroDevices((prev) => !prev)}
                                    className="w-full py-2 text-[11px] font-semibold text-[var(--secondary)] hover:text-[var(--text)] transition-colors cursor-pointer text-center"
                                  >
                                    {showZeroDevices
                                      ? 'Ẩn các thiết bị 0 kWh'
                                      : `+ Xem thêm ${zeroCount} thiết bị chưa tiêu thụ điện (0 kWh)`}
                                  </button>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Room Breakdown Card (span 5) */}
              <div className="lg:col-span-5 flex flex-col">
                <RoomBreakdownCard
                  breakdown={breakdown}
                  totalKwh={summary?.totalKwh ?? 0}
                  period={period}
                />
              </div>
            </div>

            {/* 4. TOP CONSUMERS & SMART SAVING TIPS (SPAN 12) */}
            <TopConsumersCard
              breakdown={breakdown}
              summary={summary}
              period={period}
              homeId={homeId}
            />
          </div>
        )}

        {/* TAB 2: BẢO VỆ QUÁ TẢI (DEMAND RESPONSE & PEAK SHAVING) */}
        {activeTab === 'protection' && homeId && (
          <div className="space-y-6">
            <DemandResponseCard homeId={homeId} />
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation matching Figma v2/v3 design */}
      <DashboardBottomNav
        activeItem="energy"
        homeId={homeId}
        onSelectOverview={() => navigate('/home')}
      />
    </div>
  );
};
