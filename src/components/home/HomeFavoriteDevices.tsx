import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Icon, IconButton, type IconName } from './HomeIcons';
import type { DeviceResponse } from '../../types/device';
import { sendManualPowerCommand, setAcPower, sendDeviceCommand } from '../../services/deviceApi';
import { notify } from '../ui/notify';

interface HomeFavoriteDevicesProps {
  homeId?: string;
  devices: DeviceResponse[];
  selectedRoomId: string | null;
  onRefreshDevices?: () => void;
}

interface DashboardDeviceItem {
  id: string;
  name: string;
  status: string;
  room: string;
  icon: IconName;
  on?: boolean;
  offline?: boolean;
  sensor?: string;
  slider?: boolean;
  brightness?: number;
  realDeviceId?: string;
}

export const HomeFavoriteDevices: React.FC<HomeFavoriteDevicesProps> = ({
  homeId,
  devices,
  selectedRoomId,
  onRefreshDevices,
}) => {
  const navigate = useNavigate();

  // Local interactive states for responsiveness
  const [localPower, setLocalPower] = useState<Record<string, boolean>>({});
  const [localBrightness, setLocalBrightness] = useState<Record<string, number>>({});

  // 8 default devices matching Figma design
  const defaultFigmaDevices: DashboardDeviceItem[] = [
    {
      id: 'mock-1',
      name: 'Đèn ngủ',
      status: 'Đang bật · 12%',
      room: 'Phòng ngủ',
      icon: 'lamp',
      on: true,
      slider: true,
      brightness: 12,
    },
    {
      id: 'mock-2',
      name: 'Điều hòa Casper',
      status: 'Lạnh · 26°C',
      room: 'Phòng khách',
      icon: 'snowflake',
      on: true,
    },
    {
      id: 'mock-3',
      name: 'Cảm biến nhiệt ẩm',
      status: 'Độ ẩm 61.8%',
      room: 'Phòng khách',
      icon: 'thermometer',
      sensor: '27.7°',
    },
    {
      id: 'mock-4',
      name: 'Cổng chính',
      status: 'Đã dừng',
      room: 'Sân trước',
      icon: 'door',
      on: false,
    },
    {
      id: 'mock-5',
      name: 'Cảm biến ánh sáng',
      status: 'Trời sáng',
      room: 'Ban công',
      icon: 'sun',
      sensor: '820',
    },
    {
      id: 'mock-6',
      name: 'Cảm biến chuyển động',
      status: 'Bình thường',
      room: 'Hành lang',
      icon: 'activity',
      sensor: 'Tĩnh',
    },
    {
      id: 'mock-7',
      name: 'Camera sân',
      status: 'Ngoại tuyến',
      room: 'Sân trước',
      icon: 'camera',
      offline: true,
    },
    {
      id: 'mock-8',
      name: 'Khóa cửa chính',
      status: 'Đã khóa',
      room: 'Sảnh',
      icon: 'lock',
      on: false,
    },
  ];

  // Map real devices to item defs
  const mappedRealDevices: DashboardDeviceItem[] = devices.map((d) => {
    const isPowerOn =
      localPower[d.id] !== undefined
        ? localPower[d.id]
        : d.currentState?.power === 'ON' || d.currentState?.power === true || d.currentState?.power === 'true';

    let icon: IconName = 'lamp';
    let isSensor = false;
    let sensorVal: string | undefined;
    let hasSlider = false;
    let brightnessVal = localBrightness[d.id] ?? (d.currentState?.brightness ? Number(d.currentState.brightness) : 80);

    const typeStr = d.deviceType?.toUpperCase() || '';
    if (typeStr.includes('LIGHT') || typeStr.includes('LED')) {
      icon = 'lamp';
      hasSlider = isPowerOn;
    } else if (typeStr.includes('AIR') || typeStr.includes('CLIMATE') || typeStr.includes('AC')) {
      icon = 'snowflake';
    } else if (typeStr.includes('GATE') || typeStr.includes('DOOR')) {
      icon = 'door';
    } else if (typeStr.includes('LOCK')) {
      icon = 'lock';
    } else if (typeStr.includes('CAMERA')) {
      icon = 'camera';
    } else if (typeStr.includes('TEMP') || typeStr.includes('HUMID')) {
      icon = 'thermometer';
      isSensor = true;
      sensorVal = d.currentState?.temperature ? `${d.currentState.temperature}°` : '27.7°';
    } else if (typeStr.includes('MOTION')) {
      icon = 'activity';
      isSensor = true;
      sensorVal = 'Tĩnh';
    } else if (typeStr.includes('SUN') || typeStr.includes('LUX')) {
      icon = 'sun';
      isSensor = true;
      sensorVal = '820';
    }

    let statusText = isPowerOn ? 'Đang bật' : 'Đã tắt';
    if (hasSlider) {
      statusText = `${isPowerOn ? 'Đang bật' : 'Đã tắt'} · ${brightnessVal}%`;
    } else if (icon === 'snowflake') {
      statusText = isPowerOn ? `Lạnh · ${d.currentState?.temperature || 26}°C` : 'Đã tắt';
    } else if (isSensor && icon === 'thermometer') {
      statusText = `Độ ẩm ${d.currentState?.humidity || 61.8}%`;
    } else if (icon === 'door') {
      statusText = isPowerOn ? 'Đang mở' : 'Đã dừng';
    }

    return {
      id: d.id,
      name: d.name,
      status: statusText,
      room: d.roomName || 'Phòng khách',
      icon,
      on: isPowerOn,
      offline: d.status === 'OFFLINE',
      sensor: sensorVal,
      slider: hasSlider,
      brightness: brightnessVal,
      realDeviceId: d.id,
    };
  });

  // Filter devices by selected room
  let displayList: DashboardDeviceItem[];
  if (selectedRoomId) {
    const roomFiltered = devices.filter((d) => d.roomId === selectedRoomId);
    displayList = roomFiltered.length > 0 ? mappedRealDevices.filter((d) => roomFiltered.some((rf) => rf.id === d.id)) : [];
  } else {
    // If not enough devices exist to fill the 8-card grid, blend or use Figma items
    if (mappedRealDevices.length >= 8) {
      displayList = mappedRealDevices.slice(0, 8);
    } else if (mappedRealDevices.length > 0) {
      displayList = [
        ...mappedRealDevices,
        ...defaultFigmaDevices.slice(mappedRealDevices.length),
      ];
    } else {
      displayList = defaultFigmaDevices;
    }
  }

  const handleToggle = async (device: DashboardDeviceItem) => {
    const nextOn = !device.on;
    setLocalPower((prev) => ({ ...prev, [device.id]: nextOn }));

    if (device.realDeviceId) {
      try {
        if (device.icon === 'snowflake') {
          await setAcPower(device.realDeviceId, nextOn);
        } else {
          await sendManualPowerCommand(device.realDeviceId, nextOn ? 'TURN_ON' : 'TURN_OFF');
        }
        onRefreshDevices?.();
        notify.success(`${nextOn ? 'Đã bật' : 'Đã tắt'} ${device.name}`);
      } catch (err: unknown) {
        console.warn('Toggle device error:', err);
        notify.info(`Đã gửi lệnh ${nextOn ? 'bật' : 'tắt'} ${device.name}`);
      }
    } else {
      notify.success(`${nextOn ? 'Đã bật' : 'Đã tắt'} ${device.name}`);
    }
  };

  const handleBrightnessChange = async (device: DashboardDeviceItem, e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newPercent = Math.min(100, Math.max(10, Math.round((clickX / rect.width) * 100)));
    setLocalBrightness((prev) => ({ ...prev, [device.id]: newPercent }));

    if (device.realDeviceId) {
      try {
        await sendDeviceCommand(
          device.realDeviceId,
          'SET_BRIGHTNESS',
          { brightness: newPercent },
        );
        notify.success(`Độ sáng: ${newPercent}%`);
      } catch (err: unknown) {
        console.warn('Set brightness error:', err);
      }
    }
  };

  const handleSeeAll = () => {
    if (homeId) {
      navigate(`/home/${encodeURIComponent(homeId)}/devices`);
    } else {
      notify.info('Hãy chọn hoặc tạo một ngôi nhà trước.');
    }
  };

  return (
    <section className="devices">
      <div className="section-head">
        <div>
          <span className="eyebrow">YÊU THÍCH</span>
          <h2>Thiết bị của bạn</h2>
        </div>

        <button
          type="button"
          className="text-button"
          onClick={handleSeeAll}
          title="Xem toàn bộ danh sách thiết bị"
        >
          <span>Xem tất cả</span>
          <Icon name="chevron" size={16} />
        </button>
      </div>

      <div className="device-grid">
        {displayList.map((device) => {
          const isOn = localPower[device.id] !== undefined ? localPower[device.id] : device.on;
          const currentBrightness = localBrightness[device.id] ?? device.brightness ?? 12;

          return (
            <article
              key={device.id}
              className={`device-card glass-g1 ${isOn ? 'on' : ''} ${
                device.offline ? 'offline' : ''
              }`}
              tabIndex={0}
            >
              <div className="device-top">
                <span className="device-icon">
                  <Icon name={device.icon} />
                </span>

                {device.offline ? (
                  <span className="offline-dot" title="Ngoại tuyến" />
                ) : device.sensor ? (
                  <IconButton
                    icon="more"
                    label={`Tùy chọn ${device.name}`}
                    onClick={handleSeeAll}
                  />
                ) : (
                  <button
                    type="button"
                    className={`toggle ${isOn ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(device);
                    }}
                    aria-label={`${isOn ? 'Tắt' : 'Bật'} ${device.name}`}
                    aria-pressed={isOn}
                  >
                    <span />
                  </button>
                )}
              </div>

              {device.sensor && (
                <strong className="sensor-value">{device.sensor}</strong>
              )}

              <div className="device-copy">
                <h3 title={device.name}>{device.name}</h3>
                <p>
                  {device.slider
                    ? `${isOn ? 'Đang bật' : 'Đã tắt'} · ${currentBrightness}%`
                    : device.status}
                </p>
              </div>

              {device.slider ? (
                <div
                  className="brightness"
                  aria-label={`Độ sáng ${currentBrightness}%`}
                  title="Nhấp để chỉnh độ sáng"
                  onClick={(e) => handleBrightnessChange(device, e)}
                >
                  <span style={{ width: `${currentBrightness}%` }} />
                  <b>{currentBrightness}%</b>
                </div>
              ) : (
                <span className="room-label">{device.room}</span>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};
