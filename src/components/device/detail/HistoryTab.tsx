import React, { useState } from 'react';
import { Download, FileSpreadsheet, Clock, History } from 'lucide-react';
import { Icon, type IconName } from '../../home/HomeIcons';
import type { DeviceStateHistoryResponse } from '../../../types/device';
import { exportDeviceHistoryCsv, exportDeviceHistoryExcel } from '../../../services/deviceApi';
import { notify } from '../../ui/notify';

export interface HistoryTabProps {
  deviceId?: string;
  deviceName?: string;
  historyData: DeviceStateHistoryResponse[];
  isLoading?: boolean;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({
  deviceId,
  deviceName,
  historyData,
  isLoading = false,
}) => {
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [visibleCount, setVisibleCount] = useState(50);

  const handleExportCsv = async () => {
    if (!deviceId) return;
    setIsExportingCsv(true);
    try {
      const cleanName = (deviceName || 'thiet_bi').replace(/\s+/g, '_');
      await exportDeviceHistoryCsv(deviceId, `lich_su_${cleanName}.csv`);
      notify.success('Đã xuất báo cáo CSV thành công');
    } catch (err) {
      console.warn('Export CSV error:', err);
      notify.error('Lỗi khi xuất file CSV');
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleExportExcel = async () => {
    if (!deviceId) return;
    setIsExportingExcel(true);
    try {
      const cleanName = (deviceName || 'thiet_bi').replace(/\s+/g, '_');
      await exportDeviceHistoryExcel(deviceId, `lich_su_${cleanName}.xlsx`);
      notify.success('Đã tải xuống file báo cáo Excel (.xlsx) thành công');
    } catch (err) {
      console.warn('Export Excel error:', err);
      notify.error('Lỗi khi xuất file Excel');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const getSourceBadge = (source?: string) => {
    const s = (source || '').toUpperCase();
    if (s === 'MANUAL') {
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
          Thủ công
        </span>
      );
    }
    if (s === 'AUTOMATION' || s === 'RULE') {
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          Tự động
        </span>
      );
    }
    if (s === 'SCENE') {
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
          Kịch bản
        </span>
      );
    }
    if (s === 'SCHEDULE') {
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
          Hẹn giờ
        </span>
      );
    }
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
        {source || 'Hệ thống'}
      </span>
    );
  };

  const resolveEventDetails = (h: DeviceStateHistoryResponse) => {
    let icon: IconName = 'power';
    let title = 'Thay đổi trạng thái';
    const p = h.newState?.power;

    if (p === 'ON' || p === true || p === 'true') {
      icon = 'power';
      title = h.source === 'MANUAL' ? 'Bật thủ công' : 'Bật tự động';
    } else if (p === 'OFF' || p === false || p === 'false') {
      icon = 'power';
      title = h.source === 'MANUAL' ? 'Tắt thủ công' : 'Tắt tự động';
    } else if (h.newState?.mode) {
      icon = 'snowflake';
      title = `Đổi chế độ sang ${h.newState.mode}`;
    } else if (h.newState?.temperature) {
      icon = 'thermometer';
      title = `Đặt nhiệt độ ${h.newState.temperature}°C`;
    } else if (h.newState?.brightness) {
      icon = 'lamp';
      title = `Độ sáng ${h.newState.brightness}%`;
    } else if (h.newState?.state) {
      icon = 'door';
      title = `Cổng: ${h.newState.state}`;
    }

    const time = new Date(h.changedAt).toLocaleString('vi-VN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return { icon, title, time };
  };

  return (
    <div className="detail-tab-panel" role="tabpanel" id="device-panel-history" aria-labelledby="device-tab-history">
      {/* Header with Export buttons */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--border)]">
        <div className="flex items-center gap-1.5">
          <History className="w-4 h-4 text-[var(--accent)]" />
          <strong className="text-sm font-bold text-[var(--text)]">Lịch sử sự kiện</strong>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={isExportingCsv || !deviceId}
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-xl border border-[var(--border)] bg-[var(--solid)] hover:bg-[var(--muted)] text-[var(--text)] transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
            title="Xuất file CSV báo cáo lịch sử hoạt động"
          >
            <Download className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>{isExportingCsv ? 'Đang xuất…' : 'Xuất CSV'}</span>
          </button>

          <button
            type="button"
            disabled={isExportingExcel || !deviceId}
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
            title="Xuất báo cáo Excel (.xlsx) kiểm toán 30 ngày qua"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{isExportingExcel ? 'Đang xuất…' : 'Xuất Excel'}</span>
          </button>
        </div>
      </div>

      {/* Timeline List or Empty State */}
      {historyData && historyData.length > 0 ? (
        <div className="detail-history-timeline">
          {historyData.slice(0, visibleCount).map((h, idx) => {
            const { icon, title, time } = resolveEventDetails(h);
            return (
              <div key={`${h.id || h.changedAt}-${idx}`} className="detail-history-item">
                <span className="detail-history-dot">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                </span>
                <div className="detail-history-card">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-[var(--solid)] text-[var(--secondary)] flex items-center justify-center shrink-0 border border-[var(--border)]">
                      <Icon name={icon} size={15} />
                    </span>
                    <div className="min-w-0">
                      <strong className="text-xs font-semibold text-[var(--text)] block truncate">{title}</strong>
                      <small className="text-[10px] text-[var(--secondary)] block">{time}</small>
                    </div>
                  </div>
                  <div className="shrink-0">{getSourceBadge(h.source)}</div>
                </div>
              </div>
            );
          })}
          {historyData.length > visibleCount && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + 50)}
                className="px-4 py-1.5 text-xs font-semibold rounded-xl border border-[var(--border)] bg-[var(--solid)] hover:bg-[var(--muted)] text-[var(--accent)] transition-colors cursor-pointer"
              >
                Xem thêm lịch sử ({historyData.length - visibleCount} mục khác)...
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="p-8 text-center rounded-2xl bg-[var(--solid)]/60 border border-dashed border-[var(--border)] space-y-2 mt-4">
          <Clock className="w-8 h-8 text-[var(--tertiary)] mx-auto opacity-50" />
          <strong className="text-xs font-semibold text-[var(--text)] block">
            {isLoading ? 'Đang tải dữ liệu lịch sử…' : 'Chưa có lịch sử hoạt động'}
          </strong>
          <p className="text-[11px] text-[var(--secondary)] max-w-xs mx-auto leading-relaxed">
            Các thao tác điều khiển thiết bị, kích hoạt kịch bản và tự động hóa sẽ được ghi nhận tại đây.
          </p>
        </div>
      )}
    </div>
  );
};
