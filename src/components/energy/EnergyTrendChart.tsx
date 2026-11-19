import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { EnergyTimeSeriesPoint } from '../../types/energy';
import { formatCurrencyVnd, formatKwh } from './energyUtils';
import { TrendingDown, TrendingUp, Zap, Clock } from 'lucide-react';

interface EnergyTrendChartProps {
  timeSeries: EnergyTimeSeriesPoint[];
  period: '24H' | '7D' | '30D';
  comparisonPercent?: number;
  isLoading?: boolean;
}

interface ChartMetrics {
  maxKwh: number;
  avgKwh: number;
  peakPoint: EnergyTimeSeriesPoint | null;
  peakIndex: number;
  totalKwh: number;
}

// Compute smooth Catmull-Rom spline converted to cubic Bezier
function buildSmoothPath(points: { x: number; y: number }[], baselineY = Infinity): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    // Clamp control points so the curve never dips below the 0 kWh baseline.
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = Math.min(baselineY, p1.y + (p2.y - p0.y) / 6);
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = Math.min(baselineY, p2.y - (p3.y - p1.y) / 6);

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  return d;
}

export const EnergyTrendChart: React.FC<EnergyTrendChartProps> = ({
  timeSeries,
  period,
  comparisonPercent,
  isLoading = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(680);
  const [containerHeight, setContainerHeight] = useState<number>(280);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const gradientId = useId();

  // Measure container width for pixel-perfect SVG rendering
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => {
      const w = el.clientWidth;
      if (w > 100) setContainerWidth(w);
      const h = el.clientHeight;
      if (h > 120) setContainerHeight(h);
    };

    updateWidth();
    const ro = new ResizeObserver(() => updateWidth());
    ro.observe(el);

    return () => ro.disconnect();
  }, []);

  // Height follows the card (stretched to match the EVN ladder), with a sane minimum.
  const chartHeight = Math.max(260, containerHeight);
  const padding = { top: 35, right: 24, bottom: 40, left: 48 };

  const plotWidth = Math.max(100, containerWidth - padding.left - padding.right);
  const plotHeight = Math.max(60, chartHeight - padding.top - padding.bottom);

  // Peak and average calculations
  const { maxKwh, avgKwh, peakPoint, peakIndex, totalKwh } = useMemo<ChartMetrics>(() => {
    if (!timeSeries || timeSeries.length === 0) {
      return { maxKwh: 1, avgKwh: 0, peakPoint: null, peakIndex: -1, totalKwh: 0 };
    }

    let max = 0;
    let sum = 0;
    let peak: EnergyTimeSeriesPoint | null = null;
    let pIdx = -1;

    timeSeries.forEach((p, idx) => {
      sum += p.kwh;
      if (p.kwh > max) {
        max = p.kwh;
        peak = p;
        pIdx = idx;
      }
    });

    const avg = sum / timeSeries.length;
    // Buffer the max so the line does not touch top edge
    const effectiveMax = Math.max(max * 1.18, 0.5);

    return {
      maxKwh: effectiveMax,
      avgKwh: avg,
      peakPoint: peak,
      peakIndex: pIdx,
      totalKwh: sum,
    };
  }, [timeSeries]);

  // Map data points to SVG coordinates
  const svgPoints = useMemo(() => {
    if (!timeSeries || timeSeries.length === 0) return [];
    const count = timeSeries.length;

    return timeSeries.map((p, idx) => {
      const x = count === 1
        ? padding.left + plotWidth / 2
        : padding.left + (idx / (count - 1)) * plotWidth;
      const y = padding.top + plotHeight - (Math.max(0, p.kwh) / maxKwh) * plotHeight;
      return { x, y, data: p, index: idx };
    });
  }, [timeSeries, maxKwh, plotWidth, plotHeight, padding.left, padding.top]);

  // Smooth line path and area path
  const linePath = useMemo(
    () => buildSmoothPath(svgPoints, padding.top + plotHeight),
    [svgPoints, padding.top, plotHeight]
  );

  const areaPath = useMemo(() => {
    if (svgPoints.length === 0) return '';
    const bottomY = padding.top + plotHeight;
    const firstX = svgPoints[0].x;
    const lastX = svgPoints[svgPoints.length - 1].x;
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [linePath, svgPoints, padding.top, plotHeight]);

  // Average line position
  const avgY = padding.top + plotHeight - (avgKwh / maxKwh) * plotHeight;

  // Gridlines: 4 ticks
  const gridTicks = useMemo(() => {
    return [0, maxKwh * 0.333, maxKwh * 0.666, maxKwh];
  }, [maxKwh]);

  // X label display intervals based on period and width
  const isLabelVisible = (idx: number, count: number) => {
    if (count <= 7) return true;
    const isMobile = containerWidth < 500;
    if (period === '24H') {
      const step = isMobile ? 6 : 3;
      return idx === count - 1 || (idx % step === 0 && count - 1 - idx >= Math.ceil(step / 2));
    }
    if (period === '30D') {
      const step = isMobile ? 7 : 4;
      return idx === count - 1 || (idx % step === 0 && count - 1 - idx >= Math.ceil(step / 2));
    }
    return idx % 2 === 0;
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (svgPoints.length === 0) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setActiveIndex((prev) => (prev === null || prev >= svgPoints.length - 1 ? 0 : prev + 1));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setActiveIndex((prev) => (prev === null || prev <= 0 ? svgPoints.length - 1 : prev - 1));
    } else if (e.key === 'Escape') {
      setActiveIndex(null);
    }
  };

  // Touch / Mouse hover handling
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (svgPoints.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;

    let closestIdx = 0;
    let minDistance = Number.POSITIVE_INFINITY;

    svgPoints.forEach((p, idx) => {
      const dist = Math.abs(p.x - cursorX);
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = idx;
      }
    });

    setActiveIndex(closestIdx);
  };

  const handlePointerLeave = () => {
    setActiveIndex(null);
  };

  const activePoint = activeIndex !== null && svgPoints[activeIndex] ? svgPoints[activeIndex] : null;

  const periodTitle = period === '24H'
    ? 'Biểu Đồ Tiêu Thụ 24 Giờ'
    : period === '7D'
    ? 'Biểu Đồ Tiêu Thụ 7 Ngày'
    : 'Biểu Đồ Tiêu Thụ Tháng Này';

  const ariaSummary = `Biểu đồ tiêu thụ điện ${periodTitle}, tổng ${formatKwh(totalKwh)} kWh, trung bình ${formatKwh(avgKwh)} kWh mỗi mốc, đỉnh ${peakPoint ? `${formatKwh(peakPoint.kwh)} kWh lúc ${peakPoint.label}` : 'không có'}`;

  const isAllZero = totalKwh <= 0.001;

  return (
    <div
      className="glass-card glass-g2 p-5 sm:p-6 rounded-3xl border border-[var(--border)] shadow-xs flex flex-col flex-1 gap-4 energy-chart-container relative transition-all"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="region"
      aria-label={ariaSummary}
    >
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[var(--border)]/60 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/15 text-amber-500">
              <Clock className="h-4 w-4" />
            </span>
            <h3 className="text-base sm:text-lg font-bold text-[var(--text)] tracking-tight">
              {periodTitle}
            </h3>
            {comparisonPercent !== undefined && comparisonPercent !== 0 && (
              <span
                className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                  comparisonPercent > 0
                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                    : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                }`}
                title="So với kỳ trước"
              >
                {comparisonPercent > 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                <span>{comparisonPercent > 0 ? `+${comparisonPercent}%` : `${comparisonPercent}%`}</span>
              </span>
            )}
          </div>
        </div>

        {/* Live Active Inspection Chip */}
        <div className="min-h-[34px] flex items-center">
          {activePoint && (
            <div className="text-xs px-3 py-1.5 rounded-xl bg-[var(--solid)] border border-amber-500/40 text-[var(--text)] flex items-center gap-3 shadow-sm animate-in fade-in duration-150 tabular-nums">
              <span className="font-semibold text-[var(--secondary)]">
                {activePoint.data.label}
              </span>
              <span className="flex items-center gap-1 font-bold text-amber-500">
                <Zap className="w-3 h-3" />
                {formatKwh(activePoint.data.kwh)} kWh
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrencyVnd(activePoint.data.costVnd)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* SVG Chart Surface */}
      <div ref={containerRef} className="relative w-full flex-1 min-h-[260px] overflow-hidden select-none">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center animate-pulse">
            <div className="text-xs text-[var(--secondary)]">Đang tải biểu đồ năng lượng...</div>
          </div>
        ) : isAllZero ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
            <Zap className="w-8 h-8 text-[var(--tertiary)] stroke-[1.5]" />
            <p className="text-sm font-semibold text-[var(--secondary)]">
              Chưa có dữ liệu tiêu thụ điện trong chu kỳ này
            </p>
            <p className="text-xs text-[var(--tertiary)] max-w-xs">
              Các thiết bị trong nhà chưa ghi nhận năng lượng phát sinh trong khoảng thời gian đã chọn.
            </p>
          </div>
        ) : (
          <svg
            className="w-full h-full cursor-crosshair touch-none"
            viewBox={`0 0 ${containerWidth} ${chartHeight}`}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            role="img"
            aria-label={ariaSummary}
          >
            <defs>
              <linearGradient id={`amberArea-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.38" />
                <stop offset="70%" stopColor="#f59e0b" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.00" />
              </linearGradient>

              <filter id={`glow-${gradientId}`} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Horizontal Gridlines & Y-Axis Labels */}
            {gridTicks.map((val, i) => {
              const y = padding.top + plotHeight - (val / maxKwh) * plotHeight;
              return (
                <g key={i}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={containerWidth - padding.right}
                    y2={y}
                    stroke="var(--border)"
                    strokeWidth="1"
                    strokeDasharray={i === 0 ? 'none' : '3 3'}
                    opacity={i === 0 ? 0.9 : 0.55}
                  />
                  <text
                    x={padding.left - 8}
                    y={y + 3}
                    textAnchor="end"
                    className="text-[10px] font-mono fill-[var(--tertiary)]"
                  >
                    {formatKwh(val, val >= 10 ? 0 : 1)}
                  </text>
                </g>
              );
            })}

            {/* Average Horizontal Line */}
            {avgKwh > 0 && (
              <g>
                <line
                  x1={padding.left}
                  y1={avgY}
                  x2={containerWidth - padding.right}
                  y2={avgY}
                  stroke="#3b82f6"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                  opacity="0.8"
                />
                <rect
                  x={containerWidth - padding.right - 70}
                  y={avgY - 10}
                  width="70"
                  height="16"
                  rx="4"
                  fill="var(--solid)"
                  stroke="#3b82f6"
                  strokeWidth="1"
                  opacity="0.9"
                />
                <text
                  x={containerWidth - padding.right - 35}
                  y={avgY + 2}
                  textAnchor="middle"
                  className="text-[9px] font-bold fill-blue-500 font-mono"
                >
                  TB {formatKwh(avgKwh, 1)} kWh
                </text>
              </g>
            )}

            {/* Gradient Area Fill */}
            <path d={areaPath} fill={`url(#amberArea-${gradientId})`} />

            {/* Smooth Spline Curve */}
            <path
              d={linePath}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={`url(#glow-${gradientId})`}
              className="energy-chart-line"
            />

            {/* Peak Marker Badge */}
            {peakPoint && peakIndex >= 0 && svgPoints[peakIndex] && (
              <g>
                <circle
                  cx={svgPoints[peakIndex].x}
                  cy={svgPoints[peakIndex].y}
                  r="5"
                  fill="#ef4444"
                  stroke="#ffffff"
                  strokeWidth="2"
                  className="animate-pulse"
                />
                <text
                  x={svgPoints[peakIndex].x}
                  y={Math.max(14, svgPoints[peakIndex].y - 10)}
                  textAnchor="middle"
                  className="text-[9px] font-extrabold fill-rose-500 font-mono"
                >
                  Đỉnh {formatKwh(peakPoint.kwh, 1)}
                </text>
              </g>
            )}

            {/* X-Axis Labels */}
            {svgPoints.map((p, idx) => {
              if (!isLabelVisible(idx, svgPoints.length)) return null;
              return (
                <text
                  key={idx}
                  x={p.x}
                  y={chartHeight - 12}
                  textAnchor="middle"
                  className="text-[10px] font-mono fill-[var(--secondary)]"
                >
                  {p.data.label}
                </text>
              );
            })}

            {/* Active Point Crosshair & Highlight Circle */}
            {activePoint && (
              <g pointerEvents="none">
                {/* Vertical Crosshair Line */}
                <line
                  x1={activePoint.x}
                  y1={padding.top}
                  x2={activePoint.x}
                  y2={padding.top + plotHeight}
                  stroke="#f59e0b"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                  opacity="0.85"
                />
                {/* Outer Glow Circle */}
                <circle
                  cx={activePoint.x}
                  cy={activePoint.y}
                  r="7"
                  fill="#f59e0b"
                  fillOpacity="0.3"
                  className="animate-ping"
                />
                {/* Center Solid Circle */}
                <circle
                  cx={activePoint.x}
                  cy={activePoint.y}
                  r="4.5"
                  fill="#f59e0b"
                  stroke="var(--solid)"
                  strokeWidth="2"
                />
              </g>
            )}
          </svg>
        )}
      </div>
    </div>
  );
};
