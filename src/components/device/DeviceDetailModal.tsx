import React, { useState } from 'react';
import type { DeviceResponse, DeviceStateHistoryResponse } from '../../types/device';
import { removeDevice, getDeviceHistory } from '../../services/deviceApi';
import { getErrorMessage } from '../../utils/errors';

interface DeviceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  device: DeviceResponse | null;
  onDeviceRemoved: (deviceId: string) => void;
}

export const DeviceDetailModal: React.FC<DeviceDetailModalProps> = ({ isOpen, onClose, device, onDeviceRemoved }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<DeviceStateHistoryResponse[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  React.useEffect(() => {
    if (isOpen && device) {
      const fetchHistory = async () => {
        try {
          setLoadingHistory(true);
          const data = await getDeviceHistory(device.id);
          setHistory(data || []);
        } catch (err) {
          console.error('Lỗi tải lịch sử:', err);
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
    setError('');
    try {
      await removeDevice(device.id);
      onDeviceRemoved(device.id);
      onClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Lỗi khi xóa thiết bị'));
    } finally {
      setIsDeleting(false);
    }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center shrink-0">
          <h3 className="text-lg font-bold text-white">Chi tiết thiết bị</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto">
          {error && (
            <div className="text-rose-400 bg-rose-950/30 p-3 rounded-lg border border-rose-900/50 text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-slate-800 rounded-xl flex items-center justify-center text-3xl shrink-0">
              {renderIcon()}
            </div>
            <div className="min-w-0">
              <h4 className="text-xl font-bold text-white truncate" title={device.name}>{device.name}</h4>
              <p className="text-sm text-slate-400 flex items-center gap-1.5 mt-1">
                <span className={`inline-block w-2 h-2 rounded-full ${getStatusColor()}`} />
                {getStatusText()}
              </p>
            </div>
          </div>

          <div className="space-y-3 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
            <div className="flex justify-between items-center gap-4">
              <span className="text-sm text-slate-400 shrink-0">Mã định danh (ID):</span>
              <span className="text-sm text-white font-mono truncate" title={device.id}>{device.id}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">Loại thiết bị:</span>
              <span className="text-sm text-white font-medium bg-slate-800 px-2 py-0.5 rounded">{device.deviceType}</span>
            </div>

            {device.nodeId && (
              <div className="flex justify-between items-center gap-4">
                <span className="text-sm text-slate-400 shrink-0">Node quản lý:</span>
                <span className="text-sm text-white font-medium truncate" title={device.nodeId}>{device.nodeName || device.nodeId}</span>
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
                <span className="text-sm text-white font-medium truncate" title={device.roomId}>{device.roomName || device.roomId}</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">Lần cuối phản hồi:</span>
              <span className="text-sm text-white">{formatDate(device.lastSeen)}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">Tọa độ 3D (Twin):</span>
              <span className="text-sm text-white font-mono">
                X:{device.digitalTwinX ?? 0} Y:{device.digitalTwinY ?? 0} Z:{device.digitalTwinZ ?? 0}
              </span>
            </div>
            
            <div className="flex flex-col border-t border-slate-800 pt-3 mt-3 gap-2">
              <span className="text-sm text-slate-400">Trạng thái hiện tại:</span>
              <pre className="text-xs text-emerald-400 font-mono bg-slate-900 p-3 rounded-lg overflow-x-auto border border-slate-800/50">
                {JSON.stringify(device.currentState, null, 2)}
              </pre>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Lịch sử hoạt động gần đây</h4>
            {loadingHistory ? (
              <div className="text-sm text-slate-500 text-center py-4">Đang tải lịch sử...</div>
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
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-between gap-3 shrink-0">
          <button
            onClick={() => alert('Chức năng cập nhật cấu hình đang phát triển...')}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors text-sm"
          >
            Chỉnh sửa
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 py-2.5 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 hover:border-rose-600 rounded-xl font-medium transition-all text-sm"
          >
            {isDeleting ? 'Đang xóa...' : 'Xóa thiết bị'}
          </button>
        </div>
      </div>
    </div>
  );
};
