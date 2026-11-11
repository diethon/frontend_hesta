import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { 
  X, 
  Edit2, 
  Check, 
  Trash2, 
  ShieldX, 
  Clock, 
  Tag, 
  AlertTriangle, 
  Activity, 
  Download, 
  Zap, 
  ChevronRight,
  HeartPulse,
  BellRing,
  FileSpreadsheet,
  Mic,
  Smartphone,
  ToggleRight,
  Radio
} from 'lucide-react';
import { getFriendlyDeviceTypeName } from './DeviceStateVisualizer';
import type { 
  DeviceResponse, 
  DeviceStateHistoryResponse, 
  ManualOverrideRecord,
  DeviceUptimeResponse,
  DeviceHealthResponse
} from '../../types/device';
import type { DeviceEnergyBreakdown } from '../../types/energy';
import { 
  getDeviceHistory, 
  getDeviceOverrideHistory, 
  cancelDeviceAutomation, 
  updateDeviceConfig, 
  removeDevice,
  exportDeviceHistoryCsv,
  exportDeviceHistoryExcel,
  resumeDeviceAutomation,
  getDeviceUptime,
  getDeviceHealth
} from '../../services/deviceApi';
import { DeviceShadowSection } from './DeviceShadowSection';
import { useOverrideCountdown } from './useOverrideCountdown';
import { getDeviceEnergy } from '../../services/energyApi';
import { notify } from '../ui/notify';
import { resolveEffectiveType } from './deviceHelpers';
import { LightControl } from './controls/LightControl';
import { RgbLightControl } from './controls/RgbLightControl';
import { AcControl } from './controls/AcControl';
import { GateControl } from './controls/GateControl';
import { SensorDisplay } from './controls/SensorDisplay';

export interface DeviceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  device: DeviceResponse | null;
  onDeviceRemoved: (deviceId: string) => void;
  onDeviceUpdated: (device: DeviceResponse) => void;
  onTogglePower?: (deviceId: string, currentPower: string) => void;
  onColorChange?: (deviceId: string, r: number, g: number, b: number) => void;
  onBrightnessChange?: (deviceId: string, brightness: number) => void;
  isPowerPending?: boolean;
}

