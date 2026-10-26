import React from 'react';
import {
  Home,
  Armchair,
  Bed,
  UtensilsCrossed,
  DoorClosed,
  ChevronRight,
  Plus,
} from 'lucide-react';
import type { RoomResponse } from '../../types/room';
import type { DeviceResponse } from '../../types/device';

interface HomeRoomsWidgetProps {
  rooms: RoomResponse[];
  devices: DeviceResponse[];
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string | null) => void;
  onOpenAddRoom: () => void;
}

export const HomeRoomsWidget: React.FC<HomeRoomsWidgetProps> = ({
  rooms,
  devices,
  selectedRoomId,
  onSelectRoom,
  onOpenAddRoom,
}) => {
  // Helper to pick an appropriate icon for room name
  const getRoomIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('khách')) return <Armchair className="w-4 h-4 text-slate-700 dark:text-slate-300" />;
    if (lower.includes('ngủ') || lower.includes('quân') || lower.includes('minh')) return <Bed className="w-4 h-4 text-slate-700 dark:text-slate-300" />;
    if (lower.includes('bếp') || lower.includes('ăn')) return <UtensilsCrossed className="w-4 h-4 text-slate-700 dark:text-slate-300" />;
    return <DoorClosed className="w-4 h-4 text-slate-700 dark:text-slate-300" />;
  };

  const defaultMockRooms = [
    { id: 'mock-living', name: 'Phòng khách', deviceCount: 4 },
    { id: 'mock-bedroom', name: 'Phòng của Quân', deviceCount: 2 },
    { id: 'mock-kitchen', name: 'Phòng bếp', deviceCount: 2 },
  ];

  const displayRooms = rooms.length > 0 ? rooms : defaultMockRooms;
  const totalCount = devices.length > 0 ? devices.length : 8;

  return (
    <div className="surface-card p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.04)] h-full flex flex-col justify-between space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Không gian</p>
          <h3 className="text-xl font-bold tracking-tight text-text">Phòng</h3>
        </div>

        <button
          type="button"
          onClick={onOpenAddRoom}
          className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-hover transition-colors cursor-pointer group"
        >
          <Plus className="w-4 h-4 transition-transform group-hover:scale-110" />
          <span>Thêm</span>
        </button>
      </div>

      {/* Vertical Room List matching Figma */}
      <div className="space-y-2 flex-1 overflow-y-auto max-h-[260px] sm:max-h-[290px] pr-1 scrollbar-thin">
        {/* All Rooms Item */}
        <button
          type="button"
          onClick={() => onSelectRoom(null)}
          className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer ${
            selectedRoomId === null
              ? 'bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 shadow-xs'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
              selectedRoomId === null
                ? 'bg-primary text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}>
              <Home className="w-5 h-5" />
            </div>

            <div className="text-left">
              <p className={`text-sm font-bold truncate ${
                selectedRoomId === null ? 'text-primary' : 'text-text'
              }`}>
                Tất cả phòng
              </p>
              <p className="text-xs text-muted">
                {totalCount} thiết bị
              </p>
            </div>
          </div>

          <ChevronRight className={`w-4 h-4 transition-transform ${
            selectedRoomId === null ? 'text-primary translate-x-0.5' : 'text-slate-400'
          }`} />
        </button>

        {/* Dynamic Individual Rooms */}
        {displayRooms.map((room) => {
          const isSelected = selectedRoomId === room.id;
          const count = 'deviceCount' in room && typeof room.deviceCount === 'number'
            ? room.deviceCount
            : devices.filter((d) => d.roomId === room.id).length;

          return (
            <button
              key={room.id}
              type="button"
              onClick={() => onSelectRoom(room.id)}
              className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer ${
                isSelected
                  ? 'bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 shadow-xs'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                  isSelected
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800'
                }`}>
                  {getRoomIcon(room.name)}
                </div>

                <div className="text-left">
                  <p className={`text-sm font-bold truncate ${
                    isSelected ? 'text-primary' : 'text-text'
                  }`}>
                    {room.name}
                  </p>
                  <p className="text-xs text-muted">
                    {count} thiết bị
                  </p>
                </div>
              </div>

              <ChevronRight className={`w-4 h-4 transition-transform ${
                isSelected ? 'text-primary translate-x-0.5' : 'text-slate-400'
              }`} />
            </button>
          );
        })}
      </div>
    </div>
  );
};
