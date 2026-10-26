import React, { useState, useEffect } from 'react';
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Zap,
  Clock,
  Sparkles,
  Smartphone,
  Radio,
  Power,
} from 'lucide-react';
import type { DeviceShadowResponse } from '../../types/device';
import {
  getDeviceShadow,
  updateDesiredShadow,
  reconcileDeviceShadow,
} from '../../services/deviceApi';
import { notify } from '../ui/notify';
import { DeviceStateVisualizer } from './DeviceStateVisualizer';

interface DeviceShadowSectionProps {
  deviceId: string;
  deviceType?: string;
}

export const DeviceShadowSection: React.FC<DeviceShadowSectionProps> = ({ deviceId, deviceType }) => {
  const [shadow, setShadow] = useState<DeviceShadowResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchShadow = async () => {
    setIsLoading(true);
    try {
      const data = await getDeviceShadow(deviceId);
      setShadow(data);
    } catch {
      // Quiet fail if not found
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (deviceId) {
      fetchShadow();
    }
  }, [deviceId]);

  const handleReconcile = async () => {
    setIsReconciling(true);
    try {
      const res = await reconcileDeviceShadow(deviceId);
      setShadow(res);
      notify.success('Đã gửi lệnh đồng bộ', 'Thiết bị đang cập nhật theo đúng trạng thái mong muốn');
    } catch {
      notify.error('Lỗi khi gửi lệnh đồng bộ lại');
    } finally {
      setIsReconciling(false);
    }
  };

  const handleQuickDesired = async (powerState: 'ON' | 'OFF') => {
    setIsUpdating(true);
    try {
      const res = await updateDesiredShadow(deviceId, { power: powerState });
      setShadow(res);
      notify.success(`Đã phát lệnh: ${powerState === 'ON' ? 'BẬT THIẾT BỊ' : 'TẮT THIẾT BỊ'}`);
    } catch {
      notify.error('Không thể gửi lệnh điều khiển');
    } finally {
      setIsUpdating(false);
    }
  };

  if (!shadow && isLoading) {
    return (
      <div className="p-4 rounded-2xl bg-sidebar/50 border border-line animate-pulse h-32 flex items-center justify-center">
        <span className="text-xs text-muted">Đang kiểm tra trạng thái đồng bộ thiết bị...</span>
      </div>
    );
  }

  if (!shadow) return null;

  const deltaKeys = Object.keys(shadow.deltaState || {});
  const isInSync = shadow.inSync && deltaKeys.length === 0;

  return (
    <div className="p-5 rounded-2xl bg-sidebar/40 border border-line space-y-4">
      {/* Tiêu Đề & Trạng Thái Đồng Bộ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-text">
              Đồng Bộ Trạng Thái Thiết Bị (Lệnh Điều Khiển &amp; Thực Tế)
            </h4>
            <p className="text-[11px] text-muted">
              Đảm bảo thiết bị ngoài đời thực luôn chạy đúng theo lệnh bạn đã đặt trên ứng dụng
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
              isInSync
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse'
            }`}
          >
            {isInSync ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" /> Đã Đồng Bộ Hoàn Hảo
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5" /> Chờ Thiết Bị Cập Nhật ({deltaKeys.length} lệnh)
              </>
            )}
          </span>

          <button
            onClick={fetchShadow}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-surface transition-colors"
            title="Làm mới trạng thái đồng bộ"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2 Cột So Sánh Trực Quan: Lệnh Bạn Đặt vs Thực Tế */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Cột 1: Lệnh Mong Muốn (Cài Đặt Trên Ứng Dụng) */}
        <div className="p-4 rounded-2xl bg-surface border border-line space-y-2.5">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <span className="text-xs font-bold text-primary flex items-center gap-1.5">
              <Smartphone className="w-4 h-4" /> Lệnh Bạn Đã Cài Đặt (Trên App)
            </span>
            <span className="text-[10px] text-muted font-medium">Mong muốn</span>
          </div>

          <div className="space-y-2 text-xs">
            <DeviceStateVisualizer
              state={shadow.desiredState}
              compact
              emptyText="Chưa có lệnh cài đặt nào"
              showJsonToggle={false}
              deviceType={deviceType}
            />
          </div>

          <div className="text-[10px] text-muted flex items-center gap-1 pt-1.5 border-t border-line/60">
            <Clock className="w-3 h-3" />
            <span>Lệnh đặt lúc: {new Date(shadow.desiredUpdatedAt).toLocaleTimeString()}</span>
          </div>
        </div>

        {/* Cột 2: Thiết Bị Ngoài Đời Thực Báo Cáo */}
        <div className="p-4 rounded-2xl bg-surface border border-line space-y-2.5">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <span className="text-xs font-bold text-text flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-emerald-500" /> Trạng Thái Thực Tế (Ngoài Đời)
            </span>
            <span className="text-[10px] text-muted font-medium">Thiết bị phản hồi</span>
          </div>

          <div className="space-y-2 text-xs">
            <DeviceStateVisualizer
              state={shadow.reportedState}
              compact
              emptyText="Thiết bị chưa gửi phản hồi"
              showJsonToggle={false}
              deviceType={deviceType}
            />
          </div>

          <div className="text-[10px] text-muted flex items-center gap-1 pt-1.5 border-t border-line/60">
            <Clock className="w-3 h-3" />
            <span>Thiết bị xác nhận lúc: {new Date(shadow.reportedUpdatedAt).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* Cảnh Báo Lệch Trạng Thái & Nút Bấm Xử Lý */}
      {!isInSync && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-amber-700 dark:text-amber-400 space-y-0.5">
            <p className="font-bold flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Thiết bị thực tế chưa kịp nhận lệnh mới nhất
            </p>
            <p className="text-[11px] opacity-90">
              Có {deltaKeys.length} cài đặt đang chờ đồng bộ (Ví dụ: Bạn đã đặt bật nhưng thiết bị chưa phản hồi do mạng trễ).
            </p>
          </div>

          <button
            onClick={handleReconcile}
            disabled={isReconciling}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isReconciling ? 'animate-spin' : ''}`} />
            Gửi Lại Lệnh Để Đồng Bộ Ngay
          </button>
        </div>
      )}

      {/* Khu Vực Thử Nghiệm Nhanh */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-line text-xs">
        <span className="text-muted text-[11px] flex items-center gap-1">
          <Power className="w-3.5 h-3.5 text-primary" />
          Kiểm tra tốc độ phản hồi của thiết bị:
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleQuickDesired('ON')}
            disabled={isUpdating}
            className="px-3 py-1.5 rounded-xl border border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <Zap className="w-3 h-3 text-emerald-500" />
            Bật thử thiết bị
          </button>
          <button
            onClick={() => handleQuickDesired('OFF')}
            disabled={isUpdating}
            className="px-3 py-1.5 rounded-xl border border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <Power className="w-3 h-3 text-red-500" />
            Tắt thử thiết bị
          </button>
        </div>
      </div>
    </div>
  );
};
