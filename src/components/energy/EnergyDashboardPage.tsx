import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { HomeSidebar } from '../ui/HomeSidebar';
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
  ArrowLeft,
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
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
      case 3:
      case 4:
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30';
      case 5:
      case 6:
        return 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="app-shell min-h-screen text-text">
      <HomeSidebar activeItem="energy" homeId={homeId} />

      <main id="main-content" className="lg:pl-64">
        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-line pb-5">
            <div className="flex items-center gap-3.5">
              <button
                type="button"
                onClick={() => navigate(`/home/${homeId}/devices`)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-sidebar text-icon transition-colors hover:bg-sidebar-hover hover:text-text cursor-pointer shrink-0"
                title="Quay lại danh sách thiết bị"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text flex items-center gap-2.5">
                  <span className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-500 shrink-0">
                    <Zap className="h-5 w-5 sm:h-6 sm:w-6" />
                  </span>
                  Tiêu Thụ Điện Năng
                </h1>
                <p className="text-xs sm:text-sm text-muted mt-0.5">
                  Theo dõi mức dùng điện thời gian thực &amp; dự tính hóa đơn gia đình
                </p>
              </div>
            </div>

            {/* Điều hướng Tab & Bộ lọc */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Tab Selector */}
              <div className="flex items-center bg-sidebar p-1 rounded-xl border border-line">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'overview'
                      ? 'bg-primary text-white font-bold shadow-xs'
                      : 'text-muted hover:text-text'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Tổng Quan &amp; Hóa Đơn</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('protection')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'protection'
                      ? 'bg-primary text-white font-bold shadow-xs'
                      : 'text-muted hover:text-text'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Bảo Vệ Quá Tải</span>
                </button>
              </div>

              {/* Bộ lọc chu kỳ (chỉ hiển thị trong tab Tổng Quan) */}
              {activeTab === 'overview' && (
                <div className="flex items-center gap-1 bg-sidebar p-1 rounded-xl border border-line">
                  <button
                    type="button"
                    onClick={() => setPeriod('24H')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      period === '24H'
                        ? 'bg-amber-500 text-white font-bold shadow-xs'
                        : 'text-muted hover:text-text'
                    }`}
                  >
                    24 Giờ
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriod('7D')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      period === '7D'
                        ? 'bg-amber-500 text-white font-bold shadow-xs'
                        : 'text-muted hover:text-text'
                    }`}
                  >
                    7 Ngày
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriod('30D')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      period === '30D'
                        ? 'bg-amber-500 text-white font-bold shadow-xs'
                        : 'text-muted hover:text-text'
                    }`}
                  >
                    Tháng Này
                  </button>
                  <button
                    type="button"
                    onClick={() => void fetchEnergy()}
                    disabled={loading}
                    className="p-1 text-muted hover:text-text rounded-md hover:bg-sidebar-hover transition cursor-pointer"
                    title="Làm mới dữ liệu"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-sm flex items-center gap-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              {error}
            </div>
          )}

          {/* TAB 1: TỔNG QUAN & HÓA ĐƠN */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* 4 KPI Summary Cards */}
              {loading && !data ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="surface-card p-5 rounded-2xl h-36 bg-sidebar/50 border border-line flex flex-col justify-between">
                      <div className="h-3 w-24 bg-line rounded" />
                      <div className="h-8 w-32 bg-line rounded" />
                      <div className="h-3 w-40 bg-line rounded" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Tổng điện năng */}
                  <div className="surface-card p-5 rounded-2xl relative overflow-hidden shadow-soft border border-line">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted">Điện Năng Tiêu Thụ</span>
                      <span className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
                        <Zap className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-text">{summary?.totalKwh ?? 0}</span>
                      <span className="text-sm font-semibold text-amber-500">kWh</span>
                    </div>
                    <div className="mt-2 text-xs text-muted flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span className="truncate">Hoạt động: {summary?.activeDeviceCount ?? 0}/{summary?.totalDeviceCount ?? 0} thiết bị</span>
                      </div>
                      {summary?.comparisonLastPeriodPercent !== undefined && summary.comparisonLastPeriodPercent !== 0 && (
                        <span
                          className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                            summary.comparisonLastPeriodPercent > 0
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          }`}
                          title={`So sánh với chu kỳ trước`}
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
                  <div className="surface-card p-5 rounded-2xl relative overflow-hidden shadow-soft border border-line">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted">Tiền Điện Tạm Tính</span>
                      <span className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl">
                        <DollarSign className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="mt-3">
                      <span className="text-2xl font-extrabold text-emerald-600">{formatCurrency(summary?.estimatedCostVnd)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getTierBadgeColor(summary?.currentTier)}`}>
                        Bậc {summary?.currentTier ?? 1}
                      </span>
                      <span className="text-xs text-muted">Đã gồm VAT 8%</span>
                    </div>
                  </div>

                  {/* Card 3: Dự báo cả tháng */}
                  <div className="surface-card p-5 rounded-2xl relative overflow-hidden shadow-soft border border-line">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted">Dự Báo Cuối Tháng</span>
                      <span className="p-2 bg-primary/10 text-primary rounded-xl">
                        <TrendingUp className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-2xl font-extrabold text-text">{summary?.projectedMonthKwh ?? 0}</span>
                      <span className="text-sm font-semibold text-primary">kWh</span>
                    </div>
                    <div className="mt-2 text-xs text-muted">
                      Ước tính: <span className="font-semibold text-text">{formatCurrency(summary?.projectedMonthCostVnd)}</span>
                    </div>
                  </div>

                  {/* Card 4: Cơ cấu Bậc Thang EVN */}
                  <div className="surface-card p-5 rounded-2xl relative overflow-hidden shadow-soft border border-line">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted">Bậc Thang EVN</span>
                      <span className="p-2 bg-indigo-500/10 text-indigo-600 rounded-xl">
                        <Layers className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-text font-semibold mb-1.5">
                        <span>Tiến độ Bậc {summary?.currentTier ?? 1}</span>
                        <span>{summary?.totalKwh ?? 0} kWh</span>
                      </div>
                      {/* 6-step progress bar */}
                      <div className="grid grid-cols-6 gap-1 h-2 bg-off-soft rounded-full overflow-hidden p-0.5 border border-line">
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
                                : 'bg-off-soft'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="mt-3 text-[11px] text-muted truncate">
                      Biểu giá điện sinh hoạt 6 bậc
                    </div>
                  </div>
                </div>
              )}

              {/* Time Series Bar Chart */}
              <div className="surface-card p-5 sm:p-6 rounded-2xl space-y-4 border border-line shadow-soft">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-text flex items-center gap-2">
                      <Clock className="h-5 w-5 text-amber-500" />
                      Mức Tiêu Thụ Theo Thời Gian ({period})
                    </h3>
                    <p className="text-xs text-muted">Điện năng tiêu thụ theo từng mốc thời gian</p>
                  </div>

                  {hoveredPoint && (
                    <div className="text-xs px-3 py-1.5 rounded-lg bg-surface border border-line text-text flex items-center gap-3 shadow-xs">
                      <span>Mốc: <b>{hoveredPoint.label}</b></span>
                      <span>Điện: <b className="text-amber-500">{hoveredPoint.kwh} kWh</b></span>
                      <span>Tiền: <b className="text-emerald-600">{formatCurrency(hoveredPoint.costVnd)}</b></span>
                    </div>
                  )}
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
                              isHovered ? 'bg-amber-400 h-1.5' : 'bg-line/60'
                            }`}
                            title={`${point.label}: 0 kWh`}
                          />
                        ) : (
                          <div
                            style={{ height: `${heightPercent}%` }}
                            className={`w-full max-w-[28px] rounded-t-md transition-all duration-200 ${
                              isHovered
                                ? 'bg-amber-400 shadow-lg shadow-amber-500/30'
                                : 'bg-gradient-to-t from-amber-600/70 to-amber-500 hover:from-amber-500 hover:to-amber-400'
                            }`}
                          />
                        )}
                        <span className="text-[10px] text-muted mt-2 font-mono truncate max-w-full text-center">
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
              <div className="surface-card p-5 sm:p-6 rounded-2xl space-y-6 border border-line shadow-soft">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-line pb-4">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-text flex items-center gap-2">
                      <PieChart className="h-5 w-5 text-amber-500" />
                      Cơ Cấu Tiêu Thụ Theo Thiết Bị
                    </h3>
                    <p className="text-xs text-muted">
                      Tỷ lệ phần trăm và chi phí điện của các thiết bị trong nhà ({period})
                    </p>
                  </div>
                  {hoveredBreakdown && (
                    <button
                      type="button"
                      onClick={() => setHoveredBreakdown(null)}
                      className="text-xs text-muted hover:text-text transition px-2.5 py-1 rounded-md bg-sidebar border border-line cursor-pointer"
                    >
                      Bỏ chọn lọc
                    </button>
                  )}
                </div>

                {sortedBreakdown.length === 0 ? (
                  <p className="text-sm text-muted py-8 text-center">
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
                            fill="transparent"
                            stroke="currentColor"
                            className="text-line"
                            strokeWidth="32"
                          />
                          {/* Lát cắt của từng thiết bị */}
                          {(() => {
                            const totalKwhCalc = sortedBreakdown.reduce((sum, d) => sum + (d.kwh || 0), 0);
                            const isAllZero = totalKwhCalc <= 0.001;
                            const circumference = 2 * Math.PI * 90;
                            let accumulated = 0;

                            if (isAllZero) {
                              return (
                                <circle
                                  cx="140"
                                  cy="140"
                                  r="90"
                                  fill="transparent"
                                  stroke="currentColor"
                                  className="text-line/60"
                                  strokeWidth="24"
                                  strokeDasharray="6 8"
                                />
                              );
                            }

                            return sortedBreakdown.map((dev, idx) => {
                              const pct = dev.percentage > 0 ? dev.percentage : (dev.kwh / (totalKwhCalc || 1)) * 100;
                              const sliceLen = (pct / 100) * circumference;
                              const gap = sortedBreakdown.length > 1 ? 2.5 : 0;
                              const dashLength = Math.max(sliceLen - gap, 0.5);
                              const strokeDasharray = `${dashLength} ${circumference - dashLength}`;
                              const strokeDashoffset = -accumulated;
                              accumulated += sliceLen;

                              const color = DONUT_COLORS[idx % DONUT_COLORS.length];
                              const isHovered = hoveredBreakdown?.deviceId === dev.deviceId;

                              return (
                                <circle
                                  key={dev.deviceId}
                                  cx="140"
                                  cy="140"
                                  r="90"
                                  fill="transparent"
                                  stroke={color}
                                  strokeWidth={isHovered ? 40 : 32}
                                  strokeDasharray={strokeDasharray}
                                  strokeDashoffset={strokeDashoffset}
                                  strokeLinecap="round"
                                  className="transition-all duration-300 cursor-pointer"
                                  style={{
                                    opacity: hoveredBreakdown && !isHovered ? 0.35 : 1,
                                    filter: isHovered ? `drop-shadow(0 0 8px ${color})` : undefined,
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
                          <span className="text-[11px] font-semibold text-muted uppercase tracking-wider truncate max-w-[130px]">
                            {hoveredBreakdown ? hoveredBreakdown.deviceName : 'Tổng Tiêu Thụ'}
                          </span>
                          <div className="flex items-baseline gap-1 my-0.5">
                            <span className="text-2xl sm:text-3xl font-extrabold text-text tracking-tight">
                              {hoveredBreakdown ? hoveredBreakdown.kwh : (summary?.totalKwh ?? 0)}
                            </span>
                            <span className="text-xs font-bold text-amber-500">kWh</span>
                          </div>
                          <span className="text-xs font-semibold text-emerald-600 truncate max-w-[140px]">
                            {hoveredBreakdown
                              ? `${hoveredBreakdown.percentage}% (${formatCurrency(hoveredBreakdown.costVnd)})`
                              : (summary?.totalKwh ?? 0) <= 0
                              ? 'Chưa phát sinh tiêu thụ'
                              : formatCurrency(summary?.estimatedCostVnd)}
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted mt-2">
                        Rê chuột vào vòng tròn hoặc danh sách bên cạnh
                      </p>
                    </div>

                    {/* Cột phải: Danh sách chi tiết thiết bị & mức tiêu thụ */}
                    <div className="lg:col-span-7 space-y-2">
                      <div className="flex items-center justify-between pb-1 text-xs text-muted font-medium px-1">
                        <span>Thiết bị &amp; Công suất</span>
                        <span>Điện năng &amp; Chi phí</span>
                      </div>

                      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                        {sortedBreakdown.map((dev, idx) => {
                          const color = DONUT_COLORS[idx % DONUT_COLORS.length];
                          const isHovered = hoveredBreakdown?.deviceId === dev.deviceId;

                          return (
                            <div
                              key={dev.deviceId}
                              onMouseEnter={() => setHoveredBreakdown(dev)}
                              onMouseLeave={() => setHoveredBreakdown(null)}
                              className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2 ${
                                isHovered
                                  ? 'bg-sidebar-hover border-primary/50 shadow-md scale-[1.01]'
                                  : 'bg-surface border-line hover:bg-sidebar-hover/60'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span
                                    className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                                    style={{ backgroundColor: color }}
                                  />
                                  <div className="min-w-0">
                                    <span className="text-xs font-bold text-text truncate block">
                                      {dev.deviceName}
                                    </span>
                                    <span className="text-[11px] text-muted truncate block">
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
                                    <span className="text-[11px] font-bold text-muted font-mono">
                                      ({dev.percentage}%)
                                    </span>
                                  </div>
                                  <span className="text-[11px] font-semibold text-emerald-600 block">
                                    {formatCurrency(dev.costVnd)}
                                  </span>
                                </div>
                              </div>

                              {/* Thanh tỉ lệ phần trăm trực quan */}
                              <div className="w-full h-1.5 bg-off-soft rounded-full overflow-hidden">
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
        </div>
      </main>
    </div>
  );
};
