import React from 'react';
import { Wifi, Power, Zap, ArrowUpRight, ChevronRight } from 'lucide-react';
import { formatWattage } from './devicePageHelpers';

export interface DevicesOverviewStripProps {
  onlineCount?: number;
  totalCount?: number;
  offlineCount?: number;
  activeCount?: number;
  estimatedWattage?: number | null;
  todayKwh?: number | null;
  todayCostVnd?: number | null;
  loading?: boolean;
  onNavigateToEnergy?: () => void;
}

export const DevicesOverviewStrip: React.FC<DevicesOverviewStripProps> = ({
  onlineCount,
  totalCount,
  offlineCount,
  activeCount,
  estimatedWattage,
  todayKwh,
  todayCostVnd,
  loading = false,
  onNavigateToEnergy,
}) => {
  return (
    <section
      className="w-full"
      aria-label="Tổng quan thiết bị"
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Trực tuyến (Emerald) */}
        <article className="rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-2.5 bg-gradient-to-br from-[#ffffff] to-[#ecfdf5] border border-[#10b981]/50 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#047857]">Trực tuyến</span>
            <span className="w-8 h-8 rounded-xl bg-[#d1fae5] border border-[#10b981]/40 text-[#059669] flex items-center justify-center shrink-0">
              <Wifi className="w-4 h-4 shrink-0" aria-hidden="true" />
            </span>
          </div>

          <div className="text-xl sm:text-2xl font-extrabold text-[#0f172a] tabular-nums tracking-tight">
            {loading ? (
              <span className="h-6 w-16 bg-[#cbd5e1]/60 rounded animate-pulse block" />
            ) : totalCount === undefined || totalCount === null ? (
              '—'
            ) : (
              <>
                <span>{onlineCount ?? 0}</span>
                <span className="text-[#475569] font-semibold text-sm sm:text-base">
                  /{totalCount}
                </span>
              </>
            )}
          </div>

          <div className="text-xs flex items-center gap-1.5 min-h-[18px]">
            {loading ? (
              <span className="h-3.5 w-20 bg-[#cbd5e1]/60 rounded animate-pulse block" />
            ) : offlineCount !== undefined && offlineCount !== null && offlineCount > 0 ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[#f59e0b] shrink-0" aria-hidden="true" />
                <span className="text-[#475569] font-medium">{offlineCount} ngoại tuyến</span>
              </>
            ) : offlineCount === 0 ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[#10b981] shrink-0" aria-hidden="true" />
                <span className="text-[#047857] font-medium">Tất cả trực tuyến</span>
              </>
            ) : (
              '—'
            )}
          </div>
        </article>

        {/* 2. Đang bật (Blue) */}
        <article className="rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-2.5 bg-gradient-to-br from-[#ffffff] to-[#eff6ff] border border-[#3b82f6]/50 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#1d4ed8]">Đang bật</span>
            <span className="w-8 h-8 rounded-xl bg-[#dbeafe] border border-[#3b82f6]/40 text-[#2563eb] flex items-center justify-center shrink-0">
              <Power className="w-4 h-4 shrink-0" aria-hidden="true" />
            </span>
          </div>

          <div className="text-xl sm:text-2xl font-extrabold text-[#0f172a] tabular-nums tracking-tight">
            {loading ? (
              <span className="h-6 w-12 bg-[#cbd5e1]/60 rounded animate-pulse block" />
            ) : activeCount === undefined || activeCount === null ? (
              '—'
            ) : (
              activeCount
            )}
          </div>

          <div className="text-xs font-medium text-[#475569] flex items-center gap-1.5 min-h-[18px]">
            {loading ? (
              <span className="h-3.5 w-24 bg-[#cbd5e1]/60 rounded animate-pulse block" />
            ) : activeCount === undefined || activeCount === null ? (
              '—'
            ) : activeCount === 0 ? (
              'Tất cả đang tắt'
            ) : (
              `${activeCount} thiết bị đang mở`
            )}
          </div>
        </article>

        {/* 3. Tải tức thời (Amber) */}
        <article className="rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-2.5 bg-gradient-to-br from-[#ffffff] to-[#fffbeb] border border-[#f59e0b]/55 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#b45309]">Tải tức thời</span>
            <span className="w-8 h-8 rounded-xl bg-[#fef3c7] border border-[#f59e0b]/45 text-[#d97706] flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 shrink-0" aria-hidden="true" />
            </span>
          </div>

          <div className="text-xl sm:text-2xl font-extrabold text-[#0f172a] tabular-nums tracking-tight">
            {loading ? (
              <span className="h-6 w-16 bg-[#cbd5e1]/60 rounded animate-pulse block" />
            ) : estimatedWattage === undefined || estimatedWattage === null ? (
              '—'
            ) : (
              formatWattage(estimatedWattage)
            )}
          </div>

          <div className="text-xs font-medium text-[#475569] flex items-center min-h-[18px]">
            {loading ? (
              <span className="h-3.5 w-20 bg-[#cbd5e1]/60 rounded animate-pulse block" />
            ) : (
              'Công suất phụ tải'
            )}
          </div>
        </article>

        {/* 4. Hôm nay (Violet) */}
        <article
          className={`rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-2.5 bg-gradient-to-br from-[#ffffff] to-[#f5f3ff] border border-[#8b5cf6]/50 shadow-xs ${
            onNavigateToEnergy
              ? 'cursor-pointer hover:border-[#7c3aed]/75 hover:shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c3aed]'
              : ''
          }`}
          role={onNavigateToEnergy ? 'button' : undefined}
          tabIndex={onNavigateToEnergy ? 0 : undefined}
          onClick={onNavigateToEnergy}
          onKeyDown={(e) => {
            if (onNavigateToEnergy && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              onNavigateToEnergy();
            }
          }}
          title={onNavigateToEnergy ? 'Xem chi tiết năng lượng hôm nay' : undefined}
          aria-label={
            todayKwh !== null && todayKwh !== undefined
              ? `Hôm nay: ${todayKwh.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh`
              : 'Tổng tiêu thụ hôm nay'
          }
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#6d28d9]">Hôm nay</span>
            <span className="w-8 h-8 rounded-xl bg-[#ede9fe] border border-[#8b5cf6]/40 text-[#7c3aed] flex items-center justify-center shrink-0">
              <ArrowUpRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </span>
          </div>

          <div className="text-xl sm:text-2xl font-extrabold text-[#0f172a] tabular-nums tracking-tight">
            {loading ? (
              <span className="h-6 w-20 bg-[#cbd5e1]/60 rounded animate-pulse block" />
            ) : todayKwh === undefined || todayKwh === null ? (
              '—'
            ) : (
              <>
                <span>
                  {todayKwh.toLocaleString('vi-VN', {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                </span>{' '}
                <span className="text-[#475569] font-semibold text-xs sm:text-sm">kWh</span>
              </>
            )}
          </div>

          <div className="text-xs text-[#475569] font-medium flex items-center justify-between gap-2 min-h-[18px]">
            {loading ? (
              <span className="h-3.5 w-24 bg-[#cbd5e1]/60 rounded animate-pulse block" />
            ) : (
              <>
                <span className="tabular-nums">
                  {todayCostVnd !== null && todayCostVnd !== undefined
                    ? `${Math.round(todayCostVnd).toLocaleString('vi-VN')} đ`
                    : '—'}
                </span>
                <span className="inline-flex items-center gap-0.5 text-[#6d28d9] font-semibold hover:underline shrink-0">
                  <span>Chi tiết</span>
                  <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                </span>
              </>
            )}
          </div>
        </article>
      </div>
    </section>
  );
};

export default DevicesOverviewStrip;
