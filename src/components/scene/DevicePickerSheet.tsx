import React, { useState, useMemo } from 'react';
import type { DeviceSummary } from '../../types/automation';
import { Icon, type IconName } from '../home/HomeIcons';
import { getFigmaIconForDevice } from './ScenePage';

interface DevicePickerSheetProps {
  devices: DeviceSummary[];
  selectedDeviceId?: string;
  onSelect: (device: DeviceSummary) => void;
  onClose: () => void;
}

const SENSOR_TYPES = ['SENSOR', 'TEMP_HUMID', 'MOTION', 'SMOKE', 'DOOR_SENSOR', 'WATER_LEAK'];

export function isDeviceControllable(device: DeviceSummary): boolean {
  const type = (device.deviceType || '').toUpperCase();
  return !SENSOR_TYPES.some((s) => type.includes(s));
}

export function getDeviceTypeLabel(device: DeviceSummary): string {
  const type = (device.deviceType || '').toUpperCase();
  if (type.includes('LED_RGB') || (type.includes('LIGHT') && type.includes('RGB'))) return 'Đèn RGB';
  if (type.includes('LIGHT') || type.includes('LED') || type.includes('LAMP')) return 'Đèn chiếu sáng';
  if (type.includes('AC') || type.includes('AIR')) return 'Điều hòa';
  if (type.includes('GATE') || type.includes('ROLLING_DOOR') || type.includes('DOOR')) return 'Cổng tự động';
  if (type.includes('FAN')) return 'Quạt điện';
  if (type.includes('PUMP')) return 'Máy bơm';
  if (type.includes('LOCK')) return 'Khóa thông minh';
  if (type.includes('SOCKET') || type.includes('PLUG')) return 'Ổ cắm điện';
  if (type.includes('SENSOR') || type.includes('TEMP')) return 'Cảm biến';
  return device.deviceType || 'Thiết bị';
}

export const DevicePickerSheet: React.FC<DevicePickerSheetProps> = ({
  devices,
  selectedDeviceId,
  onSelect,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<string>('Tất cả');

  // Extract available rooms
  const rooms = useMemo(() => {
    const set = new Set<string>();
    devices.forEach((d) => {
      const room = d.roomName || d.room || 'Khác';
      set.add(room);
    });
    return ['Tất cả', ...Array.from(set)];
  }, [devices]);

  // Separate controllable devices vs read-only sensors
  const { controllable, sensors } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = devices.filter((d) => {
      const matchSearch =
        !q ||
        d.name.toLowerCase().includes(q) ||
        (d.roomName && d.roomName.toLowerCase().includes(q)) ||
        (d.deviceType && d.deviceType.toLowerCase().includes(q));

      const room = d.roomName || d.room || 'Khác';
      const matchRoom = selectedRoom === 'Tất cả' || room === selectedRoom;

      return matchSearch && matchRoom;
    });

    const ctrl: DeviceSummary[] = [];
    const sens: DeviceSummary[] = [];

    filtered.forEach((d) => {
      if (isDeviceControllable(d)) {
        ctrl.push(d);
      } else {
        sens.push(d);
      }
    });

    return { controllable: ctrl, sensors: sens };
  }, [devices, search, selectedRoom]);

  // Group controllable devices by room
  const groupedControllable = useMemo(() => {
    const groups: Record<string, DeviceSummary[]> = {};
    controllable.forEach((d) => {
      const room = d.roomName || d.room || 'Phòng khác';
      if (!groups[room]) groups[room] = [];
      groups[room].push(d);
    });
    return groups;
  }, [controllable]);

  return (
    <div className="sub-sheet-layer">
      <header className="sub-sheet-header">
        <strong>Chọn thiết bị</strong>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Đóng"
        >
          <span className="text-xl leading-none">×</span>
        </button>
      </header>

      <div className="sub-sheet-scroll">
        {/* Search Field */}
        <input
          autoFocus
          className="picker-search"
          placeholder="Tìm theo tên thiết bị hoặc phòng..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Room Filter Strip */}
        <div className="picker-room-chips">
          {rooms.map((room) => (
            <button
              key={room}
              type="button"
              className={`command-chip ${selectedRoom === room ? 'active' : ''}`}
              onClick={() => setSelectedRoom(room)}
            >
              {room}
            </button>
          ))}
        </div>

        {/* Controllable Devices Grouped by Room */}
        {Object.keys(groupedControllable).length > 0 ? (
          Object.entries(groupedControllable).map(([roomName, roomDevs]) => (
            <div key={roomName} className="space-y-2">
              <span className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block">
                {roomName} ({roomDevs.length})
              </span>
              <div className="space-y-2">
                {roomDevs.map((dev) => {
                  const isSelected = dev.id === selectedDeviceId;
                  const isOnline = dev.online !== false && dev.status !== 'OFFLINE';
                  const iconName: IconName = getFigmaIconForDevice(dev.deviceType, dev.name);

                  return (
                    <div
                      key={dev.id}
                      role="button"
                      tabIndex={0}
                      className={`picker-device-row ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        onSelect(dev);
                        onClose();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          onSelect(dev);
                          onClose();
                        }
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="action-step-bubble-36">
                          <Icon name={iconName} size={18} />
                        </div>
                        <div className="min-w-0">
                          <strong className="text-xs font-semibold text-[var(--text)] block truncate">
                            {dev.name}
                          </strong>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-[var(--tertiary)]">
                              {getDeviceTypeLabel(dev)}
                            </span>
                            <span className="text-[10px] text-[var(--tertiary)]">·</span>
                            <span className="flex items-center gap-1 text-[10px]">
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                                }`}
                              />
                              <span className={isOnline ? 'text-emerald-600' : 'text-slate-400'}>
                                {isOnline ? 'Trực tuyến' : 'Ngoại tuyến'}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-[var(--accent)] text-white flex items-center justify-center shrink-0">
                          <Icon name="check" size={14} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : controllable.length === 0 && sensors.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--tertiary)]">
            Không tìm thấy thiết bị nào phù hợp.
          </div>
        ) : null}

        {/* Read-only Sensors Section (Dimmed, non-selectable) */}
        {sensors.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-2 opacity-60">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[var(--tertiary)] uppercase tracking-wider">
                Cảm biến ({sensors.length})
              </span>
              <span className="text-[10px] text-[var(--tertiary)] italic">
                Chỉ đọc · không thể điều khiển
              </span>
            </div>
            <div className="space-y-2">
              {sensors.map((sensor) => (
                <div
                  key={sensor.id}
                  className="picker-device-row disabled"
                  title="Cảm biến chỉ đọc, không thể đưa vào hành động kịch bản"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="action-step-bubble-36">
                      <Icon name="activity" size={18} />
                    </div>
                    <div className="min-w-0">
                      <strong className="text-xs text-[var(--text)] block truncate">
                        {sensor.name}
                      </strong>
                      <span className="text-[10px] text-[var(--tertiary)]">
                        {sensor.roomName || 'Cảm biến'} · Chỉ đọc
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
