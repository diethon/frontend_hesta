import React, { useState } from 'react';
import {
  Play,
  Check,
  AlertTriangle,
  XCircle,
  Loader2,
  Calendar,
  History,
  Edit3,
  Trash2,
  Zap,
} from 'lucide-react';
import type { SceneResponse } from '../../types/scene';
import { SceneIcon } from './SceneIcon';
import { detectSceneTheme, getDeviceTypeIcon } from './sceneConstants';
import { formatSceneAction } from './sceneActions';

export interface SceneCardProps {
  scene: SceneResponse;
  isOwner?: boolean;
  onExecute: (scene: SceneResponse) => Promise<boolean | void>;
  onToggle: (scene: SceneResponse) => Promise<void>;
  onEdit?: (scene: SceneResponse) => void;
  onDelete?: (scene: SceneResponse) => void;
  onOpenHistory?: (scene: SceneResponse) => void;
  onOpenSchedule?: (scene: SceneResponse) => void;
  isExecuting?: boolean;
  isToggling?: boolean;
  viewMode?: 'card' | 'compact';
}

export const SceneCard: React.FC<SceneCardProps> = ({
  scene,
  isOwner = true,
  onExecute,
  onToggle,
  onEdit,
  onDelete,
  onOpenHistory,
  onOpenSchedule,
  isExecuting = false,
  isToggling = false,
  viewMode = 'card',
}) => {
  const [localFeedback, setLocalFeedback] = useState<'idle' | 'success' | 'partial' | 'failed'>('idle');
  const theme = detectSceneTheme(scene.name, scene.icon);

  const handleExecute = async () => {
    if (!scene.enabled || isExecuting) return;
    try {
      const res = await onExecute(scene);
      setLocalFeedback(res === false ? 'failed' : 'success');
      setTimeout(() => setLocalFeedback('idle'), 2400);
    } catch {
      setLocalFeedback('failed');
      setTimeout(() => setLocalFeedback('idle'), 2400);
    }
  };

  const actionPreviewList = scene.actions.slice(0, 3);
  const remainingCount = scene.actions.length - actionPreviewList.length;

  // COMPACT VIEW (used in horizontal ribbons or dense lists)
  if (viewMode === 'compact') {
    return (
      <article
        className={`group relative flex items-center justify-between gap-3.5 rounded-2xl border p-3.5 transition-all duration-300 bg-surface/90 hover:shadow-md ${
          scene.enabled ? `${theme.borderColor} shadow-xs` : 'border-line opacity-75'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <SceneIcon iconKey={scene.icon} name={scene.name} size="sm" />
          <div className="min-w-0">
            <h3 className="font-bold text-text text-sm truncate group-hover:text-primary transition-colors">
              {scene.name}
            </h3>
            <p className="text-[11px] text-muted truncate">
              {scene.actions.length} lệnh · {scene.enabled ? 'Đang bật' : 'Đang tắt'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={!scene.enabled || isExecuting}
            onClick={handleExecute}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 ${
              localFeedback === 'success'
                ? 'bg-emerald-600 text-white'
                : localFeedback === 'failed'
                ? 'bg-rose-600 text-white'
                : 'bg-primary text-white hover:bg-primary-hover active:scale-95 disabled:opacity-40'
            }`}
          >
            {isExecuting ? (
              <Loader2 size={13} className="animate-spin" />
            ) : localFeedback === 'success' ? (
              <Check size={13} className="stroke-[3]" />
            ) : (
              <Play size={12} className="fill-current" />
            )}
            <span>{isExecuting ? 'Chạy...' : localFeedback === 'success' ? 'Xong' : 'Chạy'}</span>
          </button>

          {onEdit && isOwner && (
            <button
              type="button"
              onClick={() => onEdit(scene)}
              className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-sidebar transition-colors"
              title="Sửa kịch bản"
            >
              <Edit3 size={14} />
            </button>
          )}
        </div>
      </article>
    );
  }

  // STANDARD MODERN CARD VIEW
  return (
    <article
      className={`group relative flex flex-col justify-between rounded-3xl border p-5 sm:p-5.5 transition-all duration-300 backdrop-blur-md bg-surface/95 hover:-translate-y-1 hover:shadow-xl ${
        scene.enabled
          ? `border-line/90 ${theme.borderColor} ${theme.glowColor}`
          : 'border-line/50 bg-surface/60 opacity-80'
      }`}
    >
      {/* Top subtle ambient gradient glow */}
      <div
        className={`absolute inset-x-0 top-0 h-28 rounded-t-3xl bg-gradient-to-b ${theme.bgGradient} pointer-events-none transition-opacity duration-300 ${
          scene.enabled ? 'opacity-80 group-hover:opacity-100' : 'opacity-25'
        }`}
        aria-hidden="true"
      />

      {/* Card Header */}
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3 mb-3.5">
          <div className="flex items-center gap-3.5 min-w-0">
            <SceneIcon iconKey={scene.icon} name={scene.name} size="md" />
            <div className="min-w-0">
              <h3 className="font-bold text-base text-text tracking-tight group-hover:text-primary transition-colors truncate">
                {scene.name}
              </h3>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted bg-sidebar/80 px-2 py-0.5 rounded-full border border-line">
                  <Zap size={11} className={theme.textColor} />
                  {scene.actions.length} lệnh
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    scene.enabled
                      ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-300/50'
                      : 'bg-slate-500/10 text-slate-600 border border-slate-300/40'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      scene.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                    }`}
                  />
                  {scene.enabled ? 'Sẵn sàng' : 'Tạm tắt'}
                </span>
              </div>
            </div>
          </div>

          {/* Modern Tactile Switch */}
          <label
            className="inline-flex cursor-pointer items-center shrink-0 p-1"
            title={scene.enabled ? 'Tắt kịch bản' : 'Bật kịch bản'}
          >
            <span className="sr-only">Bật hoặc tắt kịch bản {scene.name}</span>
            <input
              type="checkbox"
              role="switch"
              aria-label={`Bật hoặc tắt kịch bản ${scene.name}`}
              checked={scene.enabled}
              disabled={isToggling}
              onChange={() => void onToggle(scene)}
              className="peer sr-only"
            />
            <div
              className={`relative h-6 w-11 rounded-full transition-colors duration-200 ease-in-out ${
                scene.enabled ? 'bg-emerald-500 shadow-sm shadow-emerald-500/25' : 'bg-slate-300'
              } after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-focus-visible:ring-2 peer-focus-visible:ring-primary ${
                scene.enabled ? 'after:translate-x-5' : ''
              }`}
            />
          </label>
        </div>

        {/* Description */}
        <p className="text-xs text-muted line-clamp-2 min-h-[34px] leading-relaxed">
          {scene.description || 'Kịch bản thông minh kích hoạt chuỗi thao tác tự động cho ngôi nhà của bạn.'}
        </p>

        {/* Action Pipeline Sequence Chips with Device Icons */}
        <div className="mt-3.5 space-y-1.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted/80 flex items-center justify-between">
            <span>Chuỗi thiết bị ({scene.actions.length}):</span>
          </div>

          {scene.actions.length === 0 ? (
            <p className="text-xs italic text-muted/70 py-1.5 px-2 bg-sidebar/30 rounded-xl border border-dashed border-line">
              Chưa gán hành động nào cho kịch bản này.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {actionPreviewList.map((action, idx) => {
                const DeviceIcon = getDeviceTypeIcon(action.targetDeviceType);
                return (
                  <span
                    key={action.id || idx}
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium text-text bg-sidebar/80 hover:bg-sidebar border border-line px-2.5 py-1 rounded-xl transition-colors shadow-2xs"
                    title={`${action.targetDeviceName}: ${formatSceneAction(action)}`}
                  >
                    <DeviceIcon size={12} className="text-primary shrink-0" />
                    <span className="font-semibold text-text max-w-[85px] truncate">
                      {action.targetDeviceName}
                    </span>
                    <span className="text-muted/90 truncate max-w-[75px] font-normal">
                      {formatSceneAction(action)}
                    </span>
                  </span>
                );
              })}
              {remainingCount > 0 && (
                <span className="inline-flex items-center text-[11px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-1 rounded-xl">
                  +{remainingCount} lệnh nữa
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Card Footer: 1-Tap Trigger & Quick Controls */}
      <div className="relative z-10 mt-5 pt-3.5 border-t border-line/70 flex items-center justify-between gap-2">
        {/* Main 1-tap Execute Button */}
        <button
          type="button"
          disabled={!scene.enabled || isExecuting}
          onClick={handleExecute}
          className={`flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl text-xs font-bold transition-all duration-200 shadow-sm active:scale-97 ${
            localFeedback === 'success'
              ? 'bg-emerald-500 text-white shadow-emerald-500/25 ring-2 ring-emerald-300'
              : localFeedback === 'failed'
              ? 'bg-rose-500 text-white shadow-rose-500/25'
              : localFeedback === 'partial'
              ? 'bg-amber-500 text-white shadow-amber-500/25'
              : 'bg-primary hover:bg-primary-hover text-white shadow-primary/25 disabled:opacity-40 disabled:pointer-events-none'
          }`}
          aria-label={`Kích hoạt kịch bản ${scene.name}`}
        >
          {isExecuting ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>Đang kích hoạt...</span>
            </>
          ) : localFeedback === 'success' ? (
            <>
              <Check size={15} className="stroke-[3]" />
              <span>Đã kích hoạt thành công!</span>
            </>
          ) : localFeedback === 'partial' ? (
            <>
              <AlertTriangle size={14} />
              <span>Thực thi một phần</span>
            </>
          ) : localFeedback === 'failed' ? (
            <>
              <XCircle size={14} />
              <span>Kích hoạt thất bại</span>
            </>
          ) : (
            <>
              <Play size={13} className="fill-current" />
              <span>Kích hoạt ngay</span>
            </>
          )}
        </button>

        {/* Secondary Action Icons */}
        <div className="flex items-center gap-1 shrink-0">
          {onOpenSchedule && (
            <button
              type="button"
              onClick={() => onOpenSchedule(scene)}
              className="p-2 rounded-xl text-muted hover:text-primary hover:bg-sidebar transition-all"
              title="Cài đặt lịch trình tự động"
              aria-label={`Cài đặt lịch chạy cho ${scene.name}`}
            >
              <Calendar size={16} />
            </button>
          )}

          {onOpenHistory && (
            <button
              type="button"
              onClick={() => onOpenHistory(scene)}
              className="p-2 rounded-xl text-muted hover:text-primary hover:bg-sidebar transition-all"
              title="Xem lịch sử kích hoạt"
              aria-label={`Xem lịch sử kịch bản ${scene.name}`}
            >
              <History size={16} />
            </button>
          )}

          {isOwner && onEdit && (
            <button
              type="button"
              onClick={() => onEdit(scene)}
              className="p-2 rounded-xl text-muted hover:text-text hover:bg-sidebar transition-all"
              title="Chỉnh sửa kịch bản"
              aria-label={`Sửa kịch bản ${scene.name}`}
            >
              <Edit3 size={16} />
            </button>
          )}

          {isOwner && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(scene)}
              className="p-2 rounded-xl text-muted hover:text-rose-500 hover:bg-rose-50 transition-all"
              title="Xóa kịch bản"
              aria-label={`Xóa kịch bản ${scene.name}`}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
