import React from 'react';
import type { DeviceEnergyBreakdown } from '../../types/energy';
import { aggregateByRoom, formatCurrencyVnd, formatKwh } from './energyUtils';
import { Home, Layers } from 'lucide-react';

interface RoomBreakdownCardProps {
  breakdown: DeviceEnergyBreakdown[];
  totalKwh: number;
  period: '24H' | '7D' | '30D';
}

const ROOM_BAR_COLORS = [
  '#f59e0b', // Amber
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f43f5e', // Rose
  '#14b8a6', // Teal
];

export const RoomBreakdownCard: React.FC<RoomBreakdownCardProps> = ({
  breakdown,
  totalKwh,
}) => {
  const allRooms = aggregateByRoom(breakdown, totalKwh);
  const rooms = allRooms.filter((r) => r.kwh > 0.001);

  return (
    <div className="glass-card glass-g2 p-5 sm:p-6 rounded-3xl border border-[var(--border)] shadow-xs flex flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)]/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-blue-500/15 text-blue-500">
            <Home className="h-4 w-4" />
          </span>
          <h3 className="text-base sm:text-lg font-bold text-[var(--text)] tracking-tight">
            Theo Phòng
          </h3>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--solid)] border border-[var(--border)] text-[var(--secondary)]">
          {rooms.length} phòng đang dùng
        </span>
      </div>

      {/* Content */}
      {rooms.length === 0 || rooms.every((r) => r.kwh <= 0.001) ? (
        <div className="py-8 text-center text-xs text-[var(--secondary)] flex flex-col items-center justify-center space-y-2">
          <Layers className="w-8 h-8 text-[var(--tertiary)] stroke-[1.5]" />
          <p>Chưa có dữ liệu tiêu thụ điện theo từng khu vực.</p>
        </div>
      ) : (
        <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1 energy-scroll-area">
          {rooms.map((room, idx) => {
            const color = ROOM_BAR_COLORS[idx % ROOM_BAR_COLORS.length];

            return (
              <div
                key={room.roomName}
                className="p-3.5 rounded-2xl bg-[var(--g1)] border border-[var(--border)] space-y-2 transition-all hover:bg-[var(--solid)]"
              >
                {/* Room Info & Stats */}
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: color }}
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-[var(--text)] truncate block">
                        {room.roomName}
                      </span>
                      <span className="text-[10px] text-[var(--tertiary)] block">
                        {room.deviceCount} thiết bị ghi nhận
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-baseline justify-end gap-1.5 font-mono">
                      <span className="text-xs font-bold text-amber-500">
                        {formatKwh(room.kwh)} kWh
                      </span>
                      <span className="text-[11px] font-semibold text-[var(--secondary)]">
                        ({room.percentage}%)
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 block font-mono">
                      {formatCurrencyVnd(room.costVnd)}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(room.percentage, 100)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
