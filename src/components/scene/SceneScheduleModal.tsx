import React from 'react';
import { X, Calendar } from 'lucide-react';
import { SchedulePanel } from '../ui/SchedulePanel';
import type { SceneResponse } from '../../types/scene';

interface SceneScheduleModalProps {
  homeId: string;
  scene: SceneResponse;
  onClose: () => void;
}

export const SceneScheduleModal: React.FC<SceneScheduleModalProps> = ({
  homeId,
  scene,
  onClose,
}) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Cài đặt lịch chạy kịch bản ${scene.name}`}
    >
      <div className="surface-card w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4 bg-sidebar/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Calendar size={18} />
            </div>
            <div>
              <h3 className="font-bold text-base text-text">Lịch trình tự động</h3>
              <p className="text-xs text-muted">
                Kịch bản: <span className="font-semibold text-text">{scene.name}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-muted hover:text-text hover:bg-sidebar transition-colors"
            title="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <SchedulePanel homeId={homeId} kind="scenes" targetId={scene.id} />
        </div>

        {/* Footer */}
        <div className="border-t border-line px-6 py-3.5 bg-sidebar/30 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-sidebar hover:bg-sidebar-hover text-text transition-colors"
          >
            Hoàn tất
          </button>
        </div>
      </div>
    </div>
  );
};
