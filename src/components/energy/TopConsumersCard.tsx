import React from 'react';
import { useNavigate } from 'react-router';
import type { DeviceEnergyBreakdown, EnergySummary } from '../../types/energy';
import {
  formatCurrencyVnd,
  generateSavingTips,
} from './energyUtils';
import {
  Lightbulb,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';

interface TopConsumersCardProps {
  breakdown: DeviceEnergyBreakdown[];
  summary: EnergySummary | undefined;
  period: '24H' | '7D' | '30D';
  homeId?: string;
}

export const TopConsumersCard: React.FC<TopConsumersCardProps> = ({
  breakdown,
  summary,
  period,
  homeId,
}) => {
  const navigate = useNavigate();
  const tips = generateSavingTips(summary, breakdown, period, homeId);

  return (
    <div className="glass-card glass-g2 p-5 sm:p-6 rounded-3xl border border-[var(--border)] shadow-xs space-y-4">
      {/* Clean Header */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)]/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-500">
            <Lightbulb className="h-4 w-4" />
          </span>
          <h3 className="text-base sm:text-lg font-bold text-[var(--text)] tracking-tight">
            Gợi Ý Tiết Kiệm Điện
          </h3>
        </div>
      </div>

      {tips.length === 0 ? (
        <div className="p-5 rounded-2xl bg-[var(--solid)]/50 border border-[var(--border)] text-center text-xs text-[var(--secondary)] flex items-center justify-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="font-semibold text-[var(--text)]">
            Các thiết bị trong nhà đang vận hành tiết kiệm, không phát hiện lãng phí điện.
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {tips.map((tip) => (
            <div
              key={tip.id}
              className="p-4 rounded-2xl bg-[var(--solid)] border border-[var(--border)] flex flex-col justify-between space-y-2.5 transition-all hover:border-emerald-500/40 shadow-xs"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    {tip.badge}
                  </span>
                  <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    Tiết kiệm ~{formatCurrencyVnd(tip.estimatedSavingVnd)}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-[var(--text)] leading-snug">
                  {tip.title}
                </h4>

                <p className="text-[11px] text-[var(--secondary)] leading-relaxed line-clamp-2">
                  {tip.description}
                </p>
              </div>

              {tip.actionHref && (
                <button
                  type="button"
                  onClick={() => navigate(tip.actionHref!)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--accent)] hover:underline pt-1 cursor-pointer"
                >
                  <span>{tip.actionText || 'Điều chỉnh ngay'}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
