import React, { useState } from 'react';
import {
  computeEvnCostSplit,
  formatCurrencyVnd,
  formatKwh,
  getTierColorClass,
  VAT_RATE,
} from './energyUtils';
import { Layers, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

interface EvnTierLadderProps {
  totalKwh: number;
  projectedMonthKwh: number;
  currentTier: number;
  period: '24H' | '7D' | '30D';
  monthlyTotalKwh?: number;
}

export const EvnTierLadder: React.FC<EvnTierLadderProps> = ({
  totalKwh,
  period,
  monthlyTotalKwh,
}) => {
  const [showCostSplit, setShowCostSplit] = useState(false);

  // Use monthly accumulated kWh (30D) when inspecting shorter windows so EVN ladder matches billing cycle
  const isMonthlyDerived = period !== '30D' && monthlyTotalKwh !== undefined;
  const referenceKwh = isMonthlyDerived ? monthlyTotalKwh : (totalKwh || 0);

  const splitData = computeEvnCostSplit(referenceKwh);
  const tierColor = getTierColorClass(splitData.computedTier);

  return (
    <div className="bg-white/95 p-5 sm:p-6 rounded-3xl border border-[#cbd5e1] shadow-sm flex flex-col justify-between space-y-4 h-full">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-2 border-b border-[#e2e8f0] pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#eef2ff] text-[#4338ca] border border-[#6366f1]/40">
              <Layers className="h-4 w-4" />
            </span>
            <h3 className="text-base sm:text-lg font-bold text-[#0f172a] tracking-tight">
              Bậc Thang EVN
            </h3>
          </div>
          <span
            className={`text-xs font-extrabold px-2.5 py-1 rounded-full border tabular-nums ${tierColor.badge}`}
          >
            Bậc {splitData.computedTier}
          </span>
        </div>

        {/* Current Tier Guidance Box */}
        <div className="mt-3.5 p-3.5 rounded-2xl bg-[#f8fafc] border border-[#cbd5e1] space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#0f172a] flex items-center gap-1.5">
              <span>{isMonthlyDerived ? 'Tích lũy tháng này:' : 'Mức tích lũy:'}</span>
              <strong className="text-[#b45309] font-mono font-bold">
                {formatKwh(referenceKwh)} kWh
              </strong>
            </span>
            <span className="text-[11px] text-[#475569] font-mono font-semibold">
              {splitData.computedTier === 6
                ? '100% (Bậc kịch trần)'
                : `${Math.round(splitData.progressInCurrentTier)}% bậc hiện tại`}
            </span>
          </div>

          {/* Progress bar inside current tier */}
          <div className="w-full h-2.5 bg-[#e2e8f0] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${tierColor.bgLight}`}
              style={{
                width: `${splitData.progressInCurrentTier}%`,
                minWidth: referenceKwh > 0 ? '4px' : undefined,
              }}
            />
          </div>

          {/* Next tier warning or congratulations text */}
          <div className="text-xs flex items-start gap-1.5 pt-0.5">
            {splitData.computedTier === 6 ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-[#e11d48] shrink-0 mt-0.5" />
                <span className="text-[#be123c] font-medium">
                  Đang ở bậc cao nhất (Bậc 6: 3.302 đ/kWh). Hãy áp dụng các kịch bản cắt giảm phụ tải đỉnh.
                </span>
              </>
            ) : splitData.kwhLeftToNextTier !== null && splitData.nextTierPrice !== null ? (
              <>
                <Info className="w-3.5 h-3.5 text-[#d97706] shrink-0 mt-0.5" />
                <span className="text-[#475569]">
                  Còn{' '}
                  <strong className="text-[#0f172a] font-semibold font-mono">
                    {formatKwh(splitData.kwhLeftToNextTier)} kWh
                  </strong>{' '}
                  nữa sẽ lên{' '}
                  <strong className="text-[#b45309] font-semibold">
                    Bậc {splitData.computedTier + 1}
                  </strong>{' '}
                  ({splitData.nextTierPrice.toLocaleString('vi-VN')} đ/kWh)
                </span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* 6 Steps Ladder List */}
      <div className="space-y-1.5">
        {splitData.tiers.map((t) => {
          const isCurrent = t.tier === splitData.computedTier;
          const isPassed = t.tier < splitData.computedTier;
          const stepColor = getTierColorClass(t.tier);

          return (
            <div
              key={t.tier}
              className={`ladder-step p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                isCurrent
                  ? `bg-white ${stepColor.border} shadow-xs ring-1 ring-[#e2e8f0]`
                  : isPassed
                  ? 'bg-[#f8fafc] border-[#cbd5e1]'
                  : 'bg-white border-[#e2e8f0] opacity-85'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    isCurrent
                      ? `${stepColor.bgLight} text-white`
                      : isPassed
                      ? 'bg-[#ecfdf5] border border-[#10b981]/35 text-[#059669]'
                      : 'bg-[#f8fafc] border border-[#cbd5e1] text-[#64748b]'
                  }`}
                >
                  {isPassed ? <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" /> : t.tier}
                </span>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-bold ${isCurrent ? 'text-[#0f172a]' : 'text-[#334155]'}`}>
                      {t.label}
                    </span>
                    <span className="text-[10px] text-[#64748b] font-mono">
                      ({t.rangeLabel})
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="font-mono font-bold text-[#0f172a]">
                  {t.pricePerKwh.toLocaleString('vi-VN')} đ
                </span>
                <span className="text-[10px] text-[#64748b] block">/kWh</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Collapsible Per-Tier Cost Split Breakdown */}
      <div className="pt-2 border-t border-[#e2e8f0]">
        <button
          type="button"
          onClick={() => setShowCostSplit((prev) => !prev)}
          className="w-full flex items-center justify-between text-xs font-semibold text-[#334155] hover:text-[#0f172a] py-1 transition-colors cursor-pointer"
        >
          <span>Chi tiết tính tiền theo từng bậc</span>
          <span className="flex items-center gap-1 text-[11px] font-bold text-[#b45309]">
            {showCostSplit ? 'Thu gọn' : 'Xem phân tách'}
            {showCostSplit ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </button>

        {showCostSplit && (
          <div className="mt-2 space-y-1.5 p-3 rounded-2xl bg-[#f8fafc] border border-[#cbd5e1] text-[11px] animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="grid grid-cols-12 gap-1 text-[#475569] font-semibold border-b border-[#e2e8f0] pb-1">
              <span className="col-span-4">Bậc EVN</span>
              <span className="col-span-3 text-right">Sản lượng</span>
              <span className="col-span-5 text-right">Thành tiền</span>
            </div>

            {splitData.tiers.map((t) => {
              if (t.kwhInTier <= 0) return null;
              return (
                <div key={t.tier} className="grid grid-cols-12 gap-1 font-mono items-center py-0.5">
                  <span className="col-span-4 font-semibold text-[#0f172a]">
                    {t.label}
                  </span>
                  <span className="col-span-3 text-right text-[#475569]">
                    {formatKwh(t.kwhInTier)} kWh
                  </span>
                  <span className="col-span-5 text-right font-bold text-[#047857]">
                    {formatCurrencyVnd(t.costVndWithVat)}
                  </span>
                </div>
              );
            })}

            <div className="pt-2 mt-1 border-t border-[#cbd5e1] flex justify-between font-bold text-xs text-[#0f172a]">
              <span>Tổng cộng (VAT {(VAT_RATE * 100).toFixed(0)}%):</span>
              <span className="text-[#047857] font-mono">
                {formatCurrencyVnd(splitData.totalCostWithVat)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
