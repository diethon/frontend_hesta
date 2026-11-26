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
    <div className="bg-white/95 p-5 sm:p-6 rounded-3xl border border-[#cbd5e1] shadow-sm flex flex-col space-y-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-[#e2e8f0] pb-3 min-h-[44px]">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-[#eff6ff] text-[#1d4ed8] border border-[#3b82f6]/40">
            <Home className="h-4 w-4" />
          </span>
          <h3 className="text-base sm:text-lg font-bold text-[#0f172a] tracking-tight">
            Theo Phòng
          </h3>
        </div>
        <span className="h-7 inline-flex items-center text-[11px] font-semibold px-2.5 rounded-full bg-[#f8fafc] border border-[#cbd5e1] text-[#334155]">
          {rooms.length} phòng đang dùng
        </span>
      </div>

      {/* Content */}
      {rooms.length === 0 || rooms.every((r) => r.kwh <= 0.001) ? (
        <div className="py-8 text-center text-xs text-[#475569] flex flex-col items-center justify-center space-y-2">
          <Layers className="w-8 h-8 text-[#94a3b8] stroke-[1.5]" />
          <p>Chưa có dữ liệu tiêu thụ điện theo từng khu vực.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1 energy-scroll-area">
          {rooms.map((room, idx) => {
            const color = ROOM_BAR_COLORS[idx % ROOM_BAR_COLORS.length];

            return (
              <div
                key={room.roomName}
                className="p-3.5 rounded-2xl bg-[#f8fafc] border border-[#cbd5e1] space-y-2 transition-colors hover:bg-white hover:border-[#94a3b8]"
              >
                {/* Room Info & Stats */}
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-2.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: color }}
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-[#0f172a] truncate block leading-snug py-0.5">
                        {room.roomName}
                      </span>
                      <span className="text-[11px] text-[#475569] block leading-snug">
                        {room.deviceCount} thiết bị ghi nhận
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-baseline justify-end gap-1.5 font-mono">
                      <span className="text-xs font-bold text-[#b45309]">
                        {formatKwh(room.kwh)} kWh
                      </span>
                      <span className="text-[11px] font-semibold text-[#475569]">
                        ({room.percentage}%)
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-[#047857] block font-mono">
                      {formatCurrencyVnd(room.costVnd)}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-[#e2e8f0] rounded-full overflow-hidden">
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
