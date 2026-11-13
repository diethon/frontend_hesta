import React from 'react';
import { Wifi, Power, Zap, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { formatWattage } from './devicePageHelpers';

export interface DevicesOverviewStripProps {
  onlineCount: number;
  totalCount: number;
  offlineCount: number;
  activeCount: number;
  estimatedWattage: number;
  todayKwh: number | null;
  todayCostVnd: number | null;
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
  onNavigateToEnergy,
}) => {
  return (
    <section className="devices-overview-strip" aria-label="Tổng quan thiết bị">
      {/* 1. Trực tuyến */}
      <article className="overview-tile glass-g1">
        <div className="overview-tile-header">
          <span className="overview-tile-title">Trực tuyến</span>
          <div className="overview-tile-icon icon-emerald">
            <Wifi size={16} />
          </div>
        </div>
        <div className="overview-tile-value">
          {onlineCount}
          <span className="overview-tile-total">/{totalCount}</span>
        </div>
        <div className="overview-tile-sub">
          {offlineCount > 0 ? (
            <span className="text-offline font-semibold flex items-center gap-1 text-rose-600 dark:text-rose-400">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              {offlineCount} ngoại tuyến
            </span>
          ) : (
            <span className="text-online font-semibold flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={12} />
              Tất cả trực tuyến
            </span>
          )}
        </div>
      </article>

      {/* 2. Đang bật */}
      <article className="overview-tile glass-g1">
        <div className="overview-tile-header">
          <span className="overview-tile-title">Đang bật</span>
          <div className="overview-tile-icon icon-blue">
            <Power size={16} />
          </div>
        </div>
        <div className="overview-tile-value">
          {activeCount}
          {activeCount > 0 && (
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-ping ml-2 align-middle" />
          )}
        </div>
        <div className="overview-tile-sub text-[var(--secondary)]">
          {activeCount === 0
            ? 'Tất cả đang tắt'
            : `${activeCount} thiết bị đang mở`}
        </div>
      </article>

      {/* 3. Tải ước tính */}
      <article className="overview-tile glass-g1">
        <div className="overview-tile-header">
          <span className="overview-tile-title">Tải tức thời</span>
          <div className="overview-tile-icon icon-amber">
            <Zap size={16} />
          </div>
        </div>
        <div className="overview-tile-value text-amber-600 dark:text-amber-400 font-mono">
          {formatWattage(estimatedWattage)}
        </div>
        <div className="overview-tile-sub text-[var(--secondary)]">
          Công suất phụ tải
        </div>
      </article>

      {/* 4. Hôm nay (clickable → energy) */}
      <article
        className="overview-tile glass-g1 clickable"
        role="button"
        tabIndex={0}
        onClick={onNavigateToEnergy}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onNavigateToEnergy?.();
          }
        }}
        title="Bấm để xem chi tiết năng lượng"
        aria-label={`Hôm nay: ${
          todayKwh !== null ? `${todayKwh.toFixed(1)} kWh` : 'Xem chi tiết'
        }`}
      >
        <div className="overview-tile-header">
          <span className="overview-tile-title">Hôm nay</span>
          <div className="overview-tile-icon icon-indigo">
            <ArrowUpRight size={16} />
          </div>
        </div>
        <div className="overview-tile-value font-mono">
          {todayKwh !== null ? (
            <>
              {todayKwh.toFixed(1)} <span className="text-xs font-bold text-[var(--secondary)]">kWh</span>
            </>
          ) : (
            '--'
          )}
        </div>
        <div className="overview-tile-sub flex items-center justify-between text-indigo-600 dark:text-indigo-400 font-semibold font-mono">
          <span>{todayCostVnd !== null ? `${Math.round(todayCostVnd).toLocaleString('vi-VN')} đ` : 'Xem chi tiết'}</span>
          <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--accent)]">Chi tiết →</span>
        </div>
      </article>
    </section>
  );
};
