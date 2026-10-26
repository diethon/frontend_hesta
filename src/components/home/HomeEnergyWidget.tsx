import React, { useState } from 'react';
import { TrendingDown, MoreVertical } from 'lucide-react';
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

  // Exact 7 bars matching Figma desktop screenshot
  const chartData = {
    DAY: [
      { label: '', val: 32 },
      { label: '', val: 24 },
      { label: '', val: 48 },
      { label: '', val: 68 },
      { label: '', val: 52 },
      { label: '', val: 92, active: true },
      { label: '', val: 38 },
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

  const handleOpenEnergy = () => {
    if (homeId) {
      navigate(`/homes/${encodeURIComponent(homeId)}/energy`);
    }
  };

  return (
    <div className="surface-card p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.04)] h-full flex flex-col justify-between space-y-4">
      {/* Header matching Figma */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Hôm nay</p>
          <h3 className="text-xl font-bold tracking-tight text-text">Điện năng</h3>
        </div>

        <button
          type="button"
          onClick={handleOpenEnergy}
          className="p-1 rounded-xl text-icon hover:bg-slate-100 transition-colors cursor-pointer"
          title="Tùy chọn điện năng"
        >
          <MoreVertical className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      {/* Main Metric matching Figma */}
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-text">
            {displayKwh.toFixed(1)}
          </span>
          <span className="text-sm font-semibold text-muted">kWh</span>
        </div>

        {/* Green trend ↓ 8% so với hôm qua */}
        <div className="flex items-center gap-1.5 mt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <TrendingDown className="w-3.5 h-3.5" />
          <span>↓ 8% so với hôm qua</span>
        </div>
      </div>

      {/* Sleek Vertical Bar Chart matching Figma */}
      <div className="h-32 pt-4 flex items-end justify-between gap-2.5 border-b border-slate-100 dark:border-slate-800/80 pb-3">
        {currentBars.map((bar, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
            <div className="w-full max-w-[18px] rounded-lg bg-blue-50/60 dark:bg-slate-800 relative flex items-end overflow-hidden transition-all h-full">
              <div
                style={{ height: `${bar.val}%` }}
                className={`w-full rounded-lg transition-all duration-500 ${
                  bar.active
                    ? 'bg-primary shadow-[0_0_10px_rgba(37,99,235,0.4)]'
                    : 'bg-slate-200 dark:bg-slate-700 group-hover:bg-primary/50'
                }`}
              />
            </div>
            {bar.label && (
              <span className="text-[10px] font-medium text-muted">{bar.label}</span>
            )}
          </div>
        ))}
      </div>

      {/* Period Selector Tabs */}
      <div className="flex items-center justify-center p-1 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setPeriod('DAY')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            period === 'DAY'
              ? 'bg-white dark:bg-slate-900 text-primary shadow-xs'
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
              ? 'bg-white dark:bg-slate-900 text-primary shadow-xs'
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
              ? 'bg-white dark:bg-slate-900 text-primary shadow-xs'
              : 'text-muted hover:text-text'
          }`}
        >
          Tháng
        </button>
      </div>
    </div>
  );
};
