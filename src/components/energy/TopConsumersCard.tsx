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
  const gridColsClass =
    tips.length === 1
      ? 'grid-cols-1'
      : tips.length === 2 || tips.length === 4
        ? 'grid-cols-1 md:grid-cols-2'
        : 'grid-cols-1 md:grid-cols-3';

  return (
    <div className="bg-white/95 p-5 sm:p-6 rounded-3xl border border-[#cbd5e1] shadow-sm space-y-4">
      {/* Clean Header */}
      <div className="flex items-center justify-between gap-2 border-b border-[#e2e8f0] pb-3">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-[#ecfdf5] text-[#047857] border border-[#10b981]/40">
            <Lightbulb className="h-4 w-4" />
          </span>
          <h3 className="text-base sm:text-lg font-bold text-[#0f172a] tracking-tight">
            Gợi Ý Tiết Kiệm Điện
          </h3>
        </div>
      </div>

      {tips.length === 0 ? (
        <div className="p-5 rounded-2xl bg-[#f8fafc] border border-[#cbd5e1] text-center text-xs text-[#475569] flex items-center justify-center gap-2">
          <CheckCircle className="w-4 h-4 text-[#059669] shrink-0" />
          <span className="font-semibold text-[#0f172a]">
            Các thiết bị trong nhà đang vận hành tiết kiệm, không phát hiện lãng phí điện.
          </span>
        </div>
      ) : (
        <div className={`grid ${gridColsClass} gap-3.5`}>
          {tips.map((tip) => (
            <div
              key={tip.id}
              className="p-4 rounded-2xl bg-[#f8fafc] border border-[#cbd5e1] flex flex-col justify-between space-y-2.5 transition-colors hover:bg-white hover:border-[#10b981]/60 shadow-2xs"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#ecfdf5] text-[#047857] border border-[#10b981]/40">
                    {tip.badge}
                  </span>
                  <span className="text-xs font-bold font-mono text-[#047857]">
                    Tiết kiệm ~{formatCurrencyVnd(tip.estimatedSavingVnd)}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-[#0f172a] leading-snug">
                  {tip.title}
                </h4>

                <p className="text-[11px] text-[#475569] leading-relaxed line-clamp-3">
                  {tip.description}
                </p>
              </div>

              {tip.actionHref && (
                <button
                  type="button"
                  onClick={() => navigate(tip.actionHref!)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#2563eb] hover:underline pt-1 cursor-pointer w-fit"
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
