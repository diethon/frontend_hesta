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
}

export const EvnTierLadder: React.FC<EvnTierLadderProps> = ({
  totalKwh,
  currentTier,
}) => {
  const [showCostSplit, setShowCostSplit] = useState(false);

  // Reference kWh based on actual accumulated kWh of the selected period (from day 01 for current month)
  const referenceKwh = totalKwh || 0;

  const splitData = computeEvnCostSplit(referenceKwh, currentTier);
  const tierColor = getTierColorClass(splitData.computedTier);

  return (
    <div className="glass-card glass-g2 p-5 sm:p-6 rounded-3xl border border-[var(--border)] shadow-xs flex flex-col justify-between space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border)]/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-500">
              <Layers className="h-4 w-4" />
            </span>
            <h3 className="text-base sm:text-lg font-bold text-[var(--text)] tracking-tight">
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
        <div className="mt-3.5 p-3.5 rounded-2xl bg-[var(--solid)] border border-[var(--border)] space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--text)] flex items-center gap-1.5">
              <span>Mức tích lũy:</span>
              <strong className="text-amber-500 font-mono font-bold">
                {formatKwh(referenceKwh)} kWh
              </strong>
            </span>
            <span className="text-[11px] text-[var(--secondary)] font-mono">
              {splitData.computedTier === 6
                ? '100% (Bậc kịch trần)'
                : `${Math.round(splitData.progressInCurrentTier)}% bậc hiện tại`}
            </span>
          </div>

          {/* Progress bar inside current tier */}
          <div className="w-full h-2 bg-[var(--muted)] rounded-full overflow-hidden p-0.5 border border-[var(--border)]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${tierColor.bgLight}`}
              style={{ width: `${splitData.progressInCurrentTier}%` }}
            />
          </div>

          {/* Next tier warning or congratulations text */}
          <div className="text-xs flex items-start gap-1.5 pt-0.5">
            {splitData.computedTier === 6 ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                <span className="text-rose-600 dark:text-rose-400 font-medium">
                  Đang ở bậc cao nhất (Bậc 6: 3.302 đ/kWh). Hãy áp dụng các kịch bản cắt giảm phụ tải đỉnh.
                </span>
              </>
            ) : splitData.kwhLeftToNextTier !== null && splitData.nextTierPrice !== null ? (
              <>
                <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-[var(--secondary)]">
                  Còn{' '}
                  <strong className="text-[var(--text)] font-semibold font-mono">
                    {formatKwh(splitData.kwhLeftToNextTier)} kWh
                  </strong>{' '}
                  nữa sẽ lên{' '}
                  <strong className="text-amber-600 dark:text-amber-400 font-semibold">
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
                  ? `bg-[var(--solid)] ${stepColor.border} shadow-sm ring-1 ring-amber-500/20`
                  : isPassed
                  ? 'bg-[var(--g1)] border-[var(--border)] opacity-85'
                  : 'bg-[var(--g1)]/40 border-transparent opacity-50'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    isCurrent
                      ? `${stepColor.bgLight} text-white`
                      : isPassed
                      ? 'bg-[var(--muted)] text-[var(--secondary)]'
                      : 'bg-transparent border border-[var(--border)] text-[var(--tertiary)]'
                  }`}
                >
                  {isPassed ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : t.tier}
                </span>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-bold ${isCurrent ? 'text-[var(--text)]' : 'text-[var(--secondary)]'}`}>
                      {t.label}
                    </span>
                    <span className="text-[10px] text-[var(--tertiary)] font-mono">
                      ({t.rangeLabel})
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="font-mono font-bold text-[var(--text)]">
                  {t.pricePerKwh.toLocaleString('vi-VN')} đ
                </span>
                <span className="text-[10px] text-[var(--tertiary)] block">/kWh</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Collapsible Per-Tier Cost Split Breakdown */}
      <div className="pt-2 border-t border-[var(--border)]/60">
        <button
          type="button"
          onClick={() => setShowCostSplit((prev) => !prev)}
          className="w-full flex items-center justify-between text-xs font-semibold text-[var(--secondary)] hover:text-[var(--text)] py-1 transition-colors cursor-pointer"
        >
          <span>Chi tiết tính tiền theo từng bậc</span>
          <span className="flex items-center gap-1 text-[11px] text-amber-500">
            {showCostSplit ? 'Thu gọn' : 'Xem phân tách'}
            {showCostSplit ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </button>

        {showCostSplit && (
          <div className="mt-2 space-y-1.5 p-3 rounded-2xl bg-[var(--solid)] border border-[var(--border)] text-[11px] animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="grid grid-cols-12 gap-1 text-[var(--tertiary)] font-semibold border-b border-[var(--border)] pb-1">
              <span className="col-span-4">Bậc EVN</span>
              <span className="col-span-3 text-right">Sản lượng</span>
              <span className="col-span-5 text-right">Thành tiền</span>
            </div>

            {splitData.tiers.map((t) => {
              if (t.kwhInTier <= 0) return null;
              return (
                <div key={t.tier} className="grid grid-cols-12 gap-1 font-mono items-center py-0.5">
                  <span className="col-span-4 font-semibold text-[var(--text)]">
                    {t.label}
                  </span>
                  <span className="col-span-3 text-right text-[var(--secondary)]">
                    {formatKwh(t.kwhInTier)} kWh
                  </span>
                  <span className="col-span-5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrencyVnd(t.costVndWithVat)}
                  </span>
                </div>
              );
            })}

            <div className="pt-2 mt-1 border-t border-[var(--border)] flex justify-between font-bold text-xs text-[var(--text)]">
              <span>Tổng cộng (VAT {(VAT_RATE * 100).toFixed(0)}%):</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                {formatCurrencyVnd(splitData.totalCostWithVat)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
