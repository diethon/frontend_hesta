import React, { useState, useEffect, useCallback } from 'react';
import { X, MoreHorizontal } from 'lucide-react';
import type { DeviceResponse, DeviceShadowResponse } from '../../types/device';
import {
  updateDeviceConfig,
  removeDevice,
  reconcileDeviceShadow,
  getDeviceShadow,
  cancelDeviceAutomation,
  resumeDeviceAutomation,
  extendDeviceAutomation,
} from '../../services/deviceApi';
import { useOverrideCountdown } from './useOverrideCountdown';
import { notify } from '../ui/notify';
import { getErrorMessage } from '../../utils/errors';
import './device-detail.css';

// Subcomponents & hooks
import type { FigmaDeviceType, CustomColorItem, DetailDeviceInput } from './detail/detailTypes';
import { resolveFigmaDeviceType } from './detail/detailTypes';
import { useDeviceInsights } from './detail/useDeviceInsights';
import { DetailHero } from './detail/DetailHero';
import { DetailTabs, type DetailTabType } from './detail/DetailTabs';
import { ControlTab } from './detail/ControlTab';
import { EnergyTab } from './detail/EnergyTab';
import { HistoryTab } from './detail/HistoryTab';
import { SettingsTab } from './detail/SettingsTab';

// Re-export types so external importers (DevicePage, HomeFavoriteDevices, etc.) remain 100% compatible
export type { FigmaDeviceType, CustomColorItem };

export interface DeviceDetailModalProps {
  device: DetailDeviceInput | null;
  isOpen?: boolean;
  onClose: () => void;
  placement?: 'side' | 'center';
  onDeviceUpdated?: (updated: DeviceResponse) => void;
  onDeviceRemoved?: (deviceId: string) => void;
  onTogglePower?: () => void;
  onColorChange?: (r: number, g: number, b: number) => void;
  onBrightnessChange?: (brightness: number) => void;
  isPowerPending?: boolean;
}

/**
 * Inner component that owns all hooks.
 * Solves the React rules-of-hooks violation where early return was placed before hooks.
 */
