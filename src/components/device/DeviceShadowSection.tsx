import React, { useState, useEffect } from 'react';
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Zap,
  ArrowRight,
  Clock,
  Sparkles,
} from 'lucide-react';
import type { DeviceShadowResponse } from '../../types/device';
import {
  getDeviceShadow,
  updateDesiredShadow,
  reconcileDeviceShadow,
} from '../../services/deviceApi';
import { notify } from '../ui/notify';

interface DeviceShadowSectionProps {
  deviceId: string;
}

export const DeviceShadowSection: React.FC<DeviceShadowSectionProps> = ({ deviceId }) => {
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
      notify.success('Đã kích hoạt Reconcile', 'Đang đẩy trạng thái mong muốn (Delta) đến Node');
    } catch {
      notify.error('Lỗi khi kích hoạt Reconcile');
    } finally {
      setIsReconciling(false);
    }
  };

  const handleQuickDesired = async (powerState: 'ON' | 'OFF') => {
    setIsUpdating(true);
    try {
      const res = await updateDesiredShadow(deviceId, { power: powerState });
      setShadow(res);
      notify.success(`Đã cập nhật Desired State = ${powerState}`);
    } catch {
      notify.error('Lỗi khi cập nhật Desired State');
    } finally {
      setIsUpdating(false);
    }
  };

  if (!shadow && isLoading) {
    return (
      <div className="p-4 rounded-2xl bg-sidebar/50 border border-line animate-pulse h-32 flex items-center justify-center">
        <span className="text-xs text-muted">Đang tải Device Shadow...</span>
      </div>
    );
  }

  if (!shadow) return null;

  const deltaKeys = Object.keys(shadow.deltaState || {});
  const isInSync = shadow.inSync && deltaKeys.length === 0;

  return (
    <div className="p-5 rounded-2xl bg-sidebar/40 border border-line space-y-4">
      {/* Header & Sync Status */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-primary/10 text-primary">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-text">Bóng Thiết Bị (Device Shadow)</h4>
            <p className="text-[11px] text-muted">Mô hình AWS IoT Device Shadow phân tách Desired vs Reported</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
              isInSync
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse'
            }`}
          >
            {isInSync ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" /> Đồng Bộ (In-Sync)
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5" /> Lệch {deltaKeys.length} trường (Delta)
              </>
            )}
          </span>

          <button
            onClick={fetchShadow}
            disabled={isLoading}
            className="p-1 rounded-lg text-muted hover:text-text hover:bg-surface transition-colors"
            title="Làm mới Shadow"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Side-by-Side Comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Desired Column */}
        <div className="p-3.5 rounded-xl bg-surface border border-line space-y-2">
          <div className="flex items-center justify-between border-b border-line pb-1.5">
            <span className="text-xs font-bold text-primary flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Trạng Thái Mong Muốn (Desired)
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">
              v{shadow.desiredVersion}
            </span>
          </div>

          <div className="space-y-1 font-mono text-xs">
            {Object.keys(shadow.desiredState || {}).length === 0 ? (
              <span className="text-muted text-[11px]">Chưa có desired state</span>
            ) : (
              Object.entries(shadow.desiredState).map(([k, v]) => (
                <div key={k} className="flex justify-between py-0.5">
                  <span className="text-muted">{k}:</span>
                  <span className="font-semibold text-text">{String(v)}</span>
                </div>
              ))
            )}
          </div>
          <div className="text-[10px] text-muted flex items-center gap-1 pt-1">
            <Clock className="w-3 h-3" />
            <span>Cập nhật: {new Date(shadow.desiredUpdatedAt).toLocaleTimeString()}</span>
          </div>
        </div>

        {/* Reported Column */}
        <div className="p-3.5 rounded-xl bg-surface border border-line space-y-2">
          <div className="flex items-center justify-between border-b border-line pb-1.5">
            <span className="text-xs font-bold text-text flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" /> Báo Cáo Thực Tế (Reported)
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sidebar text-muted font-bold">
              v{shadow.reportedVersion}
            </span>
          </div>

          <div className="space-y-1 font-mono text-xs">
            {Object.keys(shadow.reportedState || {}).length === 0 ? (
              <span className="text-muted text-[11px]">Chưa có reported state</span>
            ) : (
              Object.entries(shadow.reportedState).map(([k, v]) => (
                <div key={k} className="flex justify-between py-0.5">
                  <span className="text-muted">{k}:</span>
                  <span className="font-semibold text-text">{String(v)}</span>
                </div>
              ))
            )}
          </div>
          <div className="text-[10px] text-muted flex items-center gap-1 pt-1">
            <Clock className="w-3 h-3" />
            <span>Xác nhận: {new Date(shadow.reportedUpdatedAt).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* Delta Inspector & Actions */}
      {!isInSync && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-amber-600">
            <strong>Delta cần bù:</strong>{' '}
            {deltaKeys.map((k) => `${k} -> ${shadow.deltaState[k]}`).join(', ')}
          </div>
          <button
            onClick={handleReconcile}
            disabled={isReconciling}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors shadow-sm disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isReconciling ? 'animate-spin' : ''}`} />
            Đồng Bộ Bù Trạng Thái (Reconcile)
          </button>
        </div>
      )}

      {/* Quick Test Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line text-xs">
        <span className="text-muted text-[11px]">Thử nghiệm thay đổi Desired State:</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleQuickDesired('ON')}
            disabled={isUpdating}
            className="px-2.5 py-1 rounded-lg border border-line hover:border-emerald-500 hover:text-emerald-500 text-[11px] font-semibold transition-colors disabled:opacity-50"
          >
            Đặt Desired: ON
          </button>
          <button
            onClick={() => handleQuickDesired('OFF')}
            disabled={isUpdating}
            className="px-2.5 py-1 rounded-lg border border-line hover:border-red-500 hover:text-red-500 text-[11px] font-semibold transition-colors disabled:opacity-50"
          >
            Đặt Desired: OFF
          </button>
        </div>
      </div>
    </div>
  );
};
