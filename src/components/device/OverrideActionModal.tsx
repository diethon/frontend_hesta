import React, { useState } from 'react';
import { Clock, X, Lock, CheckCircle2 } from 'lucide-react';
import { resumeDeviceAutomation, extendDeviceAutomation } from '../../services/deviceApi';
import { notify } from '../ui/notify';
import { getErrorMessage } from '../../utils/errors';

interface OverrideActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId: string;
  deviceName: string;
  formattedTime?: string;
  onOverrideChanged?: () => void;
}

export const OverrideActionModal: React.FC<OverrideActionModalProps> = ({
  isOpen,
  onClose,
  deviceId,
  deviceName,
  formattedTime,
  onOverrideChanged,
}) => {
  const [loadingAction, setLoadingAction] = useState<'CANCEL' | 'EXTEND' | null>(null);

  if (!isOpen) return null;

  const handleCancelLock = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setLoadingAction('CANCEL');
      await resumeDeviceAutomation(deviceId);
      notify('Đã hủy khóa, khôi phục quyền điều khiển tự động', 'success');
      onOverrideChanged?.();
      onClose();
    } catch (err) {
      notify(getErrorMessage(err, 'Lỗi khi hủy khóa tự động hóa'), 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleExtendLock = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setLoadingAction('EXTEND');
      await extendDeviceAutomation(deviceId, 1);
      notify('Đã gia hạn khóa tự động hóa thêm 1 giờ', 'success');
      onOverrideChanged?.();
      onClose();
    } catch (err) {
      notify(getErrorMessage(err, 'Lỗi khi gia hạn khóa tự động hóa'), 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div 
        className="w-full max-w-sm rounded-2xl bg-surface border border-line p-5 shadow-float gentle-rise space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text">Quản Lý Khóa Tự Động</h3>
              <p className="text-xs text-muted truncate max-w-[200px]">{deviceName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-icon hover:text-text rounded-lg hover:bg-off-soft transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content info */}
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-300 space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-600" />
            Thời gian khóa còn lại: <span className="font-mono font-bold">{formattedTime || 'Đang khóa'}</span>
          </p>
          <p className="text-[11px] text-muted">
            Trong thời gian này, các kịch bản tự động hóa (Automation Rule) sẽ không can thiệp vào thiết bị.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            disabled={loadingAction !== null}
            onClick={handleCancelLock}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-line bg-surface hover:bg-off-soft text-text transition shadow-xs disabled:opacity-50"
          >
            {loadingAction === 'CANCEL' ? (
              <span className="w-3.5 h-3.5 border-2 border-text border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            )}
            <span>Hủy Khóa Ngay</span>
          </button>

          <button
            type="button"
            disabled={loadingAction !== null}
            onClick={handleExtendLock}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-primary hover:bg-primary-hover text-white transition shadow-xs disabled:opacity-50"
          >
            {loadingAction === 'EXTEND' ? (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Clock className="w-3.5 h-3.5" />
            )}
            <span>Khóa Thêm 1 Giờ</span>
          </button>
        </div>
      </div>
    </div>
  );
};
