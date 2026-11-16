import React from 'react';
import { Icon, type IconName } from './HomeIcons';
import type { RoomResponse } from '../../types/room';
import type { DeviceResponse } from '../../types/device';

interface HomeRoomsWidgetProps {
  homeId?: string;
  rooms: RoomResponse[];
  devices: DeviceResponse[];
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string | null) => void;
  onOpenAddRoom?: () => void;
}

function resolveRoomIcon(iconStr?: string | null, nameStr?: string): IconName {
  const raw = (iconStr || nameStr || '').toLowerCase();
  if (raw.includes('sofa') || raw.includes('khách') || raw.includes('living')) return 'sofa';
  if (raw.includes('bed') || raw.includes('ngủ') || raw.includes('sleep')) return 'moon';
  if (raw.includes('utensils') || raw.includes('bếp') || raw.includes('ăn') || raw.includes('kitchen')) return 'coffee';
  if (raw.includes('bath') || raw.includes('tắm') || raw.includes('wc') || raw.includes('vệ sinh')) return 'droplet';
  if (raw.includes('briefcase') || raw.includes('làm việc') || raw.includes('office')) return 'briefcase';
  if (raw.includes('leaf') || raw.includes('ban công') || raw.includes('garden') || raw.includes('sân')) return 'leaf';
  if (raw.includes('camera')) return 'camera';
  if (raw.includes('snowflake') || raw.includes('điều hòa') || raw.includes('ac')) return 'snowflake';
  if (raw.includes('lamp') || raw.includes('đèn') || raw.includes('light')) return 'lamp';
  if (raw.includes('sensor') || raw.includes('cảm biến') || raw.includes('gauge')) return 'gauge';
  if (raw.includes('shield') || raw.includes('an ninh')) return 'shield';
  return 'door';
}

function isDeviceActive(d: DeviceResponse): boolean {
  return (
    d.currentState?.power === 'ON' ||
    d.currentState?.power === true ||
    d.currentState?.power === 'true' ||
    d.currentState?.state === 'ON' ||
    d.currentState?.state === true ||
    d.currentState?.state === 'true'
  );
}

export const HomeRoomsWidget: React.FC<HomeRoomsWidgetProps> = ({
  homeId: _homeId,
  rooms,
  devices,
  selectedRoomId,
  onSelectRoom,
  onOpenAddRoom,
}) => {
  // 1. All devices aggregate
  const allActiveCount = devices.filter(isDeviceActive).length;

  // 2. Real rooms from backend
  const mappedRooms = rooms.map((r) => {
    const roomDevs = devices.filter((d) => d.roomId === r.id);
    const activeCount = roomDevs.filter(isDeviceActive).length;
    return {
      id: r.id,
      name: r.name,
      count: roomDevs.length,
      activeCount,
      icon: resolveRoomIcon(r.icon, r.name),
    };
  });

  // 3. Unassigned devices group if any exist
  const unassignedDevs = devices.filter((d) => !d.roomId);
  const unassignedActiveCount = unassignedDevs.filter(isDeviceActive).length;

  return (
    <section className="rooms glass-g2">
      <div className="section-head">
        <div>
          <span className="eyebrow">KHÔNG GIAN</span>
          <h2>Phòng</h2>
        </div>

        <div className="flex items-center gap-2">
          {onOpenAddRoom && (
            <button
              type="button"
              className="text-button"
              onClick={onOpenAddRoom}
              title="Thêm phòng mới"
            >
              <Icon name="plus" size={17} />
              <span>Thêm</span>
            </button>
          )}
        </div>
      </div>

      <div className="room-list">
        {/* Always render 'Tất cả phòng' first */}
        <button
          type="button"
          className={`room-item shrink-0 min-w-[175px] sm:min-w-0 ${selectedRoomId === null ? 'active' : ''} ${devices.length === 0 ? 'empty' : ''}`}
          onClick={() => onSelectRoom(null)}
        >
          <span className="room-icon">
            <Icon name="home" size={18} />
          </span>

          <span className="room-copy">
            <strong>Tất cả phòng</strong>
            <small>
              {devices.length} thiết bị{allActiveCount > 0 ? ` · ${allActiveCount} đang bật` : ''}
            </small>
          </span>

          <Icon name="chevron" size={16} />
        </button>

        {/* Real Backend Rooms */}
        {mappedRooms.map((room) => {
          const isSelected = selectedRoomId === room.id;
          const isEmpty = room.count === 0;

          return (
            <button
              key={room.id}
              type="button"
              className={`room-item shrink-0 min-w-[175px] sm:min-w-0 ${isSelected ? 'active' : ''} ${isEmpty ? 'empty' : ''}`}
              onClick={() => onSelectRoom(room.id)}
            >
              <span className="room-icon">
                <Icon name={room.icon} size={18} />
              </span>

              <span className="room-copy">
                <strong>{room.name}</strong>
                <small>
                  {room.count} thiết bị{room.activeCount > 0 ? ` · ${room.activeCount} đang bật` : ''}
                </small>
              </span>

              <Icon name="chevron" size={16} />
            </button>
          );
        })}

        {/* Unassigned Devices Group */}
        {unassignedDevs.length > 0 && (
          <button
            type="button"
            className={`room-item shrink-0 min-w-[175px] sm:min-w-0 ${selectedRoomId === '__unassigned__' ? 'active' : ''}`}
            onClick={() => onSelectRoom('__unassigned__')}
          >
            <span className="room-icon">
              <Icon name="door" size={18} />
            </span>

            <span className="room-copy">
              <strong>Chưa phân phòng</strong>
              <small>
                {unassignedDevs.length} thiết bị{unassignedActiveCount > 0 ? ` · ${unassignedActiveCount} đang bật` : ''}
              </small>
            </span>

            <Icon name="chevron" size={16} />
          </button>
        )}
      </div>
    </section>
  );
};