const DeviceDetailInner: React.FC<DeviceDetailModalProps & { device: DetailDeviceInput }> = ({
  device,
  onClose,
  placement = 'side',
  onDeviceUpdated,
  onDeviceRemoved,
  onTogglePower,
  onColorChange,
  onBrightnessChange,
}) => {
  const devId = device?.raw?.id || device?.id;
  const resolvedType = resolveFigmaDeviceType(device);
  const isUnknown = device?.raw?.status === 'UNKNOWN' || device?.status === 'UNKNOWN';
  const disabled = Boolean(device?.offline || device?.status === 'OFFLINE' || isUnknown);

  // Active tab state (resets to 'control' when device id changes inside DetailTabs)
  const [activeTab, setActiveTab] = useState<DetailTabType>('control');

  // Header Rename and Menu states
  const [prevDevice, setPrevDevice] = useState(device);
  const [name, setName] = useState(device?.name || '');
  const [rename, setRename] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Power and light level states
  const [isOn, setIsOn] = useState(() => Boolean(device?.on));
  const [lightLevel, setLightLevel] = useState<number>(() => {
    if (typeof device?.brightness === 'number') return device.brightness;
    if (device?.currentState?.brightness) return Number(device.currentState.brightness);
    return 80;
  });

  // Adjust state when device prop changes (official React pattern)
  if (device !== prevDevice) {
    setPrevDevice(device);
    setName(device?.name || '');
    setIsOn(Boolean(device?.on));
    if (typeof device?.brightness === 'number') {
      setLightLevel(device.brightness);
    } else if (device?.currentState?.brightness) {
      setLightLevel(Number(device.currentState.brightness));
    }
  }

  const handleToggleCurrent = () => {
    setIsOn((prev) => !prev);
    onTogglePower?.();
  };

  // AC Temp & Mode
  const [acTemp, setAcTemp] = useState<number>(() => {
    const t = device?.raw?.currentState?.temperature ?? device?.currentState?.temperature;
    return t !== undefined && t !== null && !Number.isNaN(Number(t)) ? Number(t) : 24;
  });
  const [acMode, setAcMode] = useState<string>(() => {
    const raw = String(device?.raw?.currentState?.mode ?? device?.currentState?.mode ?? '').toUpperCase();
    return { COOL: 'Lạnh', DRY: 'Hút ẩm', HEAT: 'Sưởi', AUTO: 'Tự động' }[raw] ?? 'Lạnh';
  });

  // Gate State
  const [gateState, setGateState] = useState<string>(() => {
    const raw = String(device?.raw?.currentState?.state ?? device?.currentState?.state ?? '').toUpperCase();
    return raw === 'OPEN' || raw === 'OPENING' ? 'Mở' : raw === 'CLOSED' || raw === 'CLOSING' ? 'Đóng' : 'Dừng';
  });

  // Unified Data Hook (fetch once per device with cancellation)
  const {
    energyData,
    uptimeData,
    historyData,
    healthData,
    isLoading: isInsightsLoading,
    refreshEnergy,
  } = useDeviceInsights(devId);

  // Shadow synchronization state
  const [shadow, setShadow] = useState<DeviceShadowResponse | null>(null);
  const [isReconcilingShadow, setIsReconcilingShadow] = useState(false);
  const [isCheckingShadow, setIsCheckingShadow] = useState(false);

  const fetchShadow = useCallback(async () => {
    if (!devId) return;
    setIsCheckingShadow(true);
    try {
      const data = await getDeviceShadow(devId);
      setShadow(data);
    } catch {
      // Device might not have a shadow record yet
    } finally {
      setIsCheckingShadow(false);
    }
  }, [devId]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!devId) return;
      try {
        const data = await getDeviceShadow(devId);
        if (active) setShadow(data);
      } catch {
        // ignore
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [devId]);

  const handleReconcileShadow = async () => {
    if (!devId) return;
    setIsReconcilingShadow(true);
    try {
      const res = await reconcileDeviceShadow(devId);
      setShadow(res);
      notify.success('Đã gửi lại lệnh đồng bộ', 'Thiết bị đang cập nhật theo trạng thái mới nhất.');
    } catch {
      notify.error('Lỗi khi gửi lệnh đồng bộ lại');
    } finally {
      setIsReconcilingShadow(false);
    }
  };

  const deltaKeys = shadow ? Object.keys(shadow.deltaState || {}) : [];
  const isOutOfSync = shadow ? (!shadow.inSync || deltaKeys.length > 0) : false;

  // Automation manual override countdown & handlers
  const overrideUntil = device?.manualOverrideUntil || device?.raw?.manualOverrideUntil;
  const { isOverrideActive, formattedTime } = useOverrideCountdown(overrideUntil);
  const [isResumingAutomation, setIsResumingAutomation] = useState(false);
  const [isCancellingAutomation, setIsCancellingAutomation] = useState(false);
  const [isExtendingAutomation, setIsExtendingAutomation] = useState(false);

  const handleResumeAutomation = async () => {
    if (!devId) return;
    setIsResumingAutomation(true);
    try {
      await resumeDeviceAutomation(devId);
      notify.success('Đã khôi phục tự động hóa', 'Quy tắc và kịch bản tự động sẽ tiếp tục điều khiển thiết bị');
      const updated = {
        ...(device?.raw || device),
        manualOverrideUntil: null,
        manualOverrideActive: false,
      } as DeviceResponse;
      onDeviceUpdated?.(updated);
    } catch (err) {
      notify.error(getErrorMessage(err, 'Lỗi khi khôi phục tự động hóa'));
    } finally {
      setIsResumingAutomation(false);
    }
  };

  const handleCancelAutomation = async (minutes: number = 30) => {
    if (!devId) return;
    setIsCancellingAutomation(true);
    try {
      const newUntil = await cancelDeviceAutomation(devId, minutes);
      const untilStr = newUntil || new Date(Date.now() + minutes * 60 * 1000).toISOString();
      const label =
        minutes >= 60
          ? `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)} giờ`
          : `${minutes} phút`;
      notify.success('Đã tạm dừng tự động hóa', `Thiết bị được ưu tiên điều khiển thủ công trong ${label}`);
      const updated = {
        ...(device?.raw || device),
        manualOverrideUntil: untilStr,
        manualOverrideActive: true,
      } as DeviceResponse;
      onDeviceUpdated?.(updated);
    } catch (err) {
      notify.error(getErrorMessage(err, 'Lỗi khi tạm dừng tự động hóa'));
    } finally {
      setIsCancellingAutomation(false);
    }
  };

  const handleExtendAutomation = async (hours: number = 1) => {
    if (!devId) return;
    setIsExtendingAutomation(true);
    try {
      const newUntil = await extendDeviceAutomation(devId, hours);
      const label = hours >= 1 ? `${hours} giờ` : `${Math.round(hours * 60)} phút`;
      notify.success('Đã gia hạn ghi đè', `Đã cộng thêm ${label} vào thời gian ưu tiên`);
      const updated = {
        ...(device?.raw || device),
        manualOverrideUntil: newUntil,
        manualOverrideActive: true,
      } as DeviceResponse;
      onDeviceUpdated?.(updated);
    } catch (err) {
      notify.error(getErrorMessage(err, 'Lỗi khi gia hạn tự động hóa'));
    } finally {
      setIsExtendingAutomation(false);
    }
  };

  const handleSaveName = async () => {
    setRename(false);
    if (!name.trim() || name === device?.name) return;
    try {
      if (device?.id) {
        const updated = await updateDeviceConfig(device.id, { name: name.trim() });
        notify.success('Đã cập nhật tên thiết bị');
        onDeviceUpdated?.(updated);
      }
    } catch (e) {
      notify.error(getErrorMessage(e, 'Không thể đổi tên'));
      setName(device?.name || '');
    }
  };

  const handleDeleteDevice = async () => {
    setIsDeleting(true);
    try {
      if (device?.id) {
        await removeDevice(device.id);
        notify.success(`Đã xóa thiết bị ${device.name}`);
        onDeviceRemoved?.(device.id);
        setConfirm(false);
        onClose();
      }
    } catch (e) {
      notify.error(getErrorMessage(e, 'Không thể xóa thiết bị'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Wattage calculation & reactive state
  const isAc = resolvedType === 'Điều hòa';
  const isSensor = resolvedType === 'Cảm biến';
  const getInitialCustomWattage = (dev: DetailDeviceInput | null | undefined): number | undefined => {
    const rawW = dev?.raw?.settings?.wattage ?? dev?.settings?.wattage;
    if (rawW !== undefined && rawW !== null && !Number.isNaN(Number(rawW)) && Number(rawW) > 0) {
      return Number(rawW);
    }
    const targetId = dev?.raw?.id || dev?.id;
    if (targetId && typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(`hesta_wattage_${targetId}`);
      if (saved !== null && !Number.isNaN(Number(saved)) && Number(saved) > 0) {
        return Number(saved);
      }
    }
    return undefined;
  };

  const [localCustomWattage, setLocalCustomWattage] = useState<number | undefined>(() =>
    getInitialCustomWattage(device)
  );
  const [prevWattageDevId, setPrevWattageDevId] = useState(devId);
  if (devId !== prevWattageDevId) {
    setPrevWattageDevId(devId);
    setLocalCustomWattage(getInitialCustomWattage(device));
  }

  const effectiveCustomWattage =
    localCustomWattage ?? getInitialCustomWattage(device);
  const currentWattage =
    effectiveCustomWattage !== undefined
      ? effectiveCustomWattage
      : (energyData?.wattage ?? (isAc ? 750 : isSensor ? 2 : 40));
  const hasCustomWattage = effectiveCustomWattage !== undefined;

  const handleSaveWattage = async (newWatt: number): Promise<boolean> => {
    if (!devId || Number.isNaN(newWatt) || newWatt <= 0) {
      notify.error('Vui lòng nhập công suất hợp lệ lớn hơn 0W');
      return false;
    }

    const existingSettings = device?.raw?.settings || device?.settings || {};
    const updatedSettings = {
      ...existingSettings,
      wattage: newWatt,
    };

    // Optimistic local state + localStorage persistence
    setLocalCustomWattage(newWatt);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`hesta_wattage_${devId}`, String(newWatt));
    }

    try {
      const apiUpdated = await updateDeviceConfig(devId, {
        name: device?.raw?.name || device?.name,
        settings: updatedSettings,
      });
      const cleanUpdated = {
        ...(device?.raw || {}),
        ...(apiUpdated || {}),
        id: devId,
        homeId: apiUpdated?.homeId || device?.raw?.homeId || '',
        name: apiUpdated?.name || device?.raw?.name || device?.name || '',
        deviceType: apiUpdated?.deviceType || device?.raw?.deviceType || device?.deviceType || 'SWITCH',
        status: apiUpdated?.status || device?.raw?.status || 'ONLINE',
        currentState: apiUpdated?.currentState || device?.raw?.currentState || device?.currentState || {},
        settings: updatedSettings,
      } as DeviceResponse;
      onDeviceUpdated?.(cleanUpdated);
      void refreshEnergy();
      notify.success(`Đã cập nhật công suất định mức thành ${newWatt} W`);
      return true;
    } catch (err) {
      console.warn('Update device wattage fallback to local:', err);
      // Even if backend returns an error in demo/offline mode, keep local update consistent
      const fallbackUpdated = {
        ...(device?.raw || {}),
        id: devId,
        homeId: device?.raw?.homeId || '',
        name: device?.raw?.name || device?.name || '',
        deviceType: device?.raw?.deviceType || device?.deviceType || 'SWITCH',
        status: device?.raw?.status || 'ONLINE',
        currentState: device?.raw?.currentState || device?.currentState || {},
        settings: updatedSettings,
      } as DeviceResponse;
      onDeviceUpdated?.(fallbackUpdated);
      notify.success(`Đã lưu công suất định mức ${newWatt} W`);
      return true;
    }
  };

  return (
    <div className={`detail-layer ${placement === 'center' ? 'centered' : ''}`}>
      <button
        type="button"
        className="detail-scrim"
        onClick={onClose}
        aria-label="Đóng"
      />
      <aside className="detail-panel glass-g2">
        <div className="sheet-handle" />

        {/* 1. Header */}
        <header className="detail-header">
          <button
            type="button"
            className="detail-icon-button"
            onClick={onClose}
            aria-label="Đóng bảng chi tiết"
          >
            <X className="w-5 h-5" />
          </button>

          <div>
            {rename ? (
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                onBlur={handleSaveName}
                onKeyDown={(event) => event.key === 'Enter' && handleSaveName()}
              />
            ) : (
              <strong onClick={() => setRename(true)} title="Nhấp để sửa tên">
                {name} <small>Sửa</small>
              </strong>
            )}
            <span className={isUnknown ? 'unknown' : disabled ? 'offline' : ''}>
              <i />
              {isUnknown ? 'Không xác định' : disabled ? 'Ngoại tuyến' : 'Trực tuyến'} · {device?.room || device?.roomName || 'Nhà'}
            </span>
          </div>

          <button
            type="button"
            className="detail-icon-button"
            onClick={() => setMenu(!menu)}
            aria-label="Tùy chọn thiết bị"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          {menu && (
            <div className="detail-menu glass-g2">
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  setRename(true);
                }}
              >
                Đổi tên thiết bị
              </button>
              {isOverrideActive ? (
                <button
                  type="button"
                  disabled={isResumingAutomation}
                  onClick={() => {
                    setMenu(false);
                    void handleResumeAutomation();
                  }}
                >
                  Khôi phục tự động hóa
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isCancellingAutomation}
                  onClick={() => {
                    setMenu(false);
                    void handleCancelAutomation(30);
                  }}
                >
                  Tạm dừng tự động (30 phút)
                </button>
              )}
              <button
                type="button"
                className="danger"
                onClick={() => {
                  setMenu(false);
                  setConfirm(true);
                }}
              >
                Xóa thiết bị
              </button>
            </div>
          )}
        </header>

        {/* 2. Scrollable Body containing Hero, Sticky Tabs, and Active Tab Panel */}
        <div className="detail-scroll-body">
          {/* Hero Section with Big Readout, Tinted Icon Tile, Power Button, and Action Banners */}
          <DetailHero
            device={device}
            resolvedType={resolvedType}
            disabled={disabled}
            isOn={isOn}
            onTogglePower={handleToggleCurrent}
            lightLevel={lightLevel}
            acTemp={acTemp}
            acMode={acMode}
            gateState={gateState}
            wattage={currentWattage}
            energyKwh={energyData?.kwh}
            energyCostVnd={energyData?.costVnd}
            onEditWattage={() => setActiveTab('settings')}
            isOverrideActive={isOverrideActive}
            formattedTime={formattedTime}
            onResumeAutomation={handleResumeAutomation}
            onExtendAutomation={handleExtendAutomation}
            isResumingAutomation={isResumingAutomation}
            isExtendingAutomation={isExtendingAutomation}
            isOutOfSync={isOutOfSync}
            deltaKeysCount={deltaKeys.length}
            onReconcileShadow={handleReconcileShadow}
            isReconcilingShadow={isReconcilingShadow}
          />

          {/* Sticky Segmented Tabs */}
          <DetailTabs
            deviceId={devId}
            activeTab={activeTab}
            onChangeTab={setActiveTab}
            resolvedType={resolvedType}
          />

          {/* Tab Views */}
          {activeTab === 'control' && (
            <ControlTab
              device={device}
              resolvedType={resolvedType}
              disabled={disabled}
              isOn={isOn}
              onTogglePower={handleToggleCurrent}
              onBrightnessChange={onBrightnessChange}
              onColorChange={onColorChange}
              lightLevel={lightLevel}
              setLightLevel={setLightLevel}
              acTemp={acTemp}
              setAcTemp={setAcTemp}
              acMode={acMode}
              setAcMode={setAcMode}
              gateState={gateState}
              setGateState={setGateState}
              historyData={historyData}
            />
          )}

          {activeTab === 'energy' && (
            <EnergyTab
              device={device}
              resolvedType={resolvedType}
              disabled={disabled}
              wattage={currentWattage}
              hasCustomWattage={hasCustomWattage}
              onSaveWattage={handleSaveWattage}
              energyData={energyData}
              uptimeData={uptimeData}
              healthData={healthData}
              refreshEnergy={refreshEnergy}
              onDeviceUpdated={onDeviceUpdated}
            />
          )}

          {activeTab === 'history' && (
            <HistoryTab
              deviceId={devId}
              deviceName={device?.name}
              historyData={historyData}
              isLoading={isInsightsLoading}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              device={device}
              wattage={currentWattage}
              hasCustomWattage={hasCustomWattage}
              onSaveWattage={handleSaveWattage}
              isOverrideActive={isOverrideActive}
              formattedTime={formattedTime}
              onCancelAutomation={handleCancelAutomation}
              onResumeAutomation={handleResumeAutomation}
              onExtendAutomation={handleExtendAutomation}
              isCancellingAutomation={isCancellingAutomation}
              isResumingAutomation={isResumingAutomation}
              isExtendingAutomation={isExtendingAutomation}
              shadow={shadow}
              isCheckingShadow={isCheckingShadow}
              isReconcilingShadow={isReconcilingShadow}
              onRefreshShadow={fetchShadow}
              onReconcileShadow={handleReconcileShadow}
              onStartRename={() => setRename(true)}
              onOpenDeleteConfirm={() => setConfirm(true)}
            />
          )}
        </div>
      </aside>

      {/* Delete Confirm Dialog */}
      {confirm && (
        <div className="delete-dialog glass-g2">
          <strong>Xóa {name}?</strong>
          <p>Thiết bị sẽ bị xóa khỏi ngôi nhà này.</p>
          <div>
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setConfirm(false)}
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={isDeleting}
              className="danger"
              onClick={handleDeleteDevice}
            >
              {isDeleting ? 'Đang xóa...' : 'Xóa thiết bị'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Public DeviceDetailModal component with safety check.
 * Fixes rules-of-hooks violation by delegating to DeviceDetailInner only when open and device is present.
 */
export const DeviceDetailModal: React.FC<DeviceDetailModalProps> = (props) => {
  // isOpen defaults to true (callers like DevicePage omit it).
  if (props.isOpen === false || !props.device) return null;
  return <DeviceDetailInner {...props} device={props.device} />;
};

export default DeviceDetailModal;
