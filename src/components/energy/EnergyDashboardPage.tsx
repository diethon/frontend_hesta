import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AppSidebar, DeviceIcon, HomeIcon, TwinIcon } from '../ui/AppSidebar';
import { getHomeEnergyAnalytics } from '../../services/energyApi';
import type { EnergyAnalyticsResponse, DeviceEnergyBreakdown, EnergyTimeSeriesPoint } from '../../types/energy';
import { getErrorMessage } from '../../utils/errors';
import { Zap, TrendingUp, AlertCircle, DollarSign, Clock, ArrowLeft, RefreshCw, Layers, PieChart } from 'lucide-react';

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

  const [period, setPeriod] = useState<'24H' | '7D' | '30D'>('30D');
  const [data, setData] = useState<EnergyAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hoveredPoint, setHoveredPoint] = useState<EnergyTimeSeriesPoint | null>(null);
  const [hoveredBreakdown, setHoveredBreakdown] = useState<DeviceEnergyBreakdown | null>(null);

  const fetchEnergy = useCallback(async () => {
    if (!homeId) return;
    try {
      setLoading(true);
      setError('');
      const res = await getHomeEnergyAnalytics(homeId, period);
      setData(res);
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể tải dữ liệu phân tích năng lượng'));
    } finally {
      setLoading(false);
    }
  }, [homeId, period]);

  useEffect(() => {
    fetchEnergy();
  }, [fetchEnergy]);

  const summary = data?.summary;
  const timeSeries = data?.timeSeries || [];
  const breakdown = data?.breakdown || [];

  const maxKwh = Math.max(...timeSeries.map((p) => p.kwh), 1.0);

  const formatCurrency = (val?: number) => {
    if (!val) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  const getTierBadgeColor = (tier?: number) => {
    switch (tier) {
      case 1:
      case 2:
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 3:
      case 4:
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 5:
      case 6:
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="app-shell min-h-screen bg-slate-950 text-slate-100">
      <AppSidebar
        activeItem="energy"
        contextLabel="Không gian sống"
        items={[
          {
            id: 'home',
            label: 'Tổng quan',
            icon: <HomeIcon />,
            onClick: () => navigate('/home'),
          },
          {
            id: 'devices',
            label: 'Thiết bị',
            icon: <DeviceIcon />,
            onClick: () => navigate(`/home/${homeId}/devices`),
          },
          {
            id: 'twin',
            label: 'Digital Twin',
            icon: <TwinIcon />,
            onClick: () => navigate(`/home/${homeId}/digital-twin`),
          },
          {
            id: 'energy',
            label: 'Tiêu Thụ Điện',
            icon: <Zap className="h-5 w-5 text-amber-400" />,
            onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
          },
        ]}
      />

      <main id="main-content" className="lg:pl-64">
        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-5">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => navigate(`/home/${homeId}/devices`)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                title="Quay lại danh sách thiết bị"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                  <span className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/30 text-amber-400">
                    <Zap className="h-6 w-6" />
                  </span>
                  Phân Tích Điện Năng & Chi Phí EVN
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Mô phỏng tích phân tiêu thụ thời gian thực & dự toán hóa đơn bậc thang
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setPeriod('24H')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  period === '24H' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                24 Giờ
              </button>
              <button
                type="button"
                onClick={() => setPeriod('7D')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  period === '7D' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                7 Ngày
              </button>
              <button
                type="button"
                onClick={() => setPeriod('30D')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  period === '30D' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Tháng Này
              </button>
              <button
                type="button"
                onClick={fetchEnergy}
                disabled={loading}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                title="Làm mới dữ liệu"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-900/60 text-rose-300 text-sm flex items-center gap-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              {error}
            </div>
          )}

          {/* 4 KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Tổng điện năng */}
            <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Điện Năng Tiêu Thụ</span>
                <span className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                  <Zap className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-white">{summary?.totalKwh ?? 0}</span>
                <span className="text-sm font-semibold text-amber-400">kWh</span>
              </div>
              <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                <span>Hoạt động: {summary?.activeDeviceCount ?? 0}/{summary?.totalDeviceCount ?? 0} thiết bị</span>
              </div>
            </div>

            {/* Card 2: Tiền điện tạm tính */}
            <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tiền Điện Tạm Tính</span>
                <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                  <DollarSign className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-extrabold text-emerald-400">{formatCurrency(summary?.estimatedCostVnd)}</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getTierBadgeColor(summary?.currentTier)}`}>
                  EVN Bậc {summary?.currentTier ?? 1}
                </span>
                <span className="text-xs text-slate-400">Đã gồm VAT 8%</span>
              </div>
            </div>

            {/* Card 3: Dự báo cả tháng */}
            <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Dự Báo Cuối Tháng</span>
                <span className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl">
                  <TrendingUp className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-white">{summary?.projectedMonthKwh ?? 0}</span>
                <span className="text-sm font-semibold text-cyan-400">kWh</span>
              </div>
              <div className="mt-2 text-xs text-slate-400">
                Ước tính: <span className="font-semibold text-slate-200">{formatCurrency(summary?.projectedMonthCostVnd)}</span>
              </div>
            </div>

            {/* Card 4: Cơ cấu Bậc Thang EVN */}
            <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Định Mức EVN</span>
                <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
                  <Layers className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-slate-300 font-semibold mb-1.5">
                  <span>Tiến độ Bậc {summary?.currentTier ?? 1}</span>
                  <span>{summary?.totalKwh ?? 0} kWh</span>
                </div>
                {/* 6-step progress bar */}
                <div className="grid grid-cols-6 gap-1 h-2 bg-slate-800 rounded-full overflow-hidden p-0.5">
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
                          : 'bg-slate-800'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="mt-3 text-[11px] text-slate-400 truncate">
                Biểu giá sinh hoạt QĐ 2941/QĐ-BCT
              </div>
            </div>
          </div>

          {/* Time Series Bar Chart */}
          <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-400" />
                  Biểu Đồ Phụ Tải Tiêu Thụ Điện Năng ({period})
                </h3>
                <p className="text-xs text-slate-400">Tích phân năng lượng theo từng mốc thời gian</p>
              </div>

              {hoveredPoint && (
                <div className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 flex items-center gap-3">
                  <span>Mốc: <b>{hoveredPoint.label}</b></span>
                  <span>Điện: <b className="text-amber-400">{hoveredPoint.kwh} kWh</b></span>
                  <span>Tiền: <b className="text-emerald-400">{formatCurrency(hoveredPoint.costVnd)}</b></span>
                </div>
              )}
            </div>

            {/* SVG Interactive Bar Chart */}
            <div className="h-56 w-full pt-4 flex items-end gap-1 sm:gap-2">
              {timeSeries.map((point, idx) => {
                const heightPercent = Math.max((point.kwh / maxKwh) * 100, 6);
                const isHovered = hoveredPoint?.label === point.label;
                return (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
                    onMouseEnter={() => setHoveredPoint(point)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  >
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full max-w-[28px] rounded-t-md transition-all duration-200 ${
                        isHovered
                          ? 'bg-amber-400 shadow-lg shadow-amber-500/30'
                          : 'bg-gradient-to-t from-amber-600/60 to-amber-500/90 hover:from-amber-500 hover:to-amber-400'
                      }`}
                    />
                    <span className="text-[10px] text-slate-500 mt-2 font-mono truncate max-w-full text-center hidden sm:block">
                      {idx % (period === '24H' ? 3 : period === '7D' ? 1 : 5) === 0 ? point.label : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Donut Chart & Breakdown Legend [PHO-033] */}
          <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800/80 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-amber-400" />
                  Biểu Đồ Tròn Tỷ Lệ Điện Năng Tiêu Thụ
                </h3>
                <p className="text-xs text-slate-400">
                  Phân bổ phần trăm điện năng giữa các thiết bị trong nhà ({period})
                </p>
              </div>
              {hoveredBreakdown && (
                <button
                  type="button"
                  onClick={() => setHoveredBreakdown(null)}
                  className="text-xs text-slate-400 hover:text-white transition px-2 py-1 rounded-md bg-slate-800"
                >
                  Xóa chọn lọc
                </button>
              )}
            </div>

            {breakdown.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">
                Chưa có dữ liệu tiêu thụ điện để vẽ biểu đồ tròn.
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
                        stroke="#1e293b"
                        strokeWidth="32"
                      />
                      {/* Lát cắt của từng thiết bị */}
                      {(() => {
                        const totalKwhCalc = breakdown.reduce((sum, d) => sum + (d.kwh || 0), 0) || 1;
                        const circumference = 2 * Math.PI * 90;
                        let accumulated = 0;

                        return breakdown.map((dev, idx) => {
                          const pct = dev.percentage > 0 ? dev.percentage : (dev.kwh / totalKwhCalc) * 100;
                          const sliceLen = (pct / 100) * circumference;
                          const gap = breakdown.length > 1 ? 2.5 : 0;
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
                                opacity: hoveredBreakdown && !isHovered ? 0.4 : 1,
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
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate max-w-[130px]">
                        {hoveredBreakdown ? hoveredBreakdown.deviceName : 'Tổng Tiêu Thụ'}
                      </span>
                      <div className="flex items-baseline gap-1 my-0.5">
                        <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                          {hoveredBreakdown ? hoveredBreakdown.kwh : (summary?.totalKwh ?? 0)}
                        </span>
                        <span className="text-xs font-bold text-amber-400">kWh</span>
                      </div>
                      <span className="text-xs font-semibold text-emerald-400 truncate max-w-[140px]">
                        {hoveredBreakdown
                          ? `${hoveredBreakdown.percentage}% (${formatCurrency(hoveredBreakdown.costVnd)})`
                          : formatCurrency(summary?.estimatedCostVnd)}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Rê chuột vào các lát cắt để xem chi tiết
                  </p>
                </div>

                {/* Cột phải: Legend Chú Giải Thiết Bị */}
                <div className="lg:col-span-7 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                    {breakdown.map((dev, idx) => {
                      const color = DONUT_COLORS[idx % DONUT_COLORS.length];
                      const isHovered = hoveredBreakdown?.deviceId === dev.deviceId;

                      return (
                        <div
                          key={dev.deviceId}
                          onMouseEnter={() => setHoveredBreakdown(dev)}
                          onMouseLeave={() => setHoveredBreakdown(null)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                            isHovered
                              ? 'bg-slate-800/90 border-slate-600 shadow-md scale-[1.02]'
                              : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                              style={{ backgroundColor: color }}
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">
                                {dev.deviceName}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {dev.roomName || dev.deviceType}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-extrabold text-amber-400 font-mono block">
                              {dev.percentage}%
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {dev.kwh} kWh
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Device Breakdown List */}
          <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="h-5 w-5 text-cyan-400" />
              Cơ Cấu Tiêu Thụ Theo Từng Thiết Bị
            </h3>

            {breakdown.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">Chưa có thiết bị nào tiêu thụ điện trong khoảng thời gian này.</p>
            ) : (
              <div className="space-y-3">
                {breakdown.map((dev: DeviceEnergyBreakdown) => (
                  <div
                    key={dev.deviceId}
                    className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{dev.deviceName}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                          {dev.deviceType}
                        </span>
                        <span className="text-xs text-slate-400">({dev.roomName})</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-mono">
                        <span className="text-slate-400">Công suất: <b>{dev.wattage}W</b></span>
                        <span className="text-slate-400">Bật: <b>{dev.totalOnHours}h</b></span>
                        <span className="text-amber-400 font-bold">{dev.kwh} kWh ({dev.percentage}%)</span>
                        <span className="text-emerald-400 font-bold">{formatCurrency(dev.costVnd)}</span>
                      </div>
                    </div>

                    {/* Progress Bar for Device % */}
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${Math.min(dev.percentage, 100)}%` }}
                        className="h-full bg-gradient-to-r from-amber-500 to-cyan-500 rounded-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