export const DeviceDrawer: React.FC<DeviceDrawerProps> = ({
  isOpen,
  onClose,
  device,
  onDeviceRemoved,
  onDeviceUpdated,
  onTogglePower,
  onColorChange,
  onBrightnessChange,
  isPowerPending = false
}) => {
  const navigate = useNavigate();
  const [history, setHistory] = useState<DeviceStateHistoryResponse[]>([]);
  const [overrides, setOverrides] = useState<ManualOverrideRecord[]>([]);
  const [uptimeData, setUptimeData] = useState<DeviceUptimeResponse | null>(null);
  const [healthData, setHealthData] = useState<DeviceHealthResponse | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [isEditingWattage, setIsEditingWattage] = useState(false);
  const [editWattage, setEditWattage] = useState('');
  const [isSavingWattage, setIsSavingWattage] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [deviceEnergy, setDeviceEnergy] = useState<DeviceEnergyBreakdown | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const { isOverrideActive, formattedTime } = useOverrideCountdown(device?.manualOverrideUntil);

  const handleResumeAutomation = async () => {
    if (!device) return;
    try {
      await resumeDeviceAutomation(device.id);
      notify('Đã khôi phục tự động hóa', 'success');
      fetchHistory(device.id);
      onDeviceUpdated({ ...device, manualOverrideUntil: null, manualOverrideActive: false });
    } catch (error) {
      notify('Lỗi khi khôi phục tự động hóa', 'error');
    }
  };

  useEffect(() => {
    if (isOpen && device) {
      setEditName(device.name);
      setIsEditingName(false);
      setEditWattage(String(device.settings?.wattage || ''));
      setIsEditingWattage(false);
      fetchHistory(device.id);
    }
  }, [isOpen, device]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleUpdateWattage = async () => {
    if (!device) return;
    const trimmed = editWattage.trim();
    const parsedWatt = parseInt(trimmed, 10);
    if (!trimmed || isNaN(parsedWatt) || parsedWatt <= 0) {
      notify.error('Vui lòng nhập công suất hợp lệ lớn hơn 0W');
      return;
    }
    
    setIsSavingWattage(true);
    try {
      const updatedSettings = {
        ...(device.settings || {}),
        wattage: parsedWatt
      };
      const updated = await updateDeviceConfig(device.id, {
        settings: updatedSettings
      });
      setIsEditingWattage(false);
      notify.success(`Đã cập nhật công suất thành ${parsedWatt}W`);
      onDeviceUpdated({
        ...device,
        ...updated,
        settings: updatedSettings
      });
      // Tải lại thông số năng lượng sau khi cập nhật công suất
      getDeviceEnergy(device.id).then(res => res && setDeviceEnergy(res)).catch(() => null);
    } catch (error) {
      notify.error('Lỗi khi cập nhật công suất thiết bị');
    } finally {
      setIsSavingWattage(false);
    }
  };

  const fetchHistory = async (deviceId: string) => {
    setIsLoadingHistory(true);
    try {
      const [histRes, overRes, energyRes, upRes, hlthRes] = await Promise.all([
        getDeviceHistory(deviceId),
        getDeviceOverrideHistory(deviceId),
        getDeviceEnergy(deviceId).catch(() => null),
        getDeviceUptime(deviceId, 7).catch(() => null),
        getDeviceHealth(deviceId).catch(() => null)
      ]);
      setHistory(histRes);
      setOverrides(overRes);
      if (energyRes) setDeviceEnergy(energyRes);
      if (upRes) setUptimeData(upRes);
      if (hlthRes) setHealthData(hlthRes);
    } catch (error) {
      console.error('Failed to fetch history', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleUpdateName = async () => {
    if (!device) return;
    if (!editName.trim()) {
      notify.error('Tên thiết bị không được để trống');
      return;
    }
    
    try {
      const updated = await updateDeviceConfig(device.id, { name: editName });
      onDeviceUpdated(updated);
      setIsEditingName(false);
      notify.success('Đã cập nhật tên thiết bị');
    } catch (error) {
      notify.error('Lỗi khi cập nhật tên thiết bị');
    }
  };

  const handleCancelAutomation = async () => {
    if (!device) return;
    try {
      await cancelDeviceAutomation(device.id);
      notify.success('Đã tạm dừng tự động hóa', 'Khóa can thiệp tự động 30 phút');
      fetchHistory(device.id);
    } catch (error) {
      notify.error('Lỗi khi hủy tự động hóa');
    }
  };

  const handleRemoveDevice = async () => {
    if (!device) return;
    if (window.confirm(`Bạn có chắc chắn muốn xóa thiết bị "${device.name}"?`)) {
      try {
        await removeDevice(device.id);
        notify.success('Đã xóa thiết bị');
        onDeviceRemoved(device.id);
        onClose();
      } catch (error) {
        notify.error('Lỗi khi xóa thiết bị');
      }
    }
  };

  if (!isOpen || !device) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ONLINE': return 'text-success bg-success';
      case 'OFFLINE': return 'text-muted bg-muted';
      case 'ERROR': return 'text-error bg-error';
      default: return 'text-warning bg-warning';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ONLINE': return 'Trực tuyến';
      case 'OFFLINE': return 'Ngoại tuyến';
      case 'ERROR': return 'Lỗi';
      default: return 'Không rõ';
    }
  };

  const formatState = (state: Record<string, unknown>) => {
    if (!state || Object.keys(state).length === 0) return 'Không rõ';
    const parts = [];

    if (state.power !== undefined) {
      const isPowerOn = state.power === true || String(state.power).toUpperCase() === 'ON' || String(state.power) === '1';
      parts.push(isPowerOn ? 'Bật nguồn' : 'Tắt nguồn');
    }
    if (state.temperature !== undefined) parts.push(`Nhiệt độ ${state.temperature}°C`);
    if (state.humidity !== undefined) parts.push(`Độ ẩm ${state.humidity}%`);
    if (state.brightness !== undefined) parts.push(`Độ sáng ${state.brightness}%`);
    if (state.color && typeof state.color === 'object') {
      const c = state.color as { r?: number; g?: number; b?: number };
      if (c.r !== undefined && c.g !== undefined && c.b !== undefined) {
        parts.push(`Màu RGB(${c.r}, ${c.g}, ${c.b})`);
      }
    }
    if (state.motion !== undefined) {
      const isMotion = state.motion === true || String(state.motion).toUpperCase() === 'DETECTED';
      parts.push(isMotion ? 'Phát hiện chuyển động' : 'Không có chuyển động');
    }
    if (state.smoke !== undefined) {
      const isSmoke = state.smoke === true || String(state.smoke).toUpperCase() === 'DETECTED';
      parts.push(isSmoke ? 'Phát hiện khói' : 'An toàn');
    }
    if (state.state !== undefined) {
      const s = String(state.state).toUpperCase();
      if (s === 'OPEN') parts.push('Đã mở');
      else if (s === 'CLOSED') parts.push('Đã đóng');
      else if (s === 'OPENING') parts.push('Đang mở');
      else if (s === 'CLOSING') parts.push('Đang đóng');
      else if (s === 'STOPPED') parts.push('Đã dừng');
      else parts.push(s);
    }
    if (state.lux !== undefined) parts.push(`Độ sáng ${state.lux} Lux`);
    else if (state.LIGHT_SENSOR !== undefined) {
      const isBright = state.LIGHT_SENSOR === 1 || state.LIGHT_SENSOR === '1' || state.LIGHT_SENSOR === true;
      parts.push(isBright ? 'Trời sáng' : 'Trời tối');
    }
    return parts.length > 0 ? parts.join(', ') : 'Cập nhật trạng thái';
  };

  const renderSourceBadge = (source?: string) => {
    switch (source?.toUpperCase()) {
      case 'VOICE':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
            <Mic className="w-3 h-3 text-purple-600" /> Giọng nói AI
          </span>
        );
      case 'APP':
      case 'WEB':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200">
            <Smartphone className="w-3 h-3 text-sky-600" /> Ứng dụng
          </span>
        );
      case 'AUTOMATION':
      case 'RULE':
      case 'SCENE':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
            <Zap className="w-3 h-3 text-amber-600" /> Tự động hóa
          </span>
        );
      case 'MANUAL':
      case 'PHYSICAL':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
            <ToggleRight className="w-3 h-3 text-emerald-600" /> Công tắc cơ
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-off-soft text-text border border-line">
            <Radio className="w-3 h-3 text-muted" /> {source || 'Hệ thống'}
          </span>
        );
    }
  };

  const renderControl = () => {
    const effectiveType = resolveEffectiveType(device);
    switch (effectiveType) {
      case 'AIR_CONDITIONER':
        return <AcControl device={device} onStateChange={onDeviceUpdated} />;
      case 'LIGHT':
      case 'SMART_PLUG':
        return <LightControl device={device} onTogglePower={onTogglePower || (() => {})} isPending={isPowerPending} />;
      case 'LED_RGB':
        return (
          <RgbLightControl 
            device={device} 
            onTogglePower={onTogglePower || (() => {})} 
            onColorChange={onColorChange || (() => {})} 
            onBrightnessChange={onBrightnessChange || (() => {})} 
            isPending={isPowerPending}
          />
        );
      case 'GATE':
      case 'ROLLING_DOOR':
        return <GateControl device={device} onStateChange={onDeviceUpdated} />;
      case 'TEMP_HUMID_SENSOR':
      case 'MOTION_SENSOR':
      case 'SMOKE_SENSOR':
      case 'LUX_SENSOR':
      case 'LIGHT_SENSOR':
      case 'CAMERA_AI':
        return <SensorDisplay device={device} />;
      default:
        return (
          <div className="p-6 text-center text-muted border border-line rounded-2xl bg-surface">
            Chưa hỗ trợ điều khiển trực tiếp cho loại thiết bị này
          </div>
        );
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs overflow-hidden"
      onClick={onClose}
    >
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="relative w-full md:w-1/2 lg:w-1/3 xl:w-1/3 h-full max-h-screen flex flex-col bg-surface border-l border-line shadow-2xl overflow-hidden rounded-l-2xl sm:rounded-l-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-line bg-sidebar shrink-0">
          <div className="flex flex-col flex-1">
            <div className="flex items-center space-x-2">
              {isEditingName ? (
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="px-2.5 py-1 border border-line rounded-lg text-text focus:outline-none focus:border-primary bg-surface font-semibold text-base"
                    autoFocus
                  />
                  <button onClick={handleUpdateName} className="p-1.5 text-success hover:bg-success-soft rounded-lg transition-colors">
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <h2 className="text-lg sm:text-xl font-bold text-text flex items-center space-x-2">
                  <span>{device.name}</span>
                  <button onClick={() => setIsEditingName(true)} className="p-1 text-icon hover:text-primary transition-colors" title="Đổi tên thiết bị">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </h2>
              )}
            </div>
            <div className="flex items-center space-x-2 mt-1">
              <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(device.status).split(' ')[1]}`} />
              <span className="text-xs font-semibold text-muted">{getStatusText(device.status)}</span>
              {device.roomName && (
                <>
                  <span className="text-xs text-muted/60">•</span>
                  <span className="text-xs text-muted">{device.roomName}</span>
                </>
              )}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-icon hover:text-text hover:bg-line rounded-full transition-colors"
            title="Đóng (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 space-y-5 bg-app">
          
          {/* Controls Section */}
          <div className="gentle-rise" style={{ animationDelay: '50ms' }}>
            {renderControl()}
          </div>

          {/* Info Section */}
          <div className="surface-card p-4 sm:p-5 gentle-rise" style={{ animationDelay: '100ms' }}>
            <h3 className="text-sm font-bold text-text mb-3 flex items-center space-x-2">
              <Tag className="w-4 h-4 text-icon" />
              <span>Thông tin thiết bị</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="flex justify-between py-1 border-b border-line border-dashed">
                <span className="text-muted">Loại:</span>
                <span className="font-medium text-text">{getFriendlyDeviceTypeName(device.deviceType)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-line border-dashed">
                <span className="text-muted">Phòng:</span>
                <span className="font-medium text-text">{device.roomName || 'Không có'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-line border-dashed">
                <span className="text-muted">Node:</span>
                <span className="font-medium text-text">{device.nodeName || device.nodeId || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-line border-dashed">
                <span className="text-muted">ID:</span>
                <span className="font-mono text-xs text-text">{device.id.substring(0, 8)}...</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-line border-dashed sm:col-span-2">
                <span className="text-muted flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Công suất định mức:</span>
                </span>
                {isEditingWattage ? (
                  <div className="flex items-center space-x-1.5">
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={editWattage}
                      onChange={(e) => setEditWattage(e.target.value)}
                      placeholder={String(deviceEnergy?.wattage ?? 60)}
                      className="w-20 px-2 py-0.5 text-right border border-line rounded-md text-text focus:outline-none focus:border-primary text-sm font-bold bg-surface"
                      autoFocus
                    />
                    <span className="text-xs text-muted">W</span>
                    <button 
                      onClick={handleUpdateWattage} 
                      disabled={isSavingWattage}
                      className="p-1 text-success hover:bg-success-soft rounded-md transition-colors"
                      title="Lưu công suất"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => {
                        setIsEditingWattage(false);
                        setEditWattage(String(device.settings?.wattage || ''));
                      }} 
                      className="p-1 text-muted hover:bg-line rounded-md transition-colors"
                      title="Hủy"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-text">
                      {device.settings?.wattage ? (
                        <span className="text-primary font-bold">{device.settings.wattage} W <span className="text-[10px] font-normal text-muted">(Tùy chỉnh)</span></span>
                      ) : (
                        <span>{deviceEnergy?.wattage ?? 60} W <span className="text-[10px] font-normal text-muted">(Mặc định)</span></span>
                      )}
                    </span>
                    <button 
                      onClick={() => {
                        setEditWattage(String(device.settings?.wattage || deviceEnergy?.wattage || 60));
                        setIsEditingWattage(true);
                      }} 
                      className="p-1 text-icon hover:text-primary transition-colors"
                      title="Tùy chỉnh công suất thiết bị"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              {device.gpioPin !== undefined && (
                <div className="flex justify-between py-1 border-b border-line border-dashed sm:col-span-2">
                  <span className="text-muted">GPIO:</span>
                  <span className="font-medium text-text">{device.gpioPin}</span>
                </div>
              )}
            </div>
          </div>

          {/* Device Shadow [PHO-048] */}
          <DeviceShadowSection deviceId={device.id} deviceType={device.deviceType} />

          {/* Energy Summary Widget */}
          {deviceEnergy && (
            <div className="surface-card p-4 gentle-rise border-amber-500/20 bg-amber-500/5" style={{ animationDelay: '120ms' }}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-amber-700 flex items-center space-x-1.5">
                  <Zap className="w-4 h-4 text-amber-600 fill-amber-500" />
                  <span>Năng lượng tiêu thụ (30 ngày)</span>
                </h3>
                {device.homeId && (
                  <button
                    onClick={() => {
                      onClose();
                      navigate(`/home/${device.homeId}/energy`);
                    }}
                    className="text-xs text-amber-700 hover:text-amber-800 font-semibold flex items-center gap-0.5 transition-colors"
                  >
                    <span>Chi tiết</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="p-2 rounded-xl bg-white/70 border border-amber-200/50">
                  <p className="text-[10px] text-muted font-medium">Tiêu thụ</p>
                  <p className="text-sm font-bold text-text">{(deviceEnergy.energyKwh ?? deviceEnergy.kwh ?? 0).toFixed(2)} <span className="text-[10px] font-normal text-muted">kWh</span></p>
                </div>
                <div className="p-2 rounded-xl bg-white/70 border border-amber-200/50">
                  <p className="text-[10px] text-muted font-medium">Ước tính tiền</p>
                  <p className="text-sm font-bold text-amber-600">{Math.round(deviceEnergy.estimatedCostVnd ?? deviceEnergy.costVnd ?? 0).toLocaleString('vi-VN')} <span className="text-[10px] font-normal text-muted">đ</span></p>
                </div>
                <div className="p-2 rounded-xl bg-white/70 border border-amber-200/50">
                  <p className="text-[10px] text-muted font-medium">Công suất / Giờ</p>
                  <p className="text-sm font-bold text-text">{deviceEnergy.ratedPowerWatts ?? deviceEnergy.wattage ?? 0}W <span className="text-[10px] font-normal text-muted">/ {(deviceEnergy.runtimeHours ?? deviceEnergy.totalOnHours ?? 0).toFixed(0)}h</span></p>
                </div>
              </div>
            </div>
          )}

          {/* Uptime Availability Card [PHO-034] */}
          {uptimeData && (
            <div className="surface-card p-4 gentle-rise border-emerald-500/20 bg-emerald-500/5" style={{ animationDelay: '130ms' }}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-emerald-800 flex items-center space-x-1.5">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  <span>Tần suất Hoạt động & Vận hành (7 ngày qua)</span>
                </h3>
                <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">
                  {uptimeData.uptimePercent.toFixed(1)}%
                </span>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>Tổng thời gian: <b className="text-text">{uptimeData.totalHours}h</b></span>
                  <span>Bật: <b className="text-emerald-600 font-semibold">{uptimeData.onHours}h</b> • Tắt: <b className="text-slate-500">{uptimeData.offHours}h</b></span>
                </div>

                {/* Thanh dải 24h thể hiện các khung giờ BẬT (xanh) / TẮT (xám) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-muted font-mono">
                    <span>00:00</span>
                    <span>24 Khung giờ hoạt động thực tế hôm nay</span>
                    <span>23:00</span>
                  </div>
                  <div className="flex gap-0.5 p-1 bg-white/70 border border-emerald-200/50 rounded-lg overflow-hidden">
                    {(uptimeData.timelinePoints && uptimeData.timelinePoints.length > 0
                      ? uptimeData.timelinePoints
                      : Array.from({ length: 24 }, (_, i) => ({
                          hour: i,
                          state: 'OFF' as const,
                          durationSeconds: 0,
                        }))
                    ).map((pt) => {
                      const isOn = pt.state === 'ON';
                      const activeMinutes = Math.round((pt.durationSeconds || 0) / 60);
                      const tooltip = `${String(pt.hour).padStart(2, '0')}:00 - ${
                        isOn
                          ? `BẬT (${activeMinutes > 0 ? `${activeMinutes} phút` : 'Đang hoạt động'})`
                          : 'TẮT (0 phút)'
                      }`;
                      return (
                        <div
                          key={pt.hour}
                          title={tooltip}
                          className={`flex-1 h-5 rounded-xs transition-colors cursor-pointer ${
                            isOn
                              ? 'bg-emerald-500 hover:bg-emerald-400 shadow-2xs shadow-emerald-500/50'
                              : 'bg-slate-200 hover:bg-slate-300'
                          }`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted pt-0.5">
                    <span>* Di chuột để xem số phút bật trong từng giờ</span>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-xs bg-emerald-500" /> Bật
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-xs bg-slate-200" /> Tắt
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Relay Health Card [PHO-042] (Chỉ hiển thị cho thiết bị đóng ngắt rơ-le / công tắc, không áp dụng cho cảm biến) */}
          {healthData && !device.deviceType?.endsWith('SENSOR') && device.deviceType !== 'CAMERA' && (
            <div className="surface-card p-4 gentle-rise border-sky-500/20 bg-sky-500/5" style={{ animationDelay: '140ms' }}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-sky-800 flex items-center space-x-1.5">
                  <HeartPulse className="w-4 h-4 text-sky-600" />
                  <span>Tuổi Thọ Phần Cứng (Relay Health)</span>
                </h3>
                {healthData.chatteringWarning ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-pulse shadow-sm shadow-rose-500/40" title="Cảnh báo tần suất đóng ngắt bất thường (Rung rơ-le)">
                    <BellRing className="w-3 h-3" />
                    Rung Rơ-le!
                  </span>
                ) : healthData.safetyTripped ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white" title="Rơ-le đã ngắt an toàn">
                    Đã Ngắt An Toàn
                  </span>
                ) : null}
              </div>

              <div className="space-y-2.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted">Độ bền còn lại:</span>
                  <span className={`text-base font-extrabold ${
                    healthData.healthPercent >= 80 ? 'text-emerald-600' : healthData.healthPercent >= 50 ? 'text-amber-600' : 'text-rose-600'
                  }`}>
                    {healthData.healthPercent.toFixed(1)}%
                  </span>
                </div>

                {/* Progress Bar Relay Health */}
                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden p-0.5">
                  <div
                    style={{ width: `${Math.min(Math.max(healthData.healthPercent, 0), 100)}%` }}
                    className={`h-full rounded-full transition-all ${
                      healthData.healthPercent >= 80 ? 'bg-emerald-500' : healthData.healthPercent >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="p-2 rounded-xl bg-white/70 border border-sky-200/40">
                    <p className="text-[10px] text-muted">Chu kỳ đóng ngắt</p>
                    <p className="font-mono font-bold text-text">
                      {healthData.switchCycles.toLocaleString()} / <span className="text-muted font-normal">{healthData.maxRatedCycles.toLocaleString()}</span>
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-white/70 border border-sky-200/40">
                    <p className="text-[10px] text-muted">Lần đóng ngắt cuối</p>
                    <p className="text-[11px] font-medium text-text truncate" title={healthData.lastCycleAt}>
                      {healthData.lastCycleAt ? new Date(healthData.lastCycleAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Chưa có'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* History Timeline */}
          <div className="surface-card p-4 gentle-rise" style={{ animationDelay: '150ms' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-text flex items-center space-x-2">
                <Activity className="w-4 h-4 text-icon" />
                <span>Lịch sử hoạt động</span>
              </h3>
              {history.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={isExporting}
                    onClick={async () => {
                      if (!device) return;
                      setIsExporting(true);
                      try {
                        await exportDeviceHistoryCsv(device.id, `lich_su_${device.name.replace(/\s+/g, '_')}.csv`);
                        notify('Đã tải xuống file báo cáo CSV thành công', 'success');
                      } catch (e) {
                        notify('Lỗi khi xuất file CSV', 'error');
                      } finally {
                        setIsExporting(false);
                      }
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg border border-line bg-surface hover:bg-off-soft text-text transition-colors shadow-xs"
                    title="Xuất file CSV báo cáo lịch sử hoạt động"
                  >
                    <Download className="w-3.5 h-3.5 text-primary" />
                    <span>{isExporting ? '...' : 'CSV'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={isExportingExcel}
                    onClick={async () => {
                      if (!device) return;
                      setIsExportingExcel(true);
                      try {
                        await exportDeviceHistoryExcel(device.id, `lich_su_${device.name.replace(/\s+/g, '_')}.xlsx`);
                        notify('Đã tải xuống file báo cáo Excel (.xlsx) thành công', 'success');
                      } catch (e) {
                        notify('Lỗi khi xuất file Excel', 'error');
                      } finally {
                        setIsExportingExcel(false);
                      }
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition-colors shadow-xs"
                    title="Xuất báo cáo Excel (.xlsx) kiểm toán 30 ngày qua"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isExportingExcel ? 'Đang xuất...' : 'Xuất Excel'}</span>
                  </button>
                </div>
              )}
            </div>
            
            {isLoadingHistory ? (
              <div className="flex justify-center p-4">
                <Clock className="w-5 h-5 text-muted animate-spin" />
              </div>
            ) : history.length > 0 ? (
              <div className="space-y-4 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                {history.map((record) => (
                  <div key={record.id} className="relative pl-4 border-l-2 border-line pb-4 last:pb-0">
                    <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-primary" />
                    <div className="flex items-center space-x-2 mb-1.5 flex-wrap">
                      <span className="text-xs font-mono font-medium text-muted">
                        {new Date(record.changedAt).toLocaleString('vi-VN', { 
                          hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' 
                        })}
                      </span>
                      {renderSourceBadge(record.source)}
                    </div>
                    <div className="text-xs text-text flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium border border-slate-200">
                        {formatState(record.previousState as Record<string, unknown>)}
                      </span>
                      <span className="text-muted font-bold">→</span>
                      <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-semibold border border-primary/20">
                        {formatState(record.newState as Record<string, unknown>)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted text-center py-4">Chưa có lịch sử hoạt động</p>
            )}
          </div>

          {/* Overrides */}
          {(overrides.length > 0 || isOverrideActive) && (
            <div className="surface-card p-4 gentle-rise border-warning/30 bg-warning-soft/20" style={{ animationDelay: '200ms' }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-warning-dark flex items-center space-x-2">
                  <ShieldX className="w-4 h-4 text-warning" />
                  <span>Khóa ghi đè tự động</span>
                </h3>
                {isOverrideActive && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full bg-amber-200 text-amber-900 border border-amber-300 animate-pulse">
                    🔒 {formattedTime}
                  </span>
                )}
              </div>

              {isOverrideActive && (
                <div className="mb-3 p-2.5 rounded-xl bg-white/80 border border-warning/40 flex items-center justify-between">
                  <p className="text-xs text-muted">Đang ưu tiên người dùng (bỏ qua quy tắc tự động).</p>
                  <button
                    type="button"
                    onClick={handleResumeAutomation}
                    className="ml-2 px-2.5 py-1 text-xs font-bold rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors shrink-0 shadow-xs"
                  >
                    Khôi phục ngay
                  </button>
                </div>
              )}

              <div className="space-y-3">
                {overrides.map(ov => (
                  <div key={ov.id} className="flex flex-col text-sm border-b border-line border-dashed pb-2 last:pb-0 last:border-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-text">{ov.action === 'RESUME' ? 'Khôi phục tự động' : ov.action === 'OVERRIDE' ? 'Ghi đè thủ công' : 'Hủy tự động'}</span>
                      <span className="text-xs text-muted">
                        {new Date(ov.occurredAt).toLocaleString('vi-VN')}
                      </span>
                    </div>
                    {ov.action !== 'RESUME' && <span className="text-xs text-muted">Đến: {new Date(ov.expiresAt).toLocaleString('vi-VN')}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-line bg-surface grid grid-cols-2 gap-3 shrink-0">
          <button
            onClick={handleCancelAutomation}
            className="flex items-center justify-center space-x-2 p-2.5 rounded-xl border border-warning/30 bg-warning-soft text-warning-dark hover:bg-warning hover:text-white transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            <span className="font-semibold text-sm">Hủy tự động</span>
          </button>
          
          <button
            onClick={handleRemoveDevice}
            className="flex items-center justify-center space-x-2 p-2.5 rounded-xl border border-error/30 bg-error-soft text-error hover:bg-error hover:text-white transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span className="font-semibold text-sm">Xóa thiết bị</span>
          </button>
        </div>

      </motion.div>
    </motion.div>
  );
};
