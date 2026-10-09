import React, { useEffect, useState } from 'react';
import {
  X,
  History,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Zap,
  Calendar,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { getSceneExecutions } from '../../services/sceneApi';
import type { SceneExecutionResponse, SceneResponse } from '../../types/scene';

interface SceneHistoryModalProps {
  homeId: string;
  scene: SceneResponse;
  onClose: () => void;
}

export const SceneHistoryModal: React.FC<SceneHistoryModalProps> = ({
  homeId,
  scene,
  onClose,
}) => {
  const [executions, setExecutions] = useState<SceneExecutionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSceneExecutions(homeId, scene.id);
      setExecutions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải lịch sử chạy.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchHistory();
  }, [homeId, scene.id]);

  const getStatusBadge = (status: SceneExecutionResponse['status']) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-200">
            <CheckCircle2 size={12} /> Thành công
          </span>
        );
      case 'PARTIAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 border border-amber-200">
            <AlertTriangle size={12} /> Một phần
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 border border-rose-200">
            <XCircle size={12} /> Thất bại
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-500 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  const getTriggerSourceLabel = (source: SceneExecutionResponse['triggerSource']) => {
    switch (source) {
      case 'MANUAL':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            <Zap size={12} className="text-primary" /> Thủ công
          </span>
        );
      case 'SCHEDULE':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            <Calendar size={12} className="text-amber-500" /> Theo lịch
          </span>
        );
      case 'AUTOMATION':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            <Clock size={12} className="text-indigo-500" /> Tự động hóa
          </span>
        );
      default:
        return <span className="text-xs text-muted">{source}</span>;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Lịch sử kịch bản ${scene.name}`}
    >
      <div className="surface-card w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4 bg-sidebar/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <History size={18} />
            </div>
            <div>
              <h3 className="font-bold text-base text-text">Lịch sử kích hoạt</h3>
              <p className="text-xs text-muted">
                Kịch bản: <span className="font-semibold text-text">{scene.name}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={fetchHistory}
              disabled={loading}
              className="p-2 rounded-xl text-muted hover:text-text hover:bg-sidebar transition-colors"
              title="Làm mới"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-muted hover:text-text hover:bg-sidebar transition-colors"
              title="Đóng"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted">
              <Loader2 size={28} className="animate-spin text-primary mb-2" />
              <p className="text-sm">Đang tải lịch sử kịch bản...</p>
            </div>
          ) : executions.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 mx-auto rounded-full bg-sidebar flex items-center justify-center text-muted mb-3">
                <Clock size={24} />
              </div>
              <h4 className="font-semibold text-text text-sm">Chưa có lần chạy nào</h4>
              <p className="text-xs text-muted mt-1 max-w-xs mx-auto">
                Khi kịch bản được kích hoạt thủ công, theo lịch hoặc qua tự động hóa, thông tin chi tiết sẽ hiển thị tại đây.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {executions.map((item) => {
                const successCount = item.resultDetail.filter((d) => d.success).length;
                const totalCount = item.resultDetail.length;
                const dateStr = new Date(item.startedAt).toLocaleString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                });

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-line bg-surface p-4 transition-all hover:border-primary/40 shadow-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-2.5">
                      <div className="flex items-center gap-2.5">
                        {getStatusBadge(item.status)}
                        <span className="text-xs font-semibold text-text">{dateStr}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {getTriggerSourceLabel(item.triggerSource)}
                        <span className="text-xs font-medium text-muted bg-sidebar px-2 py-0.5 rounded-lg border border-line">
                          {successCount}/{totalCount} thành công
                        </span>
                      </div>
                    </div>

                    {/* Step details */}
                    <div className="mt-3 space-y-1.5">
                      {item.resultDetail.map((detail, index) => {
                        const targetDevice = scene.actions.find(
                          (a) => a.targetDeviceId === detail.deviceId,
                        );
                        const deviceName = targetDevice?.targetDeviceName || detail.deviceId;

                        return (
                          <div
                            key={`${detail.deviceId}-${index}`}
                            className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-sidebar/60 border border-line/40"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  detail.success ? 'bg-emerald-500' : 'bg-rose-500'
                                }`}
                              />
                              <span className="font-medium text-text truncate max-w-[180px]">
                                {deviceName}
                              </span>
                              <span className="text-muted">➔</span>
                              <span className="text-muted font-mono">{detail.action}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`text-[11px] font-semibold ${
                                  detail.success ? 'text-emerald-600' : 'text-rose-600'
                                }`}
                              >
                                {detail.status}
                              </span>
                              {detail.message && (
                                <span className="text-[11px] text-rose-500 italic max-w-[140px] truncate" title={detail.message}>
                                  ({detail.message})
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-line px-6 py-3.5 bg-sidebar/30 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-sidebar hover:bg-sidebar-hover text-text transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
