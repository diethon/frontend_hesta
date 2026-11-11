import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useAppSelector } from '../../store/hooks';
import { DashboardNavRail } from '../home/DashboardNavRail';
import { DashboardBottomNav } from '../home/DashboardBottomNav';
import { VoiceAssistantButton } from '../ui/VoiceAssistant';
import { NotificationBell } from '../notification/NotificationBell';
import { getHomeEnergyAnalytics } from '../../services/energyApi';
import type { EnergyAnalyticsResponse, DeviceEnergyBreakdown, EnergyTimeSeriesPoint } from '../../types/energy';
import { getErrorMessage } from '../../utils/errors';
import {
  Zap,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  DollarSign,
  Clock,
  RefreshCw,
  Layers,
  PieChart,
  BarChart3,
  ShieldCheck,
} from 'lucide-react';
import { DemandResponseCard } from './DemandResponseCard';

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
  const [data, setData] = useState<EnergyAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hoveredPoint, setHoveredPoint] = useState<EnergyTimeSeriesPoint | null>(null);
  const [hoveredBreakdown, setHoveredBreakdown] = useState<DeviceEnergyBreakdown | null>(null);

  const fetchEnergy = useCallback(async (isCancelled?: unknown) => {
    if (!homeId) return;
    try {
      setLoading(true);
      setError('');
      const res = await getHomeEnergyAnalytics(homeId, period);
      if (!(typeof isCancelled === 'function' && isCancelled())) {
        setData(res);
      }
    } catch (err) {
      if (!(typeof isCancelled === 'function' && isCancelled())) {
        setError(getErrorMessage(err, 'Không thể tải dữ liệu phân tích năng lượng'));
      }
    } finally {
      if (!(typeof isCancelled === 'function' && isCancelled())) {
        setLoading(false);
      }
    }
  }, [homeId, period]);

  useEffect(() => {
    let ignore = false;
    void fetchEnergy(() => ignore);
    return () => {
      ignore = true;
    };
  }, [fetchEnergy]);

  const summary = data?.summary;
  const timeSeries = data?.timeSeries || [];
  const breakdown = data?.breakdown || [];
  const sortedBreakdown = [...breakdown].sort((a, b) => (b.kwh || 0) - (a.kwh || 0));

  const maxKwh = Math.max(...timeSeries.map((p) => p.kwh), 1.0);

  const formatCurrency = (val?: number) => {
    if (!val) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  const getTierBadgeColor = (tier?: number) => {
    switch (tier) {
      case 1:
      case 2:
        return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      case 3:
      case 4:
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 5:
      case 6:
        return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30';
    }
  };

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
        {/* Topbar matching Figma v2/v3 & Đức's redesign */}
        <header className="topbar scenes-topbar">
          <div>
            <span className="eyebrow">
              {summary
                ? `${summary.totalKwh} KWH TIÊU THỤ · ${summary.activeDeviceCount}/${summary.totalDeviceCount} THIẾT BỊ HOẠT ĐỘNG`
                : 'THEO DÕI THỜI GIAN THỰC'}
            </span>
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
                    onClick={() => setPeriod(p)}
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
              onClick={() => void fetchEnergy()}
              disabled={loading}
              className="scene-ghost flex items-center gap-1.5"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Làm mới</span>
            </button>

            <button
              type="button"
              className="scene-ghost flex items-center gap-1.5"
              onClick={() => navigate(homeId ? `/home/${homeId}/devices` : '/home')}
            >
              Thiết bị
            </button>
          </div>
        </div>

        {/* Summary Strip (Neutral StatChips) */}
        <div className="scene-summary flex-wrap">
          <span className="stat">{summary?.totalKwh ?? 0} kWh tiêu thụ</span>
          <span className="stat">{formatCurrency(summary?.estimatedCostVnd)} tạm tính</span>
          <span className="stat">Bậc {summary?.currentTier ?? 1} EVN</span>
          <span className="stat">
            Dự báo {summary?.projectedMonthKwh ?? 0} kWh ({formatCurrency(summary?.projectedMonthCostVnd)})
          </span>
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
            {/* 4 KPI Summary Cards with Pastel Glassmorphism */}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Tổng điện năng */}
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
                      {summary?.totalKwh ?? 0}
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

                {/* Card 2: Tiền điện tạm tính */}
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
                      {formatCurrency(summary?.estimatedCostVnd)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getTierBadgeColor(
                        summary?.currentTier
                      )}`}
                    >
                      Bậc {summary?.currentTier ?? 1}
                    </span>
                    <span className="text-xs text-[var(--secondary)]">Đã gồm VAT 8%</span>
                  </div>
                </div>

                {/* Card 3: Dự báo cả tháng */}
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
                      {summary?.projectedMonthKwh ?? 0}
                    </span>
                    <span className="text-sm font-bold text-[var(--accent)]">kWh</span>
                  </div>
                  <div className="mt-2 text-xs text-[var(--secondary)]">
                    Ước tính:{' '}
                    <span className="font-semibold text-[var(--text)]">
                      {formatCurrency(summary?.projectedMonthCostVnd)}
                    </span>
                  </div>
                </div>

                {/* Card 4: Cơ cấu Bậc Thang EVN */}
                <div className="glass-card glass-g2 p-5 rounded-2xl relative overflow-hidden shadow-xs border border-[var(--border)] transition-all duration-200 hover:-translate-y-0.5">
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--secondary)]">
                      Bậc Thang EVN
                    </span>
                    <span className="p-2 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-500/20">
                      <Layers className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-[var(--text)] font-semibold mb-1.5">
                      <span>Tiến độ Bậc {summary?.currentTier ?? 1}</span>
                      <span>{summary?.totalKwh ?? 0} kWh</span>
                    </div>
                    {/* 6-step progress bar */}
                    <div className="grid grid-cols-6 gap-1 h-2 bg-[var(--muted)] rounded-full overflow-hidden p-0.5 border border-[var(--border)]">
                      {[1, 2, 3, 4, 5, 6].map((tier) => (
                        <div
                          key={tier}
                          className={`h-full rounded-sm transition-all ${
                            (summary?.currentTier ?? 1) >= tier
                              ? tier <= 2
                                ? 'bg-emerald-500'
                                : tier <= 4
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                              : 'bg-transparent'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 text-[11px] text-[var(--secondary)] truncate">
                    Biểu giá điện sinh hoạt 6 bậc
                  </div>
                </div>
              </div>
            )}

            {/* Time Series Bar Chart */}
            <div className="glass-card glass-g2 p-5 sm:p-6 rounded-3xl border border-[var(--border)] shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[var(--border)]/60 pb-3">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[var(--text)] flex items-center gap-2">
                    <Clock className="h-5 w-5 text-amber-500" />
                    Mức Tiêu Thụ Theo Thời Gian ({period})
                  </h3>
                  <p className="text-xs text-[var(--secondary)] mt-0.5">
                    Điện năng tiêu thụ theo từng mốc thời gian
                  </p>
                </div>

                <div className="min-h-[36px] flex items-center">
                  {hoveredPoint ? (
                    <div className="text-xs px-3 py-1.5 rounded-xl bg-[var(--solid)] border border-[var(--border)] text-[var(--text)] flex items-center gap-3 shadow-xs">
                      <span>
                        Mốc: <b>{hoveredPoint.label}</b>
                      </span>
                      <span>
                        Điện: <b className="text-amber-500">{hoveredPoint.kwh} kWh</b>
                      </span>
                      <span>
                        Tiền: <b className="text-emerald-600 dark:text-emerald-400">{formatCurrency(hoveredPoint.costVnd)}</b>
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-[var(--secondary)] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-500/70" />
                      <span>Rê chuột vào cột để xem chi tiết mốc</span>
                    </div>
                  )}
                </div>
              </div>

              {/* SVG Interactive Bar Chart */}
              <div className="h-56 w-full pt-4 flex items-end gap-1 sm:gap-2">
                {timeSeries.map((point, idx) => {
                  const isZero = point.kwh <= 0.001;
                  const heightPercent = isZero ? 0 : Math.max((point.kwh / maxKwh) * 100, 6);
                  const isHovered = hoveredPoint?.label === point.label;
                  return (
                    <div
                      key={idx}
                      className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
                      onMouseEnter={() => setHoveredPoint(point)}
                      onMouseLeave={() => setHoveredPoint(null)}
                    >
                      {isZero ? (
                        <div
                          className={`w-full max-w-[28px] h-1 rounded-full transition-all duration-200 ${
                            isHovered ? 'bg-amber-400 h-1.5' : 'bg-[var(--border)]'
                          }`}
                          title={`${point.label}: 0 kWh`}
                        />
                      ) : (
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full max-w-[28px] rounded-t-lg transition-all duration-200 ${
                            isHovered
                              ? 'bg-amber-400 shadow-md shadow-amber-500/30'
                              : 'bg-gradient-to-t from-amber-600/70 to-amber-500 hover:from-amber-500 hover:to-amber-400'
                          }`}
                        />
                      )}
                      <span className="text-[10px] text-[var(--secondary)] mt-2 font-mono truncate max-w-full text-center">
                        <span className="hidden sm:inline">
                          {idx % (period === '24H' ? 3 : period === '7D' ? 1 : 5) === 0 ? point.label : ''}
                        </span>
                        <span className="inline sm:hidden">
                          {idx % (period === '24H' ? 6 : period === '7D' ? 2 : 10) === 0 ? point.label : ''}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* HỢP NHẤT: Biểu Đồ Tròn & Chi Tiết Thiết Bị Tiêu Thụ */}
            <div className="glass-card glass-g2 p-5 sm:p-6 rounded-3xl border border-[var(--border)] shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[var(--border)]/60 pb-3">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[var(--text)] flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-amber-500" />
                    Cơ Cấu Tiêu Thụ Theo Thiết Bị
                  </h3>
                  <p className="text-xs text-[var(--secondary)] mt-0.5">
                    Tỷ lệ phần trăm và chi phí điện của các thiết bị trong nhà ({period})
                  </p>
                </div>
                {hoveredBreakdown && (
                  <button
                    type="button"
                    onClick={() => setHoveredBreakdown(null)}
                    className="scene-ghost text-xs px-2.5 py-1"
                  >
                    Bỏ chọn lọc
                  </button>
                )}
              </div>

              {sortedBreakdown.length === 0 ? (
                <p className="text-sm text-[var(--secondary)] py-8 text-center">
                  Chưa có dữ liệu tiêu thụ điện trong khoảng thời gian này.
                </p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                  {/* Cột trái: SVG Donut Chart */}
                  <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
                    <div className="relative w-64 h-64 sm:w-72 sm:h-72">
                      <svg viewBox="0 0 280 280" className="w-full h-full transform -rotate-90">
                        {/* Vòng nền */}
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
                        {/* Lát cắt của từng thiết bị */}
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

                      {/* Tâm rỗng hiển thị thông số */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 pointer-events-none">
                        <span className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider truncate max-w-[140px]">
                          {hoveredBreakdown ? hoveredBreakdown.deviceName : 'Tổng Tiêu Thụ'}
                        </span>
                        <div className="flex items-baseline gap-1 my-0.5">
                          <span className="text-2xl sm:text-3xl font-extrabold text-[var(--text)] tracking-tight">
                            {hoveredBreakdown ? hoveredBreakdown.kwh : (summary?.totalKwh ?? 0)}
                          </span>
                          <span className="text-xs font-bold text-amber-500">kWh</span>
                        </div>
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 truncate max-w-[150px]">
                          {hoveredBreakdown
                            ? `${hoveredBreakdown.percentage}% (${formatCurrency(hoveredBreakdown.costVnd)})`
                            : (summary?.totalKwh ?? 0) <= 0
                            ? 'Chưa phát sinh tiêu thụ'
                            : formatCurrency(summary?.estimatedCostVnd)}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-[var(--secondary)] mt-2">
                      Rê chuột vào vòng tròn hoặc danh sách bên cạnh
                    </p>
                  </div>

                  {/* Cột phải: Danh sách chi tiết thiết bị & mức tiêu thụ */}
                  <div className="lg:col-span-7 space-y-2">
                    <div className="flex items-center justify-between pb-1 text-xs text-[var(--secondary)] font-semibold px-1">
                      <span>Thiết bị &amp; Công suất</span>
                      <span>Điện năng &amp; Chi phí</span>
                    </div>

                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-2">
                      {sortedBreakdown.map((dev, idx) => {
                        const color = DONUT_COLORS[idx % DONUT_COLORS.length];
                        const isHovered = hoveredBreakdown?.deviceId === dev.deviceId;

                        return (
                          <div
                            key={dev.deviceId}
                            onMouseEnter={() => setHoveredBreakdown(dev)}
                            onMouseLeave={() => setHoveredBreakdown(null)}
                            className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                              isHovered
                                ? 'bg-[var(--solid)] border-[var(--accent)] shadow-md ring-1 ring-[var(--accent)]/30'
                                : 'bg-[var(--g1)] border-[var(--border)] hover:bg-[var(--solid)]/80'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                  className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                                  style={{ backgroundColor: color }}
                                />
                                <div className="min-w-0">
                                  <span className="text-xs font-bold text-[var(--text)] truncate block">
                                    {dev.deviceName}
                                  </span>
                                  <span className="text-[11px] text-[var(--secondary)] truncate block">
                                    {dev.roomName || dev.deviceType}
                                    {dev.wattage ? ` • ${dev.wattage}W` : ''}
                                    {dev.totalOnHours ? ` • ${dev.totalOnHours}h` : ''}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="flex items-baseline justify-end gap-1.5">
                                  <span className="text-xs font-extrabold text-amber-500 font-mono">
                                    {dev.kwh} kWh
                                  </span>
                                  <span className="text-[11px] font-bold text-[var(--secondary)] font-mono">
                                    ({dev.percentage}%)
                                  </span>
                                </div>
                                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 block">
                                  {formatCurrency(dev.costVnd)}
                                </span>
                              </div>
                            </div>

                            {/* Thanh tỉ lệ phần trăm trực quan */}
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
                    </div>
                  </div>
                </div>
              )}
            </div>
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
