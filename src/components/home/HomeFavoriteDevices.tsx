import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Icon, IconButton } from './HomeIcons';
import type { DeviceResponse } from '../../types/device';
import {
  sendManualPowerCommand,
  setAcPower,
  setAcTemperature,
  sendDeviceCommand,
} from '../../services/deviceApi';
import { notify } from '../ui/notify';
import { getErrorMessage } from '../../utils/errors';
import { ApiError } from '../../services/apiClient';
import { invalidateCache } from '../../services/queryCache';
import { DeviceDetailModal } from '../device/DeviceDetailModal';
import { mapDeviceToUI, type UIMappedDevice } from '../device/devicePageHelpers';

interface HomeFavoriteDevicesProps {
  homeId?: string;
  devices: DeviceResponse[];
  selectedRoomId: string | null;
  onRefreshDevices?: () => void;
  onDeviceUpdated?: (updated: DeviceResponse) => void;
  onDeviceDeleted?: (deletedId: string) => void;
}

export const HomeFavoriteDevices: React.FC<HomeFavoriteDevicesProps> = ({
  homeId,
  devices,
  selectedRoomId,
  onRefreshDevices,
  onDeviceUpdated,
  onDeviceDeleted,
}) => {
  const navigate = useNavigate();

  // Local interactive states for responsiveness
  const [localPower, setLocalPower] = useState<Record<string, boolean>>({});
  const [localBrightness, setLocalBrightness] = useState<Record<string, number>>({});
  const [localAcTemp, setLocalAcTemp] = useState<Record<string, number>>({});
  const [selectedDetail, setSelectedDetail] = useState<UIMappedDevice | null>(null);

  // Clear optimistic overrides ONLY for the specific device(s) whose authoritative state actually changed.
  // Never wipe all devices when an unrelated sensor or another device emits a WebSocket update.
  const [prevDevices, setPrevDevices] = useState(devices);
  if (devices !== prevDevices) {
    const prevById = new Map(prevDevices.map((d) => [d.id, d]));
    const changedIds: string[] = [];
    for (const d of devices) {
      const prev = prevById.get(d.id);
      if (!prev || prev.currentState !== d.currentState || prev.status !== d.status) {
        changedIds.push(d.id);
      }
    }
    setPrevDevices(devices);
    if (changedIds.length > 0) {
      const clearIds = <T,>(map: Record<string, T>): Record<string, T> => {
        let touched = false;
        const next = { ...map };
        for (const id of changedIds) {
          if (id in next) {
            delete next[id];
            touched = true;
          }
        }
        return touched ? next : map;
      };
      setLocalPower(clearIds);
      setLocalBrightness(clearIds);
      setLocalAcTemp(clearIds);
    }
  }

  // Filter devices by accessLevel & selected room, and keep deterministic stable order
  const filteredRawDevices = devices
    .filter((d) => {
      if (d.accessLevel === 'NONE') return false;
      if (!selectedRoomId) return true;
      if (selectedRoomId === '__unassigned__') return !d.roomId;
      return d.roomId === selectedRoomId;
    })
    .sort((a, b) => {
      const aTime = a.createdAt ? Date.parse(a.createdAt) : Number.NaN;
      const bTime = b.createdAt ? Date.parse(b.createdAt) : Number.NaN;
      if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
        return aTime - bTime;
      }
      return a.id.localeCompare(b.id);
    });

  // Map real filtered devices to UIMappedDevice
  const uiDevices: UIMappedDevice[] = filteredRawDevices.map((d) =>
    mapDeviceToUI(d, localPower, localBrightness)
  );

  const restoreRecordValue = <T,>(
    setter: React.Dispatch<React.SetStateAction<Record<string, T>>>,
    id: string,
    prevValue: T | undefined
  ) => {
    setter((prev) => {
      const next = { ...prev };
      if (prevValue === undefined) {
        delete next[id];
      } else {
        next[id] = prevValue;
      }
      return next;
    });
  };

  const isReadOnlyDevice = (device: UIMappedDevice) =>
    device.accessLevel === 'VIEW' || device.raw?.accessLevel === 'VIEW';

  const patchDeviceStateInPlace = (
    device: UIMappedDevice,
    patch: Record<string, unknown>,
    acknowledgedState?: Record<string, unknown>,
  ) => {
    if (onDeviceUpdated && device.raw) {
      onDeviceUpdated({
        ...device.raw,
        currentState: {
          ...device.raw.currentState,
          ...patch,
          ...(acknowledgedState ?? {}),
        },
      });
    } else {
      onRefreshDevices?.();
    }
  };

  const handleToggle = async (device: UIMappedDevice) => {
    if (device.offline) return;
    if (isReadOnlyDevice(device)) {
      notify.warning('Bạn chỉ có quyền xem thiết bị này');
      return;
    }
    const prevPower = localPower[device.id];
    const nextOn = !device.on;
    setLocalPower((prev) => ({ ...prev, [device.id]: nextOn }));

    try {
      const command =
        device.type === 'Điều hòa'
          ? await setAcPower(device.id, nextOn)
          : (await sendManualPowerCommand(device.id, nextOn ? 'TURN_ON' : 'TURN_OFF')).command;

      if (command && command.success === false) {
        restoreRecordValue(setLocalPower, device.id, prevPower);
        notify.error(command.message || `Không thể ${nextOn ? 'bật' : 'tắt'} ${device.name}`);
        return;
      }

      patchDeviceStateInPlace(
        device,
        { power: nextOn ? 'ON' : 'OFF' },
        command?.acknowledgedState,
      );
      notify.success(`${nextOn ? 'Đã bật' : 'Đã tắt'} ${device.name}`);
    } catch (err: unknown) {
      restoreRecordValue(setLocalPower, device.id, prevPower);
      if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
        invalidateCache('devices:home:');
        onRefreshDevices?.();
      }
      notify.error(getErrorMessage(err, `Lỗi khi ${nextOn ? 'bật' : 'tắt'} ${device.name}`));
    }
  };

  const handleBrightnessChange = async (
    device: UIMappedDevice,
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    e.stopPropagation();
    if (device.offline) return;
    if (isReadOnlyDevice(device)) return;
    const prevBrightness = localBrightness[device.id];
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newPercent = Math.min(100, Math.max(10, Math.round((clickX / rect.width) * 100)));
    setLocalBrightness((prev) => ({ ...prev, [device.id]: newPercent }));

    try {
      const command = await sendDeviceCommand(device.id, 'SET_BRIGHTNESS', { brightness: newPercent });
      if (command && command.success === false) {
        restoreRecordValue(setLocalBrightness, device.id, prevBrightness);
        notify.error(command.message || 'Không thể chỉnh độ sáng');
        return;
      }
      patchDeviceStateInPlace(
        device,
        { brightness: newPercent },
        command?.acknowledgedState,
      );
      notify.success(`Độ sáng ${device.name}: ${newPercent}%`);
    } catch (err: unknown) {
      restoreRecordValue(setLocalBrightness, device.id, prevBrightness);
      notify.error(getErrorMessage(err, 'Lỗi khi chỉnh độ sáng'));
    }
  };

  const handleSetBrightness = async (device: UIMappedDevice, brightness: number) => {
    if (device.offline) return;
    if (isReadOnlyDevice(device)) return;
    const prevBrightness = localBrightness[device.id];
    setLocalBrightness((prev) => ({ ...prev, [device.id]: brightness }));
    try {
      const command = await sendDeviceCommand(device.id, 'SET_BRIGHTNESS', { brightness });
      if (command && command.success === false) {
        restoreRecordValue(setLocalBrightness, device.id, prevBrightness);
        notify.error(command.message || 'Không thể chỉnh độ sáng');
        return;
      }
      patchDeviceStateInPlace(
        device,
        { brightness },
        command?.acknowledgedState,
      );
    } catch (err: unknown) {
      restoreRecordValue(setLocalBrightness, device.id, prevBrightness);
      notify.error(getErrorMessage(err, 'Lỗi khi chỉnh độ sáng'));
    }
  };

  const handleAdjustAcTemp = async (device: UIMappedDevice, delta: number) => {
    if (device.offline || !device.on) return;
    if (isReadOnlyDevice(device)) {
      notify.warning('Bạn chỉ có quyền xem thiết bị này');
      return;
    }
    const prevTemp = localAcTemp[device.id];
    const currentTemp =
      localAcTemp[device.id] ??
      (device.raw?.currentState?.temperature
        ? Number(device.raw.currentState.temperature)
        : 26);
    const newTemp = Math.min(32, Math.max(16, currentTemp + delta));
    setLocalAcTemp((prev) => ({ ...prev, [device.id]: newTemp }));

    try {
      const command = await setAcTemperature(device.id, newTemp);
      if (command && command.success === false) {
        restoreRecordValue(setLocalAcTemp, device.id, prevTemp);
        notify.error(command.message || 'Không thể điều chỉnh nhiệt độ');
        return;
      }
      notify.success(`Điều hòa ${device.name}: ${newTemp}°C`);
      patchDeviceStateInPlace(
        device,
        { temperature: newTemp },
        command?.acknowledgedState,
      );
    } catch (err: unknown) {
      restoreRecordValue(setLocalAcTemp, device.id, prevTemp);
      notify.error(getErrorMessage(err, 'Lỗi khi điều chỉnh nhiệt độ'));
    }
  };

  const handleSetAcMode = async (device: UIMappedDevice, mode: string) => {
    if (device.offline) return;
    if (isReadOnlyDevice(device)) {
      notify.warning('Bạn chỉ có quyền xem thiết bị này');
      return;
    }
    try {
      const command = await sendDeviceCommand(device.id, 'SET_MODE', { mode });
      if (command && command.success === false) {
        notify.error(command.message || 'Không thể chọn chế độ điều hòa');
        return;
      }
      notify.success(`Chế độ ${device.name}: ${mode}`);
      patchDeviceStateInPlace(
        device,
        { mode },
        command?.acknowledgedState,
      );
    } catch (err: unknown) {
      notify.error(getErrorMessage(err, 'Lỗi khi chọn chế độ điều hòa'));
    }
  };

  const handleGateCommand = async (device: UIMappedDevice, action: string, label: string) => {
    if (device.offline) return;
    try {
      const command = await sendDeviceCommand(device.id, action);
      if (command && command.success === false) {
        notify.error(command.message || `Không thể gửi lệnh ${label}`);
        return;
      }
      notify.success(`Cổng ${device.name}: ${label}`);
      patchDeviceStateInPlace(
        device,
        { state: action },
        command?.acknowledgedState,
      );
    } catch (err: unknown) {
      notify.error(getErrorMessage(err, `Lỗi khi gửi lệnh ${label}`));
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

      {uiDevices.length === 0 ? (
        <div className="w-full py-12 px-6 rounded-3xl bg-[var(--g1)] border border-[var(--border)] text-center flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[var(--solid)] border border-[var(--border)] flex items-center justify-center text-[var(--tertiary)] shadow-xs">
            <Icon name="grid" size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[var(--text)]">Không có thiết bị nào</h3>
            <p className="text-xs text-[var(--secondary)]">
              {selectedRoomId
                ? 'Không tìm thấy thiết bị nào trong phòng đã chọn.'
                : 'Chưa có thiết bị nào trong ngôi nhà này.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSeeAll}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
          >
            <Icon name="plus" size={14} />
            <span>Quản lý thiết bị</span>
          </button>
        </div>
      ) : (
        <div className="device-grid">
          {uiDevices.map((device) => {
            const isOn = Boolean(device.on);
            const currentBrightness = device.brightness ?? 80;
            const rawState = device.raw?.currentState;
            const acTemp =
              localAcTemp[device.id] ??
              (rawState?.temperature ? Number(rawState.temperature) : 26);

            const rgbHex =
              rawState?.r !== undefined
                ? `rgb(${rawState.r}, ${rawState.g}, ${rawState.b})`
                : (rawState?.rgbHex as string | undefined);

            const handleCardClick = () => {
              setSelectedDetail(device);
            };
            const isViewOnly = isReadOnlyDevice(device);

            return (
              <article
                key={device.id}
                className={`device-card glass-g1 ${isOn ? 'on' : ''} ${
                  device.offline ? 'offline' : ''
                }`}
                tabIndex={0}
                onClick={handleCardClick}
                onKeyDown={(e) => e.key === 'Enter' && handleCardClick()}
                style={{ cursor: 'pointer' }}
              >
                <div className="device-top">
                  <div className="flex items-center gap-2">
                    <span className="device-icon">
                      <Icon name={device.icon} />
                    </span>
                    {rgbHex && (
                      <span
                        className="w-3 h-3 rounded-full border border-white/60 shadow-xs"
                        style={{ backgroundColor: rgbHex }}
                        title={`Màu RGB: ${rgbHex}`}
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isViewOnly && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                        Chỉ xem
                      </span>
                    )}
                    {device.offline ? (
                      <span className="offline-dot" title="Ngoại tuyến" />
                    ) : device.type === 'Cảm biến' || device.type === 'Cổng' ? (
                      <IconButton
                        icon="more"
                        label={`Tùy chọn ${device.name}`}
                        onClick={handleCardClick}
                      />
                    ) : isViewOnly ? (
                      <button
                        type="button"
                        disabled
                        className={`toggle ${isOn ? 'active' : ''} opacity-40 cursor-not-allowed`}
                        title="Thiết bị ở chế độ chỉ xem"
                        onClick={(e) => e.stopPropagation()}
                        aria-disabled="true"
                        aria-label={`${device.name} (Chỉ xem)`}
                      >
                        <span />
                      </button>
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
                </div>

                {/* Big sensor value if available */}
                {device.type === 'Cảm biến' && device.value && (
                  <strong className="sensor-value">{device.value}</strong>
                )}

                <div className="device-copy">
                  <h3 title={device.name}>{device.name}</h3>
                  <p>
                    {!device.offline && device.type === 'Đèn'
                      ? `${isOn ? 'Đang bật' : 'Đã tắt'} · ${currentBrightness}%`
                      : device.status}
                  </p>
                </div>

                {/* Interactive Controls per Device Type */}
                {device.type === 'Đèn' ? (
                  <div
                    className={['brightness', device.offline && 'disabled', isViewOnly && 'opacity-60 cursor-default'].filter(Boolean).join(' ')}
                    role="slider"
                    aria-valuemin={10}
                    aria-valuemax={100}
                    aria-valuenow={currentBrightness}
                    aria-disabled={device.offline || isViewOnly}
                    aria-label={
                      device.offline
                        ? `${device.name} đang ngoại tuyến — không thể chỉnh độ sáng`
                        : isViewOnly
                          ? `${device.name} ở chế độ chỉ xem — độ sáng ${currentBrightness}%`
                          : `Độ sáng ${currentBrightness}%`
                    }
                    title={
                      device.offline
                        ? 'Thiết bị đang ngoại tuyến'
                        : isViewOnly
                          ? 'Chế độ chỉ xem'
                          : 'Nhấp để chỉnh độ sáng'
                    }
                    onClick={(e) => handleBrightnessChange(device, e)}
                  >
                    <span style={{ width: `${currentBrightness}%` }} />
                    <b>{currentBrightness}%</b>
                  </div>
                ) : device.type === 'Điều hòa' ? (
                  <div className="w-full space-y-1.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-[var(--border)]">
                      <button
                        type="button"
                        onClick={() => handleAdjustAcTemp(device, -1)}
                        disabled={device.offline || isViewOnly || !isOn || acTemp <= 16}
                        className="w-6 h-6 rounded-md bg-[var(--solid)] border border-[var(--border)] text-xs font-bold flex items-center justify-center hover:bg-[var(--g1)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        title="Giảm nhiệt độ"
                      >
                        -
                      </button>
                      <span className="text-xs font-bold text-[var(--text)]">
                        {acTemp}°C
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAdjustAcTemp(device, 1)}
                        disabled={device.offline || isViewOnly || !isOn || acTemp >= 32}
                        className="w-6 h-6 rounded-md bg-[var(--solid)] border border-[var(--border)] text-xs font-bold flex items-center justify-center hover:bg-[var(--g1)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        title="Tăng nhiệt độ"
                      >
                        +
                      </button>
                    </div>

                    <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                      {(['Lạnh', 'Hút ẩm', 'Sưởi', 'Tự động'] as const).map((m) => {
                        const isCurrentMode =
                          rawState?.mode === m || (!rawState?.mode && m === 'Lạnh');
                        return (
                          <button
                            key={m}
                            type="button"
                            disabled={device.offline || isViewOnly}
                            onClick={() => handleSetAcMode(device, m)}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                              isCurrentMode && isOn
                                ? 'bg-sky-500 text-white'
                                : 'bg-[var(--solid)] text-[var(--secondary)] border border-[var(--border)] hover:bg-[var(--g1)]'
                            }`}
                          >
                            {m}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : device.type === 'Cổng' ? (
                  <div
                    className="grid grid-cols-3 gap-1 w-full pt-1.5 border-t border-[var(--border)]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {(['Mở', 'Dừng', 'Đóng'] as const).map((btn) => {
                      const action = btn === 'Mở' ? 'OPEN' : btn === 'Đóng' ? 'CLOSE' : 'STOP';
                      const rawGateStr = String(rawState?.state ?? 'STOP').toUpperCase();
                      const activeGateLabel =
                        rawGateStr === 'OPEN' || rawGateStr === 'OPENING'
                          ? 'Mở'
                          : rawGateStr === 'CLOSE' || rawGateStr === 'CLOSED' || rawGateStr === 'CLOSING'
                            ? 'Đóng'
                            : 'Dừng';
                      const isGateActive = activeGateLabel === btn;
                      return (
                        <button
                          key={btn}
                          type="button"
                          disabled={device.offline || isViewOnly}
                          onClick={() => !device.offline && !isViewOnly && handleGateCommand(device, action, btn)}
                          className={`py-1 px-1 rounded-md border text-[10px] font-bold transition-colors text-center disabled:opacity-40 disabled:cursor-not-allowed ${
                            device.offline || isViewOnly ? 'cursor-not-allowed' : 'cursor-pointer'
                          } ${
                            isGateActive
                              ? 'bg-primary text-white border-primary shadow-2xs'
                              : 'bg-[var(--solid)] border-[var(--border)] text-[var(--text)] hover:bg-primary hover:text-white'
                          }`}
                        >
                          {btn}
                        </button>
                      );
                    })}
                  </div>
                ) : device.type === 'Cảm biến' ? (
                  <div className="flex flex-wrap items-center gap-1 w-full pt-1 border-t border-[var(--border)]">
                    {rawState?.temperature !== undefined && (
                      <span className="px-1.5 py-0.5 rounded bg-[var(--solid)] border border-[var(--border)] text-[9px] font-medium text-[var(--text)] flex items-center gap-1">
                        <Icon name="thermometer" size={10} />
                        {String(rawState.temperature)}°C
                      </span>
                    )}
                    {rawState?.humidity !== undefined && (
                      <span className="px-1.5 py-0.5 rounded bg-[var(--solid)] border border-[var(--border)] text-[9px] font-medium text-[var(--text)] flex items-center gap-1">
                        <Icon name="droplet" size={10} />
                        {String(rawState.humidity)}%
                      </span>
                    )}
                    {(rawState?.lux !== undefined || rawState?.illuminance !== undefined) && (
                      <span className="px-1.5 py-0.5 rounded bg-[var(--solid)] border border-[var(--border)] text-[9px] font-medium text-[var(--text)] flex items-center gap-1">
                        <Icon name="sun" size={10} />
                        {String(rawState.lux ?? rawState.illuminance)} lx
                      </span>
                    )}
                    {rawState?.motion !== undefined && (
                      <span className="px-1.5 py-0.5 rounded bg-[var(--solid)] border border-[var(--border)] text-[9px] font-medium text-[var(--text)] flex items-center gap-1">
                        <Icon name="activity" size={10} />
                        {rawState.motion ? 'Chuyển động' : 'Tĩnh'}
                      </span>
                    )}
                    {rawState?.smoke !== undefined && (
                      <span
                        className={`px-1.5 py-0.5 rounded border text-[9px] font-medium flex items-center gap-1 ${
                          rawState.smoke
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                            : 'bg-[var(--solid)] border-[var(--border)] text-[var(--text)]'
                        }`}
                      >
                        <Icon name="shield" size={10} />
                        {rawState.smoke ? 'Báo khói!' : 'An toàn'}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="room-label">{device.room}</span>
                )}
              </article>
            );
          })}
        </div>
      )}

      {selectedDetail && (
        <DeviceDetailModal
          device={selectedDetail}
          placement="center"
          onClose={() => setSelectedDetail(null)}
          onDeviceUpdated={(updated) => {
            onDeviceUpdated?.(updated);
            onRefreshDevices?.();
            setSelectedDetail((prev) =>
              prev && prev.id === updated.id
                ? mapDeviceToUI(updated, localPower, localBrightness)
                : prev
            );
          }}
          onDeviceRemoved={(deletedId) => {
            onDeviceDeleted?.(deletedId);
            onRefreshDevices?.();
            setSelectedDetail(null);
          }}
          onTogglePower={() => {
            handleToggle(selectedDetail);
          }}
          onBrightnessChange={(brightness) => {
            handleSetBrightness(selectedDetail, brightness);
          }}
          onColorChange={(r, g, b) => {
            if (selectedDetail.offline) return;
            sendDeviceCommand(selectedDetail.id, 'SET_RGB', {
              r,
              g,
              b,
              brightness: localBrightness[selectedDetail.id] ?? 80,
            }).catch(console.warn);
          }}
        />
      )}
    </section>
  );
};
