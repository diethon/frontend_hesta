import React, { useState } from 'react';
import type { DeviceResponse, DeviceStateHistoryResponse, ManualOverrideRecord } from '../../types/device';
import { removeDevice, getDeviceHistory, cancelDeviceAutomation, getDeviceOverrideHistory, updateDeviceConfig } from '../../services/deviceApi';
import { getErrorMessage } from '../../utils/errors';
import { notify } from '../ui/notify';

interface DeviceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  device: DeviceResponse | null;
  onDeviceRemoved: (deviceId: string) => void;
  onDeviceUpdated: (device: DeviceResponse) => void;
  onColorChange?: (deviceId: string, r: number, g: number, b: number) => void;
  onTempChange?: (deviceId: string, temp: number) => void;
  onModeChange?: (deviceId: string, mode: string) => void;
}

export const DeviceDetailModal: React.FC<DeviceDetailModalProps> = ({
  isOpen,
  onClose,
  device,
  onDeviceRemoved,
  onDeviceUpdated,
  onColorChange,
  onTempChange,
  onModeChange
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState<DeviceStateHistoryResponse[]>([]);
  const [overrides, setOverrides] = useState<ManualOverrideRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [cancelPending, setCancelPending] = useState(false);
  const [cancelMessage, setCancelMessage] = useState('');

  React.useEffect(() => {
    if (isOpen && device) {
      const fetchHistory = async () => {
        try {
          setLoadingHistory(true);
          const [data, overrideData] = await Promise.all([getDeviceHistory(device.id), getDeviceOverrideHistory(device.id)]);
          setHistory(data || []);
          setOverrides(overrideData || []);
        } catch (err) {
          setError(getErrorMessage(err, 'Không thể tải lịch sử thiết bị.'));
        } finally {
          setLoadingHistory(false);
        }
      };
      fetchHistory();
    }
  }, [isOpen, device]);

  if (!isOpen || !device) return null;

  const handleDelete = async () => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa thiết bị "${device.name}" khỏi nhà không?`)) {
      return;
    }
    
    setIsDeleting(true);
    try {
      await removeDevice(device.id);
      onDeviceRemoved(device.id);
      onClose();
      notify.success('Đã xóa thiết bị', device.name);
    } catch (err: unknown) {
      notify.error(getErrorMessage(err, 'Lỗi khi xóa thiết bị'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = async () => {
    if (!isEditMode) {
      setEditName(device.name);
      setError('');
      setIsEditMode(true);
      return;
    }

    if (editName.trim() === '') {
      setError('Tên thiết bị không được để trống');
      return;
    }

    if (editName.trim() === device.name) {
      setIsEditMode(false);
      return;
    }

    setIsUpdating(true);
    setError('');
    try {
      const updatedDevice = await updateDeviceConfig(device.id, { name: editName.trim() });
      onDeviceUpdated(updatedDevice);
      setIsEditMode(false);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Lỗi khi cập nhật cấu hình'));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelAutomation = async () => {
    setCancelPending(true); setError(''); setCancelMessage('');
    try {
      const until = await cancelDeviceAutomation(device.id);
      setOverrides(await getDeviceOverrideHistory(device.id));
      setCancelMessage(`Đã tạm dừng tự động hóa đến ${new Date(until).toLocaleString('vi-VN')}.`);
    } catch (caught) { setError(getErrorMessage(caught, 'Không thể tạm dừng tự động hóa.')); }
    finally { setCancelPending(false); }
  };

  const getStatusColor = () => {
    switch (device.status) {
      case 'ONLINE': return 'bg-emerald-500';
      case 'OFFLINE': return 'bg-slate-500';
      case 'ERROR': return 'bg-rose-500';
      default: return 'bg-amber-500';
    }
  };

  const getStatusText = () => {
    switch (device.status) {
      case 'ONLINE': return 'Đang hoạt động';
      case 'OFFLINE': return 'Ngoại tuyến';
      case 'ERROR': return 'Lỗi thiết bị';
      default: return 'Không xác định';
    }
  };

  const renderIcon = () => {
    if (device.icon) return device.icon;
    switch (device.deviceType) {
      case 'LIGHT': return '💡';
      case 'FAN': return '🌬️';
      case 'AC': return '❄️';
      case 'SENSOR': return '🌡️';
      case 'LOCK': return '🔒';
      case 'SOCKET': return '🔌';
      default: return '📦';
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Chưa kết nối';
    return new Date(dateStr).toLocaleString('vi-VN');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-text/30 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="device-detail-title" className="auth-surface gentle-rise flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden overscroll-contain">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center shrink-0">
          <h3 id="device-detail-title" className="text-lg font-bold text-text">Chi tiết thiết bị</h3>
          <button type="button" aria-label="Đóng chi tiết thiết bị" onClick={onClose} className="rounded-lg p-1 text-icon transition-colors hover:bg-sidebar-hover hover:text-text">
            <svg aria-hidden={true} className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto">
          {error && (
            <div role="alert" aria-live="polite" className="text-rose-400 bg-rose-950/30 p-3 rounded-lg border border-rose-900/50 text-sm">
              {error}
            </div>
          )}
          {cancelMessage && <p role="status" className="rounded-xl bg-success-soft p-3 text-sm text-text">{cancelMessage}</p>}

                      <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-slate-800 rounded-xl flex items-center justify-center text-3xl shrink-0">
                {renderIcon()}
              </div>
              <div className="min-w-0 flex-1">
                {isEditMode ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-bold text-lg focus:outline-none focus:border-indigo-500"
                    autoFocus
                  />
                ) : (
                  <h4 className="text-xl font-bold text-text truncate" title={device.name}>{device.name}</h4>
                )}
                <p className="text-sm text-slate-400 flex items-center gap-1.5 mt-1">
                  <span className={`inline-block w-2 h-2 rounded-full ${getStatusColor()}`} />
                  {getStatusText()}
                </p>
              </div>
            </div>

          <div className="space-y-3 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
            <div className="flex justify-between items-center gap-4">
              <span className="text-sm text-slate-400 shrink-0">Mã định danh (ID):</span>
              <span className="text-sm text-text font-mono truncate" title={device.id}>{device.id}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">Loại thiết bị:</span>
              <span className="text-sm text-text font-medium bg-sidebar px-2 py-0.5 rounded">{device.deviceType}</span>
            </div>

            {device.nodeId && (
              <div className="flex justify-between items-center gap-4">
                <span className="text-sm text-slate-400 shrink-0">Node quản lý:</span>
                <span className="text-sm text-text font-medium truncate" title={device.nodeId}>{device.nodeName || device.nodeId}</span>
              </div>
            )}

            {device.gpioPin !== undefined && device.gpioPin !== null && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">GPIO Pin:</span>
                <span className="text-sm text-cyan-400 font-mono">{device.gpioPin}</span>
              </div>
            )}

            {device.roomId && (
              <div className="flex justify-between items-center gap-4">
                <span className="text-sm text-slate-400 shrink-0">Phòng (Room):</span>
                <span className="text-sm text-text font-medium truncate" title={device.roomId}>{device.roomName || device.roomId}</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">Lần cuối phản hồi:</span>
              <span className="text-sm text-text">{formatDate(device.lastSeen)}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">Tọa độ 3D (Twin):</span>
              <span className="text-sm text-text font-mono">
                X:{device.digitalTwinX ?? 0} Y:{device.digitalTwinY ?? 0} Z:{device.digitalTwinZ ?? 0}
              </span>
            </div>
            
            <div className="flex flex-col border-t border-slate-800 pt-3 mt-3 gap-2">
              <span className="text-sm text-slate-400">Trạng thái hiện tại:</span>
              <pre className="text-xs text-emerald-400 font-mono bg-slate-900 p-3 rounded-lg overflow-x-auto border border-slate-800/50">
                {JSON.stringify(device.currentState, null, 2)}
              </pre>
            </div>

            {/* GIAO DIỆN MÁY LẠNH (AIR_CONDITIONER) */}
            {device.deviceType === 'AIR_CONDITIONER' && (
              <div className="flex flex-col border-t border-slate-800 pt-3 mt-3 gap-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">Nhiệt độ mục tiêu: <span className="text-white font-bold">{String(device.currentState?.temperature || 24)}°C</span></span>
                  <input
                    type="range"
                    min="16" max="30" step="1"
                    defaultValue={Number(device.currentState?.temperature || 24)}
                    className="w-1/2 accent-cyan-500"
                    onChange={(e) => {
                      if (onTempChange) onTempChange(device.id, parseInt(e.target.value));
                    }}
                  />
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">Chế độ gió (Mode):</span>
                  <select
                    className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-2 py-1 focus:outline-none focus:border-cyan-500"
                    defaultValue={String(device.currentState?.mode || 'AUTO')}
                    onChange={(e) => {
                      if (onModeChange) onModeChange(device.id, e.target.value);
                    }}
                  >
                    <option value="AUTO">AUTO</option>
                    <option value="COOL">COOL</option>
                    <option value="DRY">DRY</option>
                    <option value="FAN">FAN</option>
                  </select>
                </div>
              </div>
            )}

            {(device.deviceType === 'LED' || device.deviceType === 'LED_RGB') && (
              <div className="flex flex-col border-t border-slate-800 pt-3 mt-3 gap-2">
                <span className="text-sm text-slate-400">Điều chỉnh màu sắc (RGB):</span>
                <input
                  type="color"
                  className="w-full h-12 rounded cursor-pointer bg-slate-900 border border-slate-700"
                  onChange={(e) => {
                    const hex = e.target.value;
                    const r = parseInt(hex.slice(1, 3), 16);
                    const g = parseInt(hex.slice(3, 5), 16);
                    const b = parseInt(hex.slice(5, 7), 16);
                    if (onColorChange) onColorChange(device.id, r, g, b);
                  }}
                  title="Chọn màu đèn LED"
                />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Lịch sử hoạt động gần đây</h4>
            {loadingHistory ? (
              <div role="status" className="text-sm text-slate-500 text-center py-4">Đang tải lịch sử…</div>
            ) : history.length === 0 ? (
              <div className="text-sm text-slate-500 text-center py-4 bg-slate-950/50 rounded-xl border border-slate-800 border-dashed">
                Chưa có lịch sử hoạt động
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {history.map((record) => (
                  <div key={record.id} className="bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs text-slate-400 font-mono">{formatDate(record.changedAt)}</span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {record.source}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="bg-slate-900 p-2 rounded text-slate-500 overflow-x-auto">
                        {JSON.stringify(record.previousState)}
                      </div>
                      <div className="bg-slate-900 p-2 rounded text-cyan-400 overflow-x-auto">
                        {JSON.stringify(record.newState)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <section className="mt-4 space-y-2 rounded-xl bg-sidebar p-3 text-sm text-text" aria-label="Lịch sử hủy và ghi đè tự động">
            <h4 className="font-semibold">Hủy và ghi đè tự động</h4>
            {overrides.length ? overrides.map((record) => <p key={record.id} className="border-b border-line py-1 last:border-0">
              {record.action === 'CANCEL' ? 'Hủy tự động' : 'Lệnh thủ công'} · {new Date(record.occurredAt).toLocaleString('vi-VN')} · hết hạn {new Date(record.expiresAt).toLocaleString('vi-VN')}
            </p>) : <p className="text-muted">Chưa có thao tác hủy hoặc ghi đè.</p>}
          </section>
        </div>

        <div className="flex flex-wrap justify-between gap-3 border-t border-line bg-surface p-4 shrink-0">
          <button type="button" onClick={() => void handleCancelAutomation()} disabled={cancelPending}
            className="rounded-xl bg-warning-soft px-4 py-2.5 text-sm font-medium text-text disabled:opacity-50">
            {cancelPending ? 'Đang tạm dừng...' : 'Hủy tự động 30 phút'}
          </button>
          <button
            onClick={handleEdit} disabled={isUpdating}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors text-sm"
          >
            {isUpdating ? 'Đang lưu...' : isEditMode ? 'Lưu thay đổi' : 'Chỉnh sửa'}
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 py-2.5 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 hover:border-rose-600 rounded-xl font-medium transition text-sm"
          >
            {isDeleting ? 'Đang xóa…' : 'Xóa thiết bị'}
          </button>
        </div>
      </div>
    </div>
  );
};

