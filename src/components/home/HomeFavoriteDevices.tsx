import React, { useState } from 'react';
import {
  Lightbulb,
  Snowflake,
  Thermometer,
  DoorClosed,
  ChevronRight,
  MoreVertical,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import type { DeviceResponse } from '../../types/device';
import { sendManualPowerCommand, setAcPower, sendDeviceCommand, openGate, closeGate } from '../../services/deviceApi';
import { notify } from '../ui/notify';

interface HomeFavoriteDevicesProps {
  homeId?: string;
  devices: DeviceResponse[];
  selectedRoomId: string | null;
  onRefreshDevices?: () => void;
}

export const HomeFavoriteDevices: React.FC<HomeFavoriteDevicesProps> = ({
  homeId,
  devices,
  selectedRoomId,
  onRefreshDevices,
}) => {
  const navigate = useNavigate();

  // Filter devices by selected room if any
  const filteredDevices = selectedRoomId
    ? devices.filter((d) => d.roomId === selectedRoomId)
    : devices;

  // Local state for interactive sliders/toggles for responsiveness
  const [localPowerState, setLocalPowerState] = useState<Record<string, boolean>>({});
  const [localBrightness, setLocalBrightness] = useState<Record<string, number>>({});

  // ── Mock Fallback Devices matching Figma when home is empty ──
  const mockDevices = [
    {
      id: 'mock-light-1',
      name: 'Đèn ngủ',
      type: 'LIGHT',
      roomName: 'Phòng ngủ',
      power: true,
      brightness: 12,
    },
    {
      id: 'mock-ac-1',
      name: 'Điều hòa Casper',
      type: 'AIR_CONDITIONER',
      roomName: 'Phòng khách',
      power: true,
      temp: 26,
      mode: 'Lạnh',
    },
    {
      id: 'mock-sensor-1',
      name: 'Cảm biến nhiệt ẩm',
      type: 'TEMP_HUMID_SENSOR',
      roomName: 'Phòng khách',
      temp: 27.7,
      humidity: 61.8,
    },
    {
      id: 'mock-gate-1',
      name: 'Cổng chính',
      type: 'GATE',
      roomName: 'Sân trước',
      power: false,
      statusText: 'Đã dừng',
    },
  ];

  const getDevicePower = (device: DeviceResponse | (typeof mockDevices)[0]) => {
    if (localPowerState[device.id] !== undefined) {
      return localPowerState[device.id];
    }
    if ('currentState' in device && device.currentState) {
      const p = device.currentState.power;
      return p === 'ON' || p === true || p === 'true';
    }
    if ('power' in device) {
      return Boolean(device.power);
    }
    return false;
  };

  const handleToggleLight = async (deviceId: string, currentOn: boolean) => {
    const nextOn = !currentOn;
    setLocalPowerState((prev) => ({ ...prev, [deviceId]: nextOn }));

    try {
      if (!deviceId.startsWith('mock-')) {
        await sendManualPowerCommand(deviceId, nextOn ? 'TURN_ON' : 'TURN_OFF');
        onRefreshDevices?.();
      }
      notify.success(nextOn ? 'Đã bật đèn' : 'Đã tắt đèn');
    } catch (err: unknown) {
      console.warn('Command error:', err);
      notify.info(`Đã gửi lệnh ${nextOn ? 'bật' : 'tắt'}`);
    }
  };

  const handleToggleAc = async (deviceId: string, currentOn: boolean) => {
    const nextOn = !currentOn;
    setLocalPowerState((prev) => ({ ...prev, [deviceId]: nextOn }));

    try {
      if (!deviceId.startsWith('mock-')) {
        await setAcPower(deviceId, nextOn);
        onRefreshDevices?.();
      }
      notify.success(nextOn ? 'Đã bật điều hòa' : 'Đã tắt điều hòa');
    } catch (err: unknown) {
      console.warn('AC command error:', err);
      notify.info(`Đã gửi lệnh điều hòa ${nextOn ? 'bật' : 'tắt'}`);
    }
  };

  const handleToggleGate = async (deviceId: string, currentOn: boolean) => {
    const nextOn = !currentOn;
    setLocalPowerState((prev) => ({ ...prev, [deviceId]: nextOn }));

    try {
      if (!deviceId.startsWith('mock-')) {
        if (nextOn) await openGate(deviceId);
        else await closeGate(deviceId);
        onRefreshDevices?.();
      }
      notify.success(nextOn ? 'Đã kích hoạt mở cổng' : 'Đã kích hoạt đóng cổng');
    } catch (err: unknown) {
      console.warn('Gate command error:', err);
      notify.info('Đã gửi tín hiệu điều khiển cổng');
    }
  };

  const handleBrightnessChange = async (deviceId: string, val: number) => {
    setLocalBrightness((prev) => ({ ...prev, [deviceId]: val }));
    try {
      if (!deviceId.startsWith('mock-')) {
        await sendDeviceCommand(deviceId, 'SET_BRIGHTNESS', { brightness: val });
      }
    } catch (err) {
      console.warn('Brightness error:', err);
    }
  };

  const handleViewAll = () => {
    if (homeId) {
      navigate(`/home/${encodeURIComponent(homeId)}/devices`);
    } else {
      notify.info('Hãy chọn hoặc tạo một ngôi nhà để quản lý toàn bộ thiết bị.');
    }
  };

  const displayList = filteredDevices.length > 0 ? filteredDevices : mockDevices;

  return (
    <div className="space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Yêu thích</p>
          <h3 className="text-xl font-bold tracking-tight text-text">Thiết bị của bạn</h3>
        </div>

        <button
          type="button"
          onClick={handleViewAll}
          className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-hover transition-colors cursor-pointer group"
        >
          <span>Xem tất cả</span>
          <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      {/* Grid of Devices (Exact 2x2 layout in Figma) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {displayList.map((item) => {
          const isReal = 'currentState' in item;
          const id = item.id;
          const name = item.name;
          const room = item.roomName ?? 'Phòng khách';
          const type = isReal ? (item as DeviceResponse).deviceType : (item as any).type;
          const isOn = getDevicePower(item);

          // ── Light Card ──
          if (type === 'LIGHT' || type === 'LED_RGB' || type === 'SMART_PLUG') {
            const currentBright =
              localBrightness[id] ??
              (isReal && typeof (item as any).currentState?.brightness === 'number'
                ? (item as any).currentState.brightness
                : (item as any).brightness ?? 12);

            return (
              <div
                key={id}
                className="surface-card p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:border-primary/40 hover:shadow-soft transition-all space-y-4 flex flex-col justify-between"
              >
                <div className="flex items-start justify-between">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-colors ${
                    isOn ? 'bg-blue-100 text-blue-600 dark:bg-blue-950/60' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                  }`}>
                    <Lightbulb className="w-5 h-5" />
                  </div>

                  {/* Toggle Switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isOn}
                    onClick={() => handleToggleLight(id, isOn)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isOn ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        isOn ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div>
                  <h4 className="text-base font-bold text-text truncate">{name}</h4>
                  <p className="text-xs text-muted mt-0.5">
                    {isOn ? `Đang bật · ${currentBright}%` : 'Đang tắt'}
                  </p>
                </div>

                {/* Brightness Slider & 12% text on right */}
                <div className="flex items-center gap-3 pt-1">
                  <div className="relative flex-1 h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden cursor-pointer">
                    <div
                      style={{ width: `${currentBright}%` }}
                      className={`h-full rounded-full transition-all duration-300 ${
                        isOn ? 'bg-primary' : 'bg-slate-300'
                      }`}
                    />
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={currentBright}
                      disabled={!isOn}
                      onChange={(e) => handleBrightnessChange(id, Number(e.target.value))}
                      className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed w-full"
                    />
                  </div>
                  <span className="text-xs font-bold text-muted w-8 text-right">{currentBright}%</span>
                </div>
              </div>
            );
          }

          // ── Air Conditioner Card ──
          if (type === 'AIR_CONDITIONER' || type === 'AC') {
            const temp = (item as any).currentState?.temperature ?? (item as any).temp ?? 26;
            return (
              <div
                key={id}
                className="surface-card p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:border-primary/40 hover:shadow-soft transition-all space-y-4 flex flex-col justify-between"
              >
                <div className="flex items-start justify-between">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-colors ${
                    isOn ? 'bg-blue-100 text-blue-600 dark:bg-blue-950/60' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                  }`}>
                    <Snowflake className="w-5 h-5" />
                  </div>

                  {/* Toggle Switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isOn}
                    onClick={() => handleToggleAc(id, isOn)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isOn ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        isOn ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div>
                  <h4 className="text-base font-bold text-text truncate">{name}</h4>
                  <p className="text-xs text-muted mt-0.5">
                    {isOn ? `Lạnh · ${temp}°C` : 'Đang tắt'}
                  </p>
                  <p className="text-[11px] text-muted/70 mt-1">{room}</p>
                </div>
              </div>
            );
          }

          // ── Temp/Humid Sensor Card ──
          if (type.includes('SENSOR')) {
            const temp = (item as any).currentState?.temperature ?? (item as any).temp ?? 27.7;
            const humidity = (item as any).currentState?.humidity ?? (item as any).humidity ?? 61.8;

            return (
              <div
                key={id}
                className="surface-card p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:border-primary/40 hover:shadow-soft transition-all space-y-3 flex flex-col justify-between"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 dark:bg-amber-950/40">
                    <Thermometer className="w-5 h-5" />
                  </div>
                  <button
                    type="button"
                    aria-label="Tùy chọn"
                    className="p-1 rounded-xl text-icon hover:bg-slate-100 transition-colors"
                  >
                    <MoreVertical className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                <div>
                  <div className="text-3xl font-extrabold tracking-tight text-text">
                    {temp}°
                  </div>
                  <h4 className="text-base font-bold text-text truncate mt-1">{name}</h4>
                  <p className="text-xs text-muted mt-0.5">Độ ẩm {humidity}%</p>
                  <p className="text-[11px] text-muted/70 mt-1">{room}</p>
                </div>
              </div>
            );
          }

          // ── Gate / Rolling Door Card ──
          return (
            <div
              key={id}
              className="surface-card p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:border-primary/40 hover:shadow-soft transition-all space-y-4 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-colors ${
                  isOn ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                }`}>
                  <DoorClosed className="w-5 h-5" />
                </div>

                {/* Toggle Switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={isOn}
                  onClick={() => handleToggleGate(id, isOn)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isOn ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      isOn ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div>
                <h4 className="text-base font-bold text-text truncate">{name}</h4>
                <p className="text-xs text-muted mt-0.5">
                  {isOn ? 'Đang mở' : 'Đã dừng'}
                </p>
                <p className="text-[11px] text-muted/70 mt-1">{room}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
