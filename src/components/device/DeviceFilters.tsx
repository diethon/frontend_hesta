import React from 'react';
import { Search, X } from 'lucide-react';

interface DeviceFiltersProps {
  rooms: { id: string; name: string }[];
  selectedRoomId: string; // 'ALL' or room UUID
  onRoomChange: (roomId: string) => void;
  roomCounts?: Record<string, number>;
  totalDeviceCount?: number;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export const DeviceFilters: React.FC<DeviceFiltersProps> = ({
  rooms,
  selectedRoomId,
  onRoomChange,
  roomCounts = {},
  totalDeviceCount = 0,
  searchQuery = '',
  onSearchChange,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      {/* ── Room Tabs ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-line bg-white/80 backdrop-blur-md p-1.5 shadow-xs custom-scrollbar flex-1 min-w-0">
        <button
          type="button"
          onClick={() => onRoomChange('ALL')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
            selectedRoomId === 'ALL'
              ? 'bg-primary text-white shadow-xs scale-101'
              : 'text-muted hover:bg-sidebar-hover hover:text-text'
          }`}
        >
          <span>Tất cả phòng</span>
          <span
            className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
              selectedRoomId === 'ALL'
                ? 'bg-white/20 text-white'
                : 'bg-off text-muted'
            }`}
          >
            {totalDeviceCount}
          </span>
        </button>

        {rooms.map((room) => {
          const isSelected = selectedRoomId === room.id;
          const count = roomCounts[room.id] || 0;
          return (
            <button
              key={room.id}
              type="button"
              onClick={() => onRoomChange(room.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-primary text-white shadow-xs scale-101'
                  : 'text-muted hover:bg-sidebar-hover hover:text-text'
              }`}
            >
              <span>{room.name}</span>
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
                  isSelected
                    ? 'bg-white/20 text-white'
                    : 'bg-off text-muted'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Instant Search Input ── */}
      {onSearchChange && (
        <div className="relative shrink-0 sm:w-64">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm thiết bị..."
            className="w-full pl-9 pr-8 py-2 rounded-2xl border border-line bg-white/90 text-sm text-text placeholder:text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-text rounded-md transition-colors"
              aria-label="Xóa tìm kiếm"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
