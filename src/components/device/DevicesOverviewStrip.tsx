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
      className="w-full rounded-2xl border border-[var(--border)] bg-[var(--g1)] backdrop-blur-md shadow-xs overflow-hidden"
      aria-label="Tổng quan thiết bị"
    >
      <div className="grid grid-cols-2 lg:grid-cols-4">
        {/* 1. Trực tuyến */}
        <article className="p-4 sm:p-5 flex flex-col justify-between gap-2.5 border-b lg:border-b-0 border-r border-[var(--border)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-[var(--secondary)] font-medium">Trực tuyến</span>
            <Wifi className="w-4 h-4 text-[var(--secondary)] shrink-0" aria-hidden="true" />
          </div>

          <div className="text-lg sm:text-xl font-semibold text-[var(--text)] tabular-nums tracking-tight">
            {loading ? (
              <span className="h-6 w-16 bg-[var(--border)]/50 rounded animate-pulse block" />
            ) : totalCount === undefined || totalCount === null ? (
              '—'
            ) : (
              <>
                <span>{onlineCount ?? 0}</span>
                <span className="text-[var(--secondary)] font-normal text-sm sm:text-base">
                  /{totalCount}
                </span>
              </>
            )}
          </div>

          <div className="text-xs text-[var(--secondary)] flex items-center gap-1.5 min-h-[18px]">
            {loading ? (
              <span className="h-3.5 w-20 bg-[var(--border)]/50 rounded animate-pulse block" />
            ) : offlineCount !== undefined && offlineCount !== null && offlineCount > 0 ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--secondary)] shrink-0" aria-hidden="true" />
                <span>{offlineCount} ngoại tuyến</span>
              </>
            ) : offlineCount === 0 ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--secondary)] shrink-0" aria-hidden="true" />
                <span>Tất cả trực tuyến</span>
              </>
            ) : (
              '—'
            )}
          </div>
        </article>

        {/* 2. Đang bật */}
        <article className="p-4 sm:p-5 flex flex-col justify-between gap-2.5 border-b lg:border-b-0 lg:border-r border-[var(--border)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-[var(--secondary)] font-medium">Đang bật</span>
            <Power className="w-4 h-4 text-[var(--secondary)] shrink-0" aria-hidden="true" />
          </div>

          <div className="text-lg sm:text-xl font-semibold text-[var(--text)] tabular-nums tracking-tight">
            {loading ? (
              <span className="h-6 w-12 bg-[var(--border)]/50 rounded animate-pulse block" />
            ) : activeCount === undefined || activeCount === null ? (
              '—'
            ) : (
              activeCount
            )}
          </div>

          <div className="text-xs text-[var(--secondary)] flex items-center gap-1.5 min-h-[18px]">
            {loading ? (
              <span className="h-3.5 w-24 bg-[var(--border)]/50 rounded animate-pulse block" />
            ) : activeCount === undefined || activeCount === null ? (
              '—'
            ) : activeCount === 0 ? (
              'Tất cả đang tắt'
            ) : (
              `${activeCount} thiết bị đang mở`
            )}
          </div>
        </article>

        {/* 3. Tải tức thời */}
        <article className="p-4 sm:p-5 flex flex-col justify-between gap-2.5 border-r border-[var(--border)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-[var(--secondary)] font-medium">Tải tức thời</span>
            <Zap className="w-4 h-4 text-[var(--secondary)] shrink-0" aria-hidden="true" />
          </div>

          <div className="text-lg sm:text-xl font-semibold text-[var(--text)] tabular-nums tracking-tight">
            {loading ? (
              <span className="h-6 w-16 bg-[var(--border)]/50 rounded animate-pulse block" />
            ) : estimatedWattage === undefined || estimatedWattage === null ? (
              '—'
            ) : (
              formatWattage(estimatedWattage)
            )}
          </div>

          <div className="text-xs text-[var(--secondary)] flex items-center min-h-[18px]">
            {loading ? (
              <span className="h-3.5 w-20 bg-[var(--border)]/50 rounded animate-pulse block" />
            ) : (
              'Công suất phụ tải'
            )}
          </div>
        </article>

        {/* 4. Hôm nay */}
        <article
          className={`p-4 sm:p-5 flex flex-col justify-between gap-2.5 ${
            onNavigateToEnergy
              ? 'cursor-pointer hover:bg-[var(--muted)]/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
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
            <span className="text-xs text-[var(--secondary)] font-medium">Hôm nay</span>
            <ArrowUpRight className="w-4 h-4 text-[var(--secondary)] shrink-0" aria-hidden="true" />
          </div>

          <div className="text-lg sm:text-xl font-semibold text-[var(--text)] tabular-nums tracking-tight">
            {loading ? (
              <span className="h-6 w-20 bg-[var(--border)]/50 rounded animate-pulse block" />
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
                <span className="text-[var(--secondary)] font-normal text-xs sm:text-sm">kWh</span>
              </>
            )}
          </div>

          <div className="text-xs text-[var(--secondary)] flex items-center justify-between gap-2 min-h-[18px]">
            {loading ? (
              <span className="h-3.5 w-24 bg-[var(--border)]/50 rounded animate-pulse block" />
            ) : (
              <>
                <span className="tabular-nums">
                  {todayCostVnd !== null && todayCostVnd !== undefined
                    ? `${Math.round(todayCostVnd).toLocaleString('vi-VN')} đ`
                    : '—'}
                </span>
                <span className="inline-flex items-center gap-0.5 text-[var(--accent)] font-medium hover:underline shrink-0">
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
