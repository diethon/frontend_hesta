import React, { useState } from 'react';
import { ChevronRight, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router';
import type { EnergySummary } from '../../types/energy';

interface HomeEnergyWidgetProps {
  homeId?: string;
  energySummary?: EnergySummary | null;
}

export const HomeEnergyWidget: React.FC<HomeEnergyWidgetProps> = ({
  homeId,
  energySummary,
}) => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<'DAY' | 'WEEK' | 'MONTH'>('DAY');

  // Interactive mock bars matching the sleek bar chart in the Figma design
  const chartData = {
    DAY: [
      { label: '0h', val: 25 },
      { label: '4h', val: 18 },
      { label: '8h', val: 55 },
      { label: '12h', val: 78 },
      { label: '16h', val: 62 },
      { label: '20h', val: 95, active: true },
      { label: '24h', val: 40 },
    ],
    WEEK: [
      { label: 'T2', val: 45 },
      { label: 'T3', val: 60 },
      { label: 'T4', val: 55 },
      { label: 'T5', val: 75 },
      { label: 'T6', val: 82 },
      { label: 'T7', val: 98, active: true },
      { label: 'CN', val: 68 },
    ],
    MONTH: [
      { label: 'T1', val: 50 },
      { label: 'T2', val: 65 },
      { label: 'T3', val: 75 },
      { label: 'T4', val: 90, active: true },
    ],
  };

  const currentBars = chartData[period];
  const displayKwh = energySummary?.totalKwh ?? 12.4;
  const displayTrend = energySummary?.comparisonLastPeriodPercent ?? 1.2;

  const handleOpenEnergy = () => {
    if (homeId) {
      navigate(`/homes/${encodeURIComponent(homeId)}/energy`);
    }
  };

  return (
    <div className="surface-card p-5 sm:p-6 rounded-3xl border border-line shadow-soft flex flex-col justify-between space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Năng lượng</p>
          <h3 className="text-lg font-bold tracking-tight text-text">Điện năng</h3>
        </div>

        <button
          type="button"
          onClick={handleOpenEnergy}
          className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover transition-colors cursor-pointer group"
          title="Xem chi tiết điện năng tiêu thụ"
        >
          <span>Chi tiết</span>
          <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      {/* Main Metric */}
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-text">
            {displayKwh.toFixed(1)}
          </span>
          <span className="text-sm font-semibold text-muted">kWh</span>
        </div>

        <div className="flex items-center gap-1.5 mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>+{displayTrend}% so với hôm qua</span>
        </div>
      </div>

      {/* Sleek Bar Chart */}
      <div className="h-32 sm:h-36 pt-4 flex items-end justify-between gap-2 border-b border-line/60 pb-3">
        {currentBars.map((bar, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
            {/* Bar */}
            <div className="w-full max-w-[20px] rounded-lg bg-sidebar group-hover:bg-primary/20 relative flex items-end overflow-hidden transition-all h-full">
              <div
                style={{ height: `${bar.val}%` }}
                className={`w-full rounded-lg transition-all duration-500 ${
                  bar.active
                    ? 'bg-primary shadow-[0_0_12px_rgba(91,192,235,0.4)]'
                    : 'bg-slate-300 dark:bg-slate-700 group-hover:bg-primary/60'
                }`}
              />
            </div>

            {/* Label */}
            <span className="text-[10px] font-medium text-muted">{bar.label}</span>
          </div>
        ))}
      </div>

      {/* Period Selector Tabs */}
      <div className="flex items-center justify-center p-1 rounded-2xl bg-sidebar border border-line/60">
        <button
          type="button"
          onClick={() => setPeriod('DAY')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            period === 'DAY'
              ? 'bg-surface text-primary shadow-xs'
              : 'text-muted hover:text-text'
          }`}
        >
          Ngày
        </button>
        <button
          type="button"
          onClick={() => setPeriod('WEEK')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            period === 'WEEK'
              ? 'bg-surface text-primary shadow-xs'
              : 'text-muted hover:text-text'
          }`}
        >
          Tuần
        </button>
        <button
          type="button"
          onClick={() => setPeriod('MONTH')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            period === 'MONTH'
              ? 'bg-surface text-primary shadow-xs'
              : 'text-muted hover:text-text'
          }`}
        >
          Tháng
        </button>
      </div>
    </div>
  );
};
