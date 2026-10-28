import React from 'react';
import type { DeviceSummary } from '../../types/automation';
import type { DraftSceneAction } from './sceneActions';
import { Icon, type IconName } from '../home/HomeIcons';
import { getFigmaIconForDevice } from './ScenePage';

export interface TestRunActionResult {
  deviceId: string;
  deviceName?: string;
  action: string;
  success: boolean;
  message?: string;
}

interface TestRunResultSheetProps {
  results: TestRunActionResult[];
  devices: DeviceSummary[];
  running: boolean;
  onRerun: () => void;
  onClose: () => void;
}

export const TestRunResultSheet: React.FC<TestRunResultSheetProps> = ({
  results,
  devices,
  running,
  onRerun,
  onClose,
}) => {
  const totalCount = results.length;
  const successCount = results.filter((r) => r.success).length;
  const allSuccess = totalCount > 0 && successCount === totalCount;

  return (
    <div className="sub-sheet-layer">
      <header className="sub-sheet-header">
        <div>
          <strong className="block">Kết quả chạy thử</strong>
          <span className="text-[11px] text-[var(--secondary)]">
            {running
              ? 'Đang thực thi các hành động…'
              : `${successCount}/${totalCount} hành động thành công`}
          </span>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Đóng"
        >
          <span className="text-xl leading-none">×</span>
        </button>
      </header>

      <div className="sub-sheet-scroll">
        {/* Banner summary */}
        <div
          className={`p-4 rounded-2xl border flex items-center gap-3 ${
            allSuccess
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-700'
          }`}
        >
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              allSuccess ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
            }`}
          >
            <Icon name={allSuccess ? 'check' : 'activity'} size={18} />
          </div>
          <div>
            <strong className="text-xs font-bold block">
              {allSuccess ? 'Tất cả lệnh chạy thành công' : 'Có một số lệnh không phản hồi'}
            </strong>
            <p className="text-[11px] opacity-80">
              {allSuccess
                ? 'Các thiết bị đã nhận và hoàn tất thao tác theo đúng thứ tự.'
                : 'Vui lòng kiểm tra kết nối mạng của các thiết bị có trạng thái lỗi bên dưới.'}
            </p>
          </div>
        </div>

        {/* Per-action results list */}
        <div className="space-y-2.5">
          {results.map((res, index) => {
            const dev = devices.find((d) => d.id === res.deviceId);
            const devName = res.deviceName || dev?.name || 'Thiết bị';
            const iconName: IconName = getFigmaIconForDevice(res.action, devName);

            return (
              <div
                key={index}
                className="p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--solid)] flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="action-step-bubble-36">
                    <Icon name={iconName} size={18} />
                  </div>
                  <div className="min-w-0">
                    <strong className="text-xs font-semibold text-[var(--text)] block truncate">
                      {devName}
                    </strong>
                    <span className="text-[11px] text-[var(--secondary)] block truncate">
                      {res.action}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                      res.success
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-rose-500/10 text-rose-600'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        res.success ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                    />
                    {res.success ? 'Thành công' : res.message || 'Không phản hồi'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <footer className="p-4 border-t border-[var(--border)] bg-[var(--solid)] flex justify-end gap-2">
        <button
          type="button"
          className="scene-ghost h-10 px-4 text-xs"
          onClick={onClose}
        >
          Đóng
        </button>
        <button
          type="button"
          className="add-device h-10 px-4 text-xs"
          disabled={running}
          onClick={onRerun}
        >
          {running ? 'Đang chạy lại…' : 'Chạy lại'}
        </button>
      </footer>
    </div>
  );
};
