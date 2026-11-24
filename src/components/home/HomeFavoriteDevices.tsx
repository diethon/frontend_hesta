import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Icon, IconButton } from './HomeIcons';
import type { DeviceResponse } from '../../types/device';
import {
  sendManualPowerCommand,
  setAcPower,
  sendDeviceCommand,
} from '../../services/deviceApi';
import { notify } from '../ui/notify';
import { getErrorMessage } from '../../utils/errors';
import { ApiError } from '../../services/apiClient';
import { invalidateCache } from '../../services/queryCache';
import { DeviceDetailModal } from '../device/DeviceDetailModal';
import { DeviceVisual } from '../device/DeviceVisual';
import { mapDeviceToUI, type UIMappedDevice } from '../device/devicePageHelpers';
import {
  APERTURE_TRANSIT_LOCK_MS,
  getApertureInterlock,
  isRgbLightDevice,
  resolveDeviceRgb,
  isFanDevice,
  isTvDevice,
  extractSensorMetrics,
  resolveFanSpeedLevel,
  AC_MODE_CODE_TO_LABEL,
} from '../device/deviceHelpers';

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
  const [gateTransitMap, setGateTransitMap] = useState<Record<string, boolean>>({});
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
      setGateTransitMap(clearIds);
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

  const handleColorChange = async (
    device: UIMappedDevice,
    r: number,
    g: number,
    b: number,
  ) => {
    if (device.offline || isReadOnlyDevice(device) || !isRgbLightDevice(device.raw)) return;
    const brightness = localBrightness[device.id] ?? device.brightness ?? 80;
    try {
      const command = await sendDeviceCommand(device.id, 'SET_RGB', { r, g, b, brightness });
      if (command && command.success === false) {
        notify.error(command.message || 'Không thể đổi màu đèn');
        return;
      }
      const colorPatch = { r, g, b, color: { r, g, b } };
      patchDeviceStateInPlace(device, colorPatch, command?.acknowledgedState);
      setSelectedDetail((prev) =>
        prev && prev.id === device.id && prev.raw
          ? mapDeviceToUI(
              {
                ...prev.raw,
                currentState: {
                  ...prev.raw.currentState,
                  ...colorPatch,
                  ...(command?.acknowledgedState ?? {}),
                },
              },
              localPower,
              localBrightness,
            )
          : prev,
      );
    } catch (err: unknown) {
      notify.error(getErrorMessage(err, 'Lỗi khi đổi màu đèn'));
    }
  };

  const handleGateCommand = async (device: UIMappedDevice, action: string, label: string) => {
    if (device.offline || isReadOnlyDevice(device)) return;
    const interlock = getApertureInterlock(device.raw?.currentState?.state, Boolean(gateTransitMap[device.id]));
    if (action === 'OPEN' && interlock.disableOpen) return;
    if (action === 'CLOSE' && interlock.disableClose) return;
    if (action === 'STOP' && interlock.disableStop) return;

    try {
      const command = await sendDeviceCommand(device.id, action);
      if (command && command.success === false) {
        notify.error(command.message || `Không thể gửi lệnh ${label}`);
        return;
      }
      if (action === 'STOP') {
        setGateTransitMap((prev) => {
          const next = { ...prev };
          delete next[device.id];
          return next;
        });
      } else {
        setGateTransitMap((prev) => ({ ...prev, [device.id]: true }));
        setTimeout(() => {
          setGateTransitMap((prev) => {
            if (!prev[device.id]) return prev;
            const next = { ...prev };
            delete next[device.id];
            return next;
          });
        }, APERTURE_TRANSIT_LOCK_MS);
      }
      const nextState = action === 'OPEN' ? 'OPENING' : action === 'CLOSE' ? 'CLOSING' : 'STOPPED';
      notify.success(`${device.name}: ${label}`);
      patchDeviceStateInPlace(
        device,
        { state: nextState },
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
            const acTemp = rawState?.temperature ? Number(rawState.temperature) : 26;

            const isRgbLight = isRgbLightDevice(device.raw);
            const resolvedRgb = isRgbLight ? resolveDeviceRgb(rawState) : undefined;
            const rgbHex = isRgbLight
              ? resolvedRgb
                ? `rgb(${resolvedRgb.r}, ${resolvedRgb.g}, ${resolvedRgb.b})`
                : (rawState?.rgbHex as string | undefined)
              : undefined;

            const handleCardClick = () => {
              setSelectedDetail(device);
            };
            const isViewOnly = isReadOnlyDevice(device);
            const cardAmbientBg =
              isOn && !device.offline
                ? isRgbLight && rgbHex
                  ? `radial-gradient(circle at 50% 46%, color-mix(in srgb, ${rgbHex} 16%, transparent) 0%, transparent 62%)`
                  : device.type === 'Đèn'
                    ? `radial-gradient(circle at 50% 46%, rgba(251, 191, 36, ${(0.1 + (currentBrightness / 100) * 0.1).toFixed(2)}) 0%, transparent 62%)`
                    : undefined
                : undefined;

            return (
              <article
                key={device.id}
                className={`device-card glass-g1 ${isOn ? 'on' : ''} ${
                  device.offline ? 'offline' : ''
                }`}
                tabIndex={0}
                onClick={handleCardClick}
                onKeyDown={(e) => e.key === 'Enter' && handleCardClick()}
                style={cardAmbientBg ? { cursor: 'pointer', backgroundImage: cardAmbientBg } : { cursor: 'pointer' }}
              >
                <div className="device-top">
                  <div className="device-copy device-card-header-copy">
                    <h3 title={device.name}>{device.name}</h3>
                    {!device.offline && device.status !== 'Ngoại tuyến' && (
                      <p>
                        {device.type === 'Đèn'
                          ? `${isOn ? 'Đang bật' : 'Đã tắt'} · ${currentBrightness}%`
                          : device.status}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isRgbLight && rgbHex && (
                      <span
                        data-rgb-indicator="true"
                        className="w-3 h-3 rounded-full border border-white/60 shadow-xs shrink-0"
                        style={{ backgroundColor: rgbHex }}
                        title={`Màu RGB: ${rgbHex}`}
                      />
                    )}
                    {isViewOnly && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                        Chỉ xem
                      </span>
                    )}
                    {!device.offline && (
                      device.type === 'Cảm biến' || device.type === 'Cổng' ? (
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
                      )
                    )}
                  </div>
                </div>

                <div className="device-visual-center">
                  <div className="icon-tile-wrap">
                    <span
                      className="device-icon device-visual-tile"
                      style={
                        isOn && !device.offline
                          ? isRgbLight && rgbHex
                            ? {
                                background: `color-mix(in srgb, ${rgbHex} 18%, transparent)`,
                                boxShadow: `0 0 22px color-mix(in srgb, ${rgbHex} 48%, transparent)`,
                              }
                            : device.type === 'Đèn'
                              ? {
                                  background: 'rgba(251, 191, 36, 0.16)',
                                  boxShadow: `0 0 20px rgba(245, 158, 11, ${(0.22 + (currentBrightness / 100) * 0.3).toFixed(2)})`,
                                }
                              : undefined
                          : undefined
                      }
                    >
                      <DeviceVisual
                        uid={`home-${device.id}`}
                        deviceType={device.raw?.deviceType}
                        figmaType={device.type}
                        name={device.name}
                        icon={device.icon}
                        isOn={isOn}
                        offline={device.offline}
                        brightness={currentBrightness}
                        rgbColor={isRgbLight ? rgbHex : undefined}
                        acMode={typeof rawState?.mode === 'string' ? rawState.mode : undefined}
                        gateState={typeof rawState?.state === 'string' ? rawState.state : undefined}
                        sensorState={rawState}
                        size={82}
                      />
                      <span
                        className={`status-dot ${
                          device.raw?.status === 'UNKNOWN'
                            ? 'unknown'
                            : device.offline
                            ? 'offline'
                            : 'online'
                        }`}
                        title={
                          device.raw?.status === 'UNKNOWN'
                            ? 'Không xác định'
                            : device.offline
                            ? 'Ngoại tuyến'
                            : 'Trực tuyến'
                        }
                      />
                    </span>
                  </div>
                </div>

                {/* Card Footer Summary / Quick Aperture Controls per Device Type */}
                {device.type === 'Điều hòa' ? (
                  <div className="flex items-center justify-center gap-1.5 w-full pt-2 border-t border-[var(--border)]">
                    <strong className="text-sm font-extrabold text-[#0f172a] tabular-nums">
                      {acTemp}°C
                    </strong>
                    <span className="px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/35 text-[10px] font-semibold text-sky-700">
                      {AC_MODE_CODE_TO_LABEL[String(rawState?.mode ?? 'COOL').toUpperCase()] ?? 'Lạnh'}
                    </span>
                  </div>
                ) : device.type === 'Cổng' ? (
                  <div
                    className="grid grid-cols-3 gap-1.5 w-full pt-2 border-t border-[var(--border)]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {(() => {
                      const interlock = getApertureInterlock(rawState?.state, Boolean(gateTransitMap[device.id]));
                      const activeGateLabel =
                        interlock.isOpen || interlock.isOpening
                          ? 'Mở'
                          : interlock.isClosed || interlock.isClosing
                            ? 'Đóng'
                            : 'Dừng';
                      return (['Mở', 'Dừng', 'Đóng'] as const).map((btn) => {
                        const action = btn === 'Mở' ? 'OPEN' : btn === 'Đóng' ? 'CLOSE' : 'STOP';
                        const isGateActive = activeGateLabel === btn;
                        const btnLocked =
                          (btn === 'Mở' && interlock.disableOpen) ||
                          (btn === 'Đóng' && interlock.disableClose) ||
                          (btn === 'Dừng' && interlock.disableStop);
                        const isBtnDisabled = Boolean(device.offline || isViewOnly || btnLocked);
                        const idleTone =
                          btn === 'Mở'
                            ? 'bg-emerald-500/10 border-emerald-500/55 text-black hover:bg-emerald-500/20'
                            : btn === 'Đóng'
                              ? 'bg-rose-500/10 border-rose-500/55 text-black hover:bg-rose-500/20'
                              : 'bg-amber-500/10 border-amber-500/55 text-black hover:bg-amber-500/20';
                        return (
                          <button
                            key={btn}
                            type="button"
                            disabled={isBtnDisabled}
                            onClick={() => !isBtnDisabled && handleGateCommand(device, action, btn)}
                            className={`py-1 px-1 rounded-lg border text-[10px] font-bold transition-colors text-center disabled:opacity-65 disabled:cursor-not-allowed ${
                              isBtnDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
                            } ${
                              isGateActive
                                ? 'bg-primary text-white border-primary shadow-2xs'
                                : idleTone
                            }`}
                          >
                            {btn}
                          </button>
                        );
                      });
                    })()}
                  </div>
                ) : device.type === 'Cảm biến' ? (
                  (() => {
                    const sm = extractSensorMetrics(rawState);
                    const isSmokeAlert =
                      typeof sm.smoke === 'boolean'
                        ? sm.smoke
                        : typeof sm.smoke === 'number'
                          ? sm.smoke > 50
                          : false;
                    const isGasAlert = (sm.gasPpm ?? 0) > 200;
                    const allItems: Array<{ text: string; icon: 'thermometer' | 'droplet' | 'sun' | 'activity' | 'shield' | 'flame'; alert?: boolean }> = [];
                    if (sm.temperature !== undefined) allItems.push({ text: `${sm.temperature}°C`, icon: 'thermometer' });
                    if (sm.humidity !== undefined) allItems.push({ text: `${sm.humidity}%`, icon: 'droplet' });
                    if (sm.lux !== undefined) allItems.push({ text: `${sm.lux} lx`, icon: 'sun' });
                    else if (sm.lightBinary !== undefined) allItems.push({ text: sm.lightBinary ? 'Sáng' : 'Tối', icon: 'sun' });
                    if (sm.motion !== undefined) allItems.push({ text: sm.motion ? 'Chuyển động' : 'Tĩnh', icon: 'activity', alert: Boolean(sm.motion) });
                    if (sm.smoke !== undefined) {
                      allItems.push({
                        text: typeof sm.smoke === 'number' ? `${sm.smoke} ppm` : sm.smoke ? 'Báo khói!' : 'An toàn',
                        icon: 'shield',
                        alert: isSmokeAlert,
                      });
                    }
                    if (sm.gasPpm !== undefined) allItems.push({ text: `${sm.gasPpm} ppm`, icon: 'flame', alert: isGasAlert });
                    if (sm.flame !== undefined) allItems.push({ text: sm.flame ? 'Có lửa!' : 'An toàn', icon: 'flame', alert: Boolean(sm.flame) });
                    const primaryText = device.value || allItems[0]?.text;
                    const extraItems = allItems.filter((item, idx) => !(idx === 0 && item.text === primaryText) && item.text !== primaryText);
                    if (!primaryText && extraItems.length === 0) {
                      return <span className="room-label">{device.room}</span>;
                    }
                    return (
                      <div className="flex flex-col items-center gap-1.5 w-full pt-1.5 border-t border-[var(--border)]">
                        {primaryText && (
                          <strong className="text-lg font-extrabold text-[#0f172a] tabular-nums leading-none">
                            {primaryText}
                          </strong>
                        )}
                        {extraItems.length > 0 && (
                          <div className="flex flex-wrap items-center justify-center gap-1">
                            {extraItems.map((item) => (
                              <span
                                key={item.text}
                                className={`px-1.5 py-0.5 rounded-md border text-[10px] font-semibold flex items-center gap-1 ${
                                  item.alert
                                    ? 'bg-rose-500/10 border-rose-500/50 text-rose-700'
                                    : 'bg-white border-[#cbd5e1] text-[#0f172a]'
                                }`}
                              >
                                <Icon name={item.icon} size={10} />
                                {item.text}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : isFanDevice(device.raw) && isOn && resolveFanSpeedLevel(rawState) > 0 ? (
                  <div className="flex items-center justify-center w-full pt-2 border-t border-[var(--border)]">
                    <span className="px-2.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/35 text-[11px] font-semibold text-[#0f172a]">
                      Mức {resolveFanSpeedLevel(rawState)}
                    </span>
                  </div>
                ) : isTvDevice(device.raw) && isOn ? (
                  <div className="flex items-center justify-center w-full pt-2 border-t border-[var(--border)]">
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/35 text-[11px] font-semibold text-[#0f172a]">
                      {rawState?.muted
                        ? 'Tắt tiếng'
                        : rawState?.channel !== undefined
                          ? `Kênh ${rawState.channel}`
                          : 'Đang bật'}
                    </span>
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
          onColorChange={
            isRgbLightDevice(selectedDetail.raw)
              ? (r, g, b) => {
                  void handleColorChange(selectedDetail, r, g, b);
                }
              : undefined
          }
        />
      )}
    </section>
  );
};
