import React, { useState, useEffect } from 'react';
import { X, Edit2, Check, Trash2, ShieldX, Clock, Tag, AlertTriangle, Activity } from 'lucide-react';
import type { DeviceResponse, DeviceStateHistoryResponse, ManualOverrideRecord } from '../../types/device';
import { 
  getDeviceHistory, 
  getDeviceOverrideHistory, 
  cancelDeviceAutomation, 
  updateDeviceConfig, 
  removeDevice 
} from '../../services/deviceApi';
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
}

export const DeviceDrawer: React.FC<DeviceDrawerProps> = ({
  isOpen,
  onClose,
  device,
  onDeviceRemoved,
  onDeviceUpdated,
  onTogglePower,
  onColorChange,
  onBrightnessChange
}) => {
  const [history, setHistory] = useState<DeviceStateHistoryResponse[]>([]);
  const [overrides, setOverrides] = useState<ManualOverrideRecord[]>([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    if (isOpen && device) {
      setEditName(device.name);
      setIsEditingName(false);
      fetchHistory(device.id);
    }
  }, [isOpen, device]);

  const fetchHistory = async (deviceId: string) => {
    setIsLoadingHistory(true);
    try {
      const [histRes, overRes] = await Promise.all([
        getDeviceHistory(deviceId),
        getDeviceOverrideHistory(deviceId)
      ]);
      setHistory(histRes);
      setOverrides(overRes);
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
      notify.success('Đã hủy tự động hóa');
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
    if (!state) return 'Không rõ';
    const parts = [];
    if (state.power) parts.push(state.power === 'ON' ? 'Bật nguồn' : 'Tắt nguồn');
    if (state.temperature) parts.push(`Nhiệt độ ${state.temperature}°C`);
    if (state.brightness) parts.push(`Độ sáng ${state.brightness}%`);
    if (state.motion) parts.push(state.motion === 'DETECTED' ? 'Phát hiện chuyển động' : 'Không có chuyển động');
    if (state.smoke) parts.push(state.smoke === 'DETECTED' ? 'Phát hiện khói' : 'An toàn');
    if (state.state) {
       if (state.state === 'OPEN') parts.push('Đã mở');
       if (state.state === 'CLOSED') parts.push('Đã đóng');
       if (state.state === 'STOPPED') parts.push('Đã dừng');
    }
    return parts.length > 0 ? parts.join(', ') : 'Cập nhật trạng thái';
  };

  const renderControl = () => {
    const effectiveType = resolveEffectiveType(device);
    switch (effectiveType) {
      case 'AIR_CONDITIONER':
        return <AcControl device={device} onStateChange={onDeviceUpdated} />;
      case 'LIGHT':
      case 'SMART_PLUG':
        return <LightControl device={device} onTogglePower={onTogglePower || (() => {})} />;
      case 'LED_RGB':
        return (
          <RgbLightControl 
            device={device} 
            onTogglePower={onTogglePower || (() => {})} 
            onColorChange={onColorChange || (() => {})} 
            onBrightnessChange={onBrightnessChange || (() => {})} 
          />
        );
      case 'GATE':
      case 'ROLLING_DOOR':
        return <GateControl device={device} onStateChange={onDeviceUpdated} />;
      case 'TEMP_HUMID_SENSOR':
      case 'MOTION_SENSOR':
      case 'SMOKE_SENSOR':
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
    <>
      <div 
        className="fixed inset-0 z-50 bg-text/20 backdrop-blur-sm drawer-overlay" 
        onClick={onClose} 
      />
      
      <div className="fixed inset-y-0 right-0 z-50 flex flex-col w-full md:w-full md:max-w-md bg-surface shadow-float drawer-enter border-l border-line">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-line bg-sidebar">
          <div className="flex flex-col flex-1">
            <div className="flex items-center space-x-2">
              {isEditingName ? (
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="px-2 py-1 border border-line rounded-md text-text focus:outline-none focus:border-primary"
                    autoFocus
                  />
                  <button onClick={handleUpdateName} className="p-1 text-success hover:bg-success-soft rounded-md">
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <h2 className="text-lg font-bold text-text flex items-center space-x-2">
                  <span>{device.name}</span>
                  <button onClick={() => setIsEditingName(true)} className="p-1 text-icon hover:text-primary transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </h2>
              )}
            </div>
            <div className="flex items-center space-x-1.5 mt-1">
              <div className={`w-2 h-2 rounded-full ${getStatusColor(device.status).split(' ')[1]}`} />
              <span className="text-xs font-medium text-muted">{getStatusText(device.status)}</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-icon hover:text-text hover:bg-line rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6 bg-app">
          
          {/* Controls Section */}
          <div className="gentle-rise" style={{ animationDelay: '50ms' }}>
            {renderControl()}
          </div>

          {/* Info Section */}
          <div className="surface-card p-4 gentle-rise" style={{ animationDelay: '100ms' }}>
            <h3 className="text-sm font-bold text-text mb-3 flex items-center space-x-2">
              <Tag className="w-4 h-4 text-icon" />
              <span>Thông tin thiết bị</span>
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1 border-b border-line border-dashed">
                <span className="text-muted">Loại:</span>
                <span className="font-medium text-text">{device.deviceType}</span>
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
              {device.gpioPin !== undefined && (
                <div className="flex justify-between py-1 border-b border-line border-dashed">
                  <span className="text-muted">GPIO:</span>
                  <span className="font-medium text-text">{device.gpioPin}</span>
                </div>
              )}
            </div>
          </div>

          {/* History Timeline */}
          <div className="surface-card p-4 gentle-rise" style={{ animationDelay: '150ms' }}>
            <h3 className="text-sm font-bold text-text mb-3 flex items-center space-x-2">
              <Activity className="w-4 h-4 text-icon" />
              <span>Lịch sử hoạt động</span>
            </h3>
            
            {isLoadingHistory ? (
              <div className="flex justify-center p-4">
                <Clock className="w-5 h-5 text-muted animate-spin" />
              </div>
            ) : history.length > 0 ? (
              <div className="space-y-4 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                {history.map((record) => (
                  <div key={record.id} className="relative pl-4 border-l-2 border-line pb-4 last:pb-0">
                    <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-primary" />
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-xs font-medium text-muted">
                        {new Date(record.changedAt).toLocaleString('vi-VN', { 
                          hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' 
                        })}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-off-soft text-text border border-line">
                        {record.source}
                      </span>
                    </div>
                    <div className="text-sm text-text">
                      {formatState(record.previousState as Record<string, unknown>)} → <span className="font-semibold">{formatState(record.newState as Record<string, unknown>)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted text-center py-4">Chưa có lịch sử hoạt động</p>
            )}
          </div>

          {/* Overrides */}
          {overrides.length > 0 && (
            <div className="surface-card p-4 gentle-rise border-warning/30 bg-warning-soft/20" style={{ animationDelay: '200ms' }}>
              <h3 className="text-sm font-bold text-warning-dark mb-3 flex items-center space-x-2">
                <ShieldX className="w-4 h-4 text-warning" />
                <span>Ghi đè tự động</span>
              </h3>
              <div className="space-y-3">
                {overrides.map(ov => (
                  <div key={ov.id} className="flex flex-col text-sm border-b border-line border-dashed pb-2 last:pb-0 last:border-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-text">{ov.action === 'OVERRIDE' ? 'Ghi đè' : 'Hủy'}</span>
                      <span className="text-xs text-muted">
                        {new Date(ov.occurredAt).toLocaleString('vi-VN')}
                      </span>
                    </div>
                    <span className="text-xs text-muted">Đến: {new Date(ov.expiresAt).toLocaleString('vi-VN')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-line bg-surface grid grid-cols-2 gap-3">
          <button
            onClick={handleCancelAutomation}
            className="flex items-center justify-center space-x-2 p-2.5 rounded-xl border border-warning/30 bg-warning-soft text-warning-dark hover:bg-warning hover:text-white transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            <span className="font-medium text-sm">Hủy tự động</span>
          </button>
          
          <button
            onClick={handleRemoveDevice}
            className="flex items-center justify-center space-x-2 p-2.5 rounded-xl border border-error/30 bg-error-soft text-error hover:bg-error hover:text-white transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span className="font-medium text-sm">Xóa thiết bị</span>
          </button>
        </div>

      </div>
    </>
  );
};
