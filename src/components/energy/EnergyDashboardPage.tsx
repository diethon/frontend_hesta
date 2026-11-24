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
  const userInitial = authUser?.fullName
    ? authUser.fullName.trim().split(' ').slice(-1)[0]?.charAt(0).toUpperCase() || 'M'
    : 'M';

  const [activeTab, setActiveTab] = useState<'overview' | 'protection'>('overview');
  const [period, setPeriod] = useState<'24H' | '7D' | '30D'>('30D');
  const [data, setData] = useState<EnergyAnalyticsResponse | null>(
    () => (homeId ? peekCache<EnergyAnalyticsResponse>(energyAnalyticsKey(homeId, '30D')) ?? null : null)
  );
  const [monthlyTotalKwh, setMonthlyTotalKwh] = useState<number | undefined>(
    () => (homeId ? peekCache<EnergyAnalyticsResponse>(energyAnalyticsKey(homeId, '30D'))?.summary?.totalKwh : undefined)
  );
  const [loading, setLoading] = useState(
    () => !(homeId && peekCache(energyAnalyticsKey(homeId, '30D')))
  );
  const [error, setError] = useState('');
  const [hoveredBreakdown, setHoveredBreakdown] = useState<DeviceEnergyBreakdown | null>(null);
  const [pinnedBreakdown, setPinnedBreakdown] = useState<DeviceEnergyBreakdown | null>(null);
  const [showZeroDevices, setShowZeroDevices] = useState(false);

  // Fetch energy data on mount and period changes
  useEffect(() => {
    let active = true;
    if (!homeId) return;

    // Fast-path: if cached data exists, render immediately with 0ms delay
    const cached = peekCache<EnergyAnalyticsResponse>(energyAnalyticsKey(homeId, period));
    if (cached) {
      setData(cached);
      if (period === '30D') {
        setMonthlyTotalKwh(cached.summary?.totalKwh);
      }
      setLoading(false);
    }

    getHomeEnergyAnalytics(homeId, period)
      .then((res) => {
        if (!active) return;
        setData(res);
        if (period === '30D') {
          setMonthlyTotalKwh(res.summary?.totalKwh);
        }
        setError('');
        setLoading(false);

        // Silently prefetch remaining periods so future tab switches are instant (0ms)
        const otherPeriods = (['24H', '7D', '30D'] as const).filter((p) => p !== period);
        setTimeout(() => {
          if (!active) return;
          otherPeriods.forEach((p) => {
            getHomeEnergyAnalytics(homeId, p)
              .then((otherRes) => {
                if (active && p === '30D') {
                  setMonthlyTotalKwh(otherRes.summary?.totalKwh);
                }
              })
              .catch(() => null);
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
      setHoveredBreakdown(null);
      setPinnedBreakdown(null);
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
      if (period === '30D') {
        setMonthlyTotalKwh(res.summary?.totalKwh);
      }
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
  const deviceColorMap = useMemo(() => {
    const map = new Map<string, string>();
    sortedBreakdown.forEach((d, idx) => {
      map.set(d.deviceId, DONUT_COLORS[idx % DONUT_COLORS.length]);
    });
    return map;
  }, [sortedBreakdown]);
  const activeBreakdown = hoveredBreakdown ?? pinnedBreakdown;

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
              <div className="flex items-center gap-1 bg-white/95 p-1 rounded-full border border-[#cbd5e1] shadow-xs">
                {(['24H', '7D', '30D'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePeriodChange(p)}
                    className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                      period === p
                        ? 'bg-[#2563eb] text-white shadow-xs'
                        : 'text-[#475569] hover:text-[#0f172a]'
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
              className="scene-ghost !border-[#cbd5e1] !bg-white/95 !text-[#0f172a] flex items-center gap-1.5 cursor-pointer"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Làm mới</span>
            </button>

            <button
              type="button"
              className="scene-ghost !border-[#cbd5e1] !bg-white/95 !text-[#0f172a] flex items-center gap-1.5 cursor-pointer"
              onClick={() => navigate(homeId ? `/home/${homeId}/devices` : '/home')}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Thiết bị</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 mb-6 rounded-2xl bg-[#fff1f2] border border-[#f43f5e]/45 text-[#be123c] text-sm flex items-center gap-2.5">
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
                    className="bg-white/95 p-5 rounded-2xl h-36 border border-[#cbd5e1] flex flex-col justify-between"
                  >
                    <div className="h-3 w-24 bg-[#e2e8f0] rounded" />
                    <div className="h-8 w-32 bg-[#e2e8f0] rounded" />
                    <div className="h-3 w-40 bg-[#e2e8f0] rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
                {/* KPI Card 1: Tổng điện năng tiêu thụ */}
                <div className="bg-white/95 p-5 rounded-2xl relative overflow-hidden shadow-sm border border-[#cbd5e1] hover:border-[#94a3b8] transition-all duration-200">
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#475569]">
                      Điện Năng Tiêu Thụ
                    </span>
                    <span className="p-2 bg-[#fffbeb] text-[#d97706] rounded-xl border border-[#f59e0b]/40">
                      <Zap className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-[#0f172a] tracking-tight">
                      {formatKwh(summary?.totalKwh)}
                    </span>
                    <span className="text-sm font-bold text-[#b45309]">kWh</span>
                  </div>
                  <div className="mt-2 text-xs text-[#475569] flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] shrink-0" />
                      <span className="truncate">
                        Hoạt động: {summary?.activeDeviceCount ?? 0}/{summary?.totalDeviceCount ?? 0}
                      </span>
                    </div>
                    {summary?.comparisonLastPeriodPercent !== undefined && summary.comparisonLastPeriodPercent !== 0 && (
                      <span
                        className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${
                          summary.comparisonLastPeriodPercent > 0
                            ? 'bg-[#fff1f2] text-[#be123c] border-[#f43f5e]/40'
                            : 'bg-[#ecfdf5] text-[#047857] border-[#10b981]/40'
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
                <div className="bg-white/95 p-5 rounded-2xl relative overflow-hidden shadow-sm border border-[#cbd5e1] hover:border-[#94a3b8] transition-all duration-200">
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#475569]">
                      Tiền Điện Tạm Tính
                    </span>
                    <span className="p-2 bg-[#ecfdf5] text-[#047857] rounded-xl border border-[#10b981]/40">
                      <DollarSign className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="mt-3">
                    <span className="text-2xl sm:text-3xl font-extrabold text-[#047857] tracking-tight">
                      {formatVnd(summary?.estimatedCostVnd)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tierColors.badge}`}
                    >
                      Bậc {summary?.currentTier ?? 1}
                    </span>
                    <span className="text-xs text-[#475569]">Đã gồm VAT 8%</span>
                  </div>
                </div>

                {/* KPI Card 3: Dự báo cuối tháng */}
                <div className="bg-white/95 p-5 rounded-2xl relative overflow-hidden shadow-sm border border-[#cbd5e1] hover:border-[#94a3b8] transition-all duration-200">
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#475569]">
                      Dự Báo Cuối Tháng
                    </span>
                    <span className="p-2 bg-[#eff6ff] text-[#1d4ed8] rounded-xl border border-[#3b82f6]/40">
                      <TrendingUp className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-[#0f172a] tracking-tight">
                      {formatKwh(summary?.projectedMonthKwh)}
                    </span>
                    <span className="text-sm font-bold text-[#2563eb]">kWh</span>
                  </div>
                  <div className="mt-2 text-xs text-[#475569]">
                    Ước tính:{' '}
                    <span className="font-semibold text-[#0f172a] font-mono">
                      {formatVnd(summary?.projectedMonthCostVnd)}
                    </span>
                  </div>
                </div>

                {/* KPI Card 4: Trung bình mỗi mốc / Đỉnh tiêu thụ */}
                <div className="bg-white/95 p-5 rounded-2xl relative overflow-hidden shadow-sm border border-[#cbd5e1] hover:border-[#94a3b8] transition-all duration-200">
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#475569]">
                      Trung Bình &amp; Đỉnh Mốc
                    </span>
                    <span className="p-2 bg-[#eef2ff] text-[#4338ca] rounded-xl border border-[#6366f1]/40">
                      <Activity className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-[#0f172a] tracking-tight">
                      {formatKwh(avgPointKwh, 1)}
                    </span>
                    <span className="text-sm font-bold text-[#4338ca]">kWh/mốc</span>
                  </div>
                  <div className="mt-2 text-xs text-[#475569] truncate">
                    {peakPoint ? (
                      <span>
                        Đỉnh: <strong className="text-[#be123c] font-mono">{formatKwh(peakPoint.kwh)} kWh</strong> ({peakPoint.label})
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
                  monthlyTotalKwh={monthlyTotalKwh}
                />
              </div>
            </div>

            {/* 3. GRID ROW: DEVICE BREAKDOWN DONUT (SPAN 7) + ROOM BREAKDOWN (SPAN 5) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Device Breakdown Donut & List (span 7) */}
              <div className="lg:col-span-7 flex flex-col">
                {(() => {
                  const activeDevs = sortedBreakdown.filter((d) => (d.kwh || 0) > 0.001);
                  const totalActiveKwh = activeDevs.reduce((sum, d) => sum + (d.kwh || 0), 0);
                  const zeroCount = sortedBreakdown.length - activeDevs.length;
                  const visibleDevs = showZeroDevices ? sortedBreakdown : activeDevs;
                  const circumference = 2 * Math.PI * 90;

                  return (
                    <div className="bg-white/95 p-5 sm:p-6 rounded-3xl border border-[#cbd5e1] shadow-sm flex flex-col gap-5 h-full">
                      <div className="flex items-center justify-between gap-2 border-b border-[#e2e8f0] pb-3 min-h-[44px]">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 rounded-lg bg-[#fffbeb] text-[#d97706] border border-[#f59e0b]/40">
                            <PieChart className="h-4 w-4" />
                          </span>
                          <h3 className="text-base sm:text-lg font-bold text-[#0f172a] tracking-tight">
                            Theo Thiết Bị
                          </h3>
                        </div>
                        <div className="h-7 flex items-center shrink-0">
                          {pinnedBreakdown ? (
                            <button
                              type="button"
                              onClick={() => setPinnedBreakdown(null)}
                              className="h-7 px-2.5 rounded-full text-[11px] font-semibold bg-[#eff6ff] text-[#1d4ed8] border border-[#3b82f6]/40 hover:bg-[#dbeafe] transition-colors cursor-pointer"
                            >
                              Bỏ ghim
                            </button>
                          ) : (
                            <span className="h-7 inline-flex items-center px-2.5 rounded-full text-[11px] font-semibold bg-[#f8fafc] border border-[#cbd5e1] text-[#475569]">
                              {activeDevs.length} thiết bị tiêu thụ
                            </span>
                          )}
                        </div>
                      </div>

                      {sortedBreakdown.length === 0 ? (
                        <div className="py-12 text-center text-xs text-[#475569] flex flex-col items-center justify-center space-y-2">
                          <Layers className="w-8 h-8 text-[#94a3b8] stroke-[1.5]" />
                          <p>Chưa có dữ liệu tiêu thụ điện của thiết bị trong khoảng thời gian này.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                          {/* Left: SVG Donut Chart */}
                          <div className="md:col-span-5 flex flex-col items-center justify-center relative pt-2">
                            <div className="relative w-56 h-56 sm:w-64 sm:h-64">
                              <svg viewBox="0 0 280 280" className="w-full h-full transform -rotate-90">
                                {/* Background track circle */}
                                <circle
                                  cx="140"
                                  cy="140"
                                  r="90"
                                  fill="none"
                                  stroke="#e2e8f0"
                                  strokeWidth="30"
                                  style={{ pointerEvents: 'none' }}
                                />
                                {/* Slices */}
                                {(() => {
                                  if (activeDevs.length === 0 || totalActiveKwh <= 0.001) {
                                    return (
                                      <circle
                                        cx="140"
                                        cy="140"
                                        r="90"
                                        fill="none"
                                        stroke="#cbd5e1"
                                        strokeWidth="24"
                                        strokeDasharray="6 8"
                                        style={{ pointerEvents: 'none' }}
                                      />
                                    );
                                  }

                                  if (activeDevs.length === 1) {
                                    const dev = activeDevs[0];
                                    const color = deviceColorMap.get(dev.deviceId) ?? DONUT_COLORS[0];
                                    const isActive = activeBreakdown?.deviceId === dev.deviceId;
                                    return (
                                      <circle
                                        key={dev.deviceId}
                                        cx="140"
                                        cy="140"
                                        r="90"
                                        fill="none"
                                        stroke={color}
                                        strokeWidth={isActive ? 34 : 28}
                                        strokeLinecap="butt"
                                        className="transition-all duration-200 cursor-pointer"
                                        style={{
                                          pointerEvents: 'stroke',
                                          opacity: activeBreakdown && !isActive ? 0.35 : 1,
                                        }}
                                        onMouseEnter={() => setHoveredBreakdown(dev)}
                                        onMouseLeave={() => setHoveredBreakdown(null)}
                                        onClick={() =>
                                          setPinnedBreakdown((prev) =>
                                            prev?.deviceId === dev.deviceId ? null : dev,
                                          )
                                        }
                                      />
                                    );
                                  }

                                  let accumulated = 0;
                                  return activeDevs.map((dev) => {
                                    const color = deviceColorMap.get(dev.deviceId) ?? DONUT_COLORS[0];
                                    const pct = (dev.kwh / totalActiveKwh) * 100;
                                    const sliceLen = (pct / 100) * circumference;
                                    const gap = 3;
                                    const dashLength = Math.max(sliceLen - gap, 1);
                                    const strokeDasharray = `${dashLength} ${circumference - dashLength}`;
                                    const strokeDashoffset = -accumulated;
                                    accumulated += sliceLen;

                                    const isActive = activeBreakdown?.deviceId === dev.deviceId;

                                    return (
                                      <circle
                                        key={dev.deviceId}
                                        cx="140"
                                        cy="140"
                                        r="90"
                                        fill="none"
                                        stroke={color}
                                        strokeWidth={isActive ? 34 : 28}
                                        strokeDasharray={strokeDasharray}
                                        strokeDashoffset={strokeDashoffset}
                                        strokeLinecap="butt"
                                        className="transition-all duration-200 cursor-pointer"
                                        style={{
                                          pointerEvents: 'stroke',
                                          opacity: activeBreakdown && !isActive ? 0.35 : 1,
                                        }}
                                        onMouseEnter={() => setHoveredBreakdown(dev)}
                                        onMouseLeave={() => setHoveredBreakdown(null)}
                                        onClick={() =>
                                          setPinnedBreakdown((prev) =>
                                            prev?.deviceId === dev.deviceId ? null : dev,
                                          )
                                        }
                                      />
                                    );
                                  });
                                })()}
                              </svg>

                              {/* Center hole statistics */}
                              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 pointer-events-none tabular-nums">
                                <span className="text-[11px] font-bold text-[#475569] uppercase tracking-wider truncate max-w-[130px]">
                                  {activeBreakdown ? activeBreakdown.deviceName : 'Tổng Tiêu Thụ'}
                                </span>
                                <div className="flex items-baseline gap-1 my-0.5">
                                  <span className="text-2xl font-extrabold text-[#0f172a] tracking-tight">
                                    {formatKwh(activeBreakdown ? activeBreakdown.kwh : (summary?.totalKwh ?? 0))}
                                  </span>
                                  <span className="text-xs font-bold text-[#b45309]">kWh</span>
                                </div>
                                <span className="text-[11px] font-semibold text-[#047857] truncate max-w-[140px]">
                                  {activeBreakdown
                                    ? `${activeBreakdown.percentage}% (${formatVnd(activeBreakdown.costVnd)})`
                                    : (summary?.totalKwh ?? 0) <= 0
                                    ? 'Chưa phát sinh tiêu thụ'
                                    : formatVnd(summary?.estimatedCostVnd)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Device list */}
                          <div className="md:col-span-7 space-y-2">
                            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 energy-scroll-area">
                              {visibleDevs.map((dev) => {
                                const color = deviceColorMap.get(dev.deviceId) ?? DONUT_COLORS[0];
                                const isActive = activeBreakdown?.deviceId === dev.deviceId;

                                return (
                                  <div
                                    key={dev.deviceId}
                                    onMouseEnter={() => setHoveredBreakdown(dev)}
                                    onMouseLeave={() => setHoveredBreakdown(null)}
                                    onClick={() =>
                                      setPinnedBreakdown((prev) =>
                                        prev?.deviceId === dev.deviceId ? null : dev,
                                      )
                                    }
                                    className={`p-3 rounded-2xl border transition-colors cursor-pointer space-y-1.5 ${
                                      isActive
                                        ? 'bg-[#eff6ff]/80 border-[#2563eb] shadow-xs ring-1 ring-[#2563eb]/20'
                                        : 'bg-[#f8fafc] border-[#cbd5e1] hover:bg-white hover:border-[#94a3b8]'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <span
                                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                                          style={{ backgroundColor: color }}
                                        />
                                        <div className="min-w-0">
                                          <span className="text-xs font-bold text-[#0f172a] truncate block leading-snug py-0.5">
                                            {dev.deviceName}
                                          </span>
                                          <span className="text-[11px] text-[#475569] truncate block leading-snug">
                                            {dev.roomName || dev.deviceType}
                                            {dev.totalOnHours ? ` • ${dev.totalOnHours}h` : ''}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="text-right shrink-0 font-mono">
                                        <div className="flex items-baseline justify-end gap-1.5">
                                          <span className="text-xs font-bold text-[#b45309]">
                                            {formatKwh(dev.kwh)} kWh
                                          </span>
                                          <span className="text-[11px] font-semibold text-[#475569]">
                                            ({dev.percentage}%)
                                          </span>
                                        </div>
                                        <span className="text-[11px] font-semibold text-[#047857] block">
                                          {formatVnd(dev.costVnd)}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="w-full h-1.5 bg-[#e2e8f0] rounded-full overflow-hidden">
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
                                  className="w-full py-2 text-[11px] font-semibold text-[#475569] hover:text-[#0f172a] transition-colors cursor-pointer text-center"
                                >
                                  {showZeroDevices
                                    ? 'Ẩn các thiết bị 0 kWh'
                                    : `+ Xem thêm ${zeroCount} thiết bị chưa tiêu thụ điện (0 kWh)`}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
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
