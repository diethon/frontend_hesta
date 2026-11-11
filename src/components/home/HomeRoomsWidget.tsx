import React from 'react';
import { Icon, type IconName } from './HomeIcons';
import type { RoomResponse } from '../../types/room';
import type { DeviceResponse } from '../../types/device';

interface HomeRoomsWidgetProps {
  rooms: RoomResponse[];
  devices: DeviceResponse[];
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string | null) => void;
  onOpenAddRoom?: () => void;
}

export const HomeRoomsWidget: React.FC<HomeRoomsWidgetProps> = ({
  rooms,
  devices,
  selectedRoomId,
  onSelectRoom,
  onOpenAddRoom,
}) => {
  // If no backend rooms exist, use realistic fallback matching Figma
  const defaultRooms = [
    { id: 'mock-all', name: 'Tất cả phòng', count: devices.length || 8, icon: 'home' as IconName },
    { id: 'mock-living', name: 'Phòng khách', count: 4, icon: 'sofa' as IconName },
    { id: 'mock-bedroom', name: 'Phòng của Quân', count: 2, icon: 'door' as IconName },
    { id: 'mock-kitchen', name: 'Phòng bếp', count: 0, icon: 'door' as IconName },
    { id: 'mock-corridor', name: 'Hành lang tầng 2', count: 0, icon: 'door' as IconName },
    { id: 'mock-balcony', name: 'Ban công tầng 3', count: 0, icon: 'door' as IconName },
  ];

  // Map real rooms if available
  const displayRooms =
    rooms.length > 0
      ? [
          {
            id: null,
            name: 'Tất cả phòng',
            count: devices.length,
            icon: 'home' as IconName,
          },
          ...rooms.map((r, i) => {
            const count = devices.filter((d) => d.roomId === r.id).length;
            const icon: IconName =
              r.name.toLowerCase().includes('khách') || r.name.toLowerCase().includes('living')
                ? 'sofa'
                : i % 2 === 0
                  ? 'door'
                  : 'lamp';
            return {
              id: r.id,
              name: r.name,
              count,
              icon,
            };
          }),
        ]
      : defaultRooms.map((r) => ({
          id: r.id === 'mock-all' ? null : r.id,
          name: r.name,
          count: r.count,
          icon: r.icon,
        }));

  return (
    <section className="rooms glass-g2">
      <div className="section-head">
        <div>
          <span className="eyebrow">KHÔNG GIAN</span>
          <h2>Phòng</h2>
        </div>

        <button
          type="button"
          className="text-button"
          onClick={onOpenAddRoom}
          title="Thêm phòng mới"
        >
          <Icon name="plus" size={17} />
          <span>Thêm</span>
        </button>
      </div>

      <div className="room-list">
        {displayRooms.map((room) => {
          const isSelected = selectedRoomId === room.id;
          const isEmpty = room.count === 0;

          return (
            <button
              key={room.name}
              type="button"
              className={`room-item ${isSelected ? 'active' : ''} ${isEmpty ? 'empty' : ''}`}
              onClick={() => onSelectRoom(room.id)}
            >
              <span className="room-icon">
                <Icon name={room.icon} size={18} />
              </span>

              <span className="room-copy">
                <strong>{room.name}</strong>
                <small>{room.count} thiết bị</small>
              </span>

              <Icon name="chevron" size={16} />
            </button>
          );
        })}
      </div>
    </section>
  );
};
