import React, { useState } from 'react';
import type { DeviceResponse } from '../../../types/device';
import {
  DoorOpen,
  ArrowUp,
  Square,
  ArrowDown,
  Loader2,
  SlidersHorizontal,
} from 'lucide-react';
import { openGate, closeGate, stopGate } from '../../../services/deviceApi';
import { notify } from '../../ui/notify';
import { getErrorMessage } from '../../../utils/errors';

interface GateCardProps {
  device: DeviceResponse;
  onClick?: (deviceId: string) => void;
  onStateChange?: (updatedDevice: DeviceResponse) => void;
}

export const GateCard: React.FC<GateCardProps> = ({
  device,
  onClick,
  onStateChange,
}) => {
  const isOffline = device.status === 'OFFLINE';
  const currentState = device.currentState;
  const state = String(currentState?.state || 'CLOSED').toUpperCase();

  const [pendingAction, setPendingAction] = useState<'OPEN' | 'STOP' | 'CLOSE' | null>(null);

  const handleAction = async (action: 'OPEN' | 'STOP' | 'CLOSE', e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOffline || pendingAction !== null) return;

    setPendingAction(action);
    try {
      if (action === 'OPEN') {
        await openGate(device.id, device.nodeId);
        notify.success('Đang mở cổng / cửa');
        onStateChange?.({
          ...device,
          currentState: { ...device.currentState, state: 'OPEN' },
        });
      } else if (action === 'STOP') {
        await stopGate(device.id, device.nodeId);
        notify.success('Đã dừng chuyển động');
        onStateChange?.({
          ...device,
          currentState: { ...device.currentState, state: 'STOPPED' },
        });
      } else {
        await closeGate(device.id, device.nodeId);
        notify.success('Đang đóng cổng / cửa');
        onStateChange?.({
          ...device,
          currentState: { ...device.currentState, state: 'CLOSED' },
        });
      }
    } catch (err) {
      notify.error(getErrorMessage(err, 'Lỗi điều khiển cổng/cửa cuốn'));
    } finally {
      setPendingAction(null);
    }
  };

  const isOpen = state === 'OPEN';
  const isOpening = state === 'OPENING';
  const isClosing = state === 'CLOSING';
  const isStopped = state === 'STOPPED';

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(device.id)}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.(device.id)}
      className={`relative flex flex-col justify-between p-4 sm:p-5 rounded-2xl border transition-all duration-200 select-none cursor-pointer ${
        isOffline
          ? 'bg-off-soft/60 border-line/50 opacity-70 grayscale'
          : isOpen
          ? 'bg-gradient-to-br from-white via-teal-50/40 to-teal-100/30 border-teal-200 shadow-sm hover:shadow-md'
          : isOpening || isClosing
          ? 'bg-gradient-to-br from-white via-amber-50/40 to-amber-100/30 border-amber-300 shadow-sm hover:shadow-md'
          : 'bg-white border-line hover:bg-off-soft/40 shadow-xs'
      }`}
      aria-label={`${device.name}`}
    >
      {/* ── TOP ROW: Icon + Title + Status Chip + Details Button ── */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all shrink-0 ${
              isOffline
                ? 'bg-off text-icon'
                : isOpen
                ? 'bg-teal-500 text-white shadow-md shadow-teal-500/30'
                : isOpening || isClosing
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30 animate-pulse'
                : 'bg-sidebar border border-line text-icon'
            }`}
          >
            <DoorOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-[15px] leading-tight text-text truncate">
              {device.name}
            </h3>
            <p className="text-xs text-muted truncate mt-0.5">
              {device.deviceType === 'ROLLING_DOOR' ? 'Cửa cuốn thông minh' : 'Cổng tự động'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Status Badge */}
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-bold tracking-wide border ${
              isOpen
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : isOpening || isClosing
                ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                : isStopped
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-off-soft text-muted border-line'
            }`}
          >
            {isOffline && 'OFFLINE'}
            {!isOffline && isOpen && '● ĐANG MỞ'}
            {!isOffline && isOpening && '↗ ĐANG MỞ...'}
            {!isOffline && isClosing && '↘ ĐANG ĐÓNG...'}
            {!isOffline && isStopped && '■ ĐÃ DỪNG'}
            {!isOffline && !isOpen && !isOpening && !isClosing && !isStopped && '○ ĐÃ ĐÓNG'}
          </span>

          <button
            type="button"
            title="Chi tiết & Lịch sử"
            onClick={() => onClick?.(device.id)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-icon hover:text-text hover:bg-white/80 transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── MIDDLE: Transit line animation when in motion ── */}
      {(isOpening || isClosing) && (
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden my-2">
          <div className="h-full w-full bg-amber-500 rounded-full animate-pulse" />
        </div>
      )}

      {/* ── BOTTOM: Segmented 3-Button Action Dock ── */}
      <div
        className="grid grid-cols-3 gap-2 bg-slate-100/90 p-1.5 rounded-xl border border-line mt-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          disabled={isOffline || pendingAction !== null || isOpen}
          onClick={(e) => handleAction('OPEN', e)}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
            isOpen
              ? 'bg-emerald-500 text-white shadow-xs'
              : 'bg-white text-emerald-700 hover:bg-emerald-50 active:scale-95 shadow-xs'
          } disabled:opacity-40 disabled:pointer-events-none`}
        >
          {pendingAction === 'OPEN' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ArrowUp className="w-3.5 h-3.5" />
          )}
          <span>Mở</span>
        </button>

        <button
          type="button"
          disabled={isOffline || pendingAction !== null}
          onClick={(e) => handleAction('STOP', e)}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
            isStopped
              ? 'bg-rose-500 text-white shadow-xs'
              : 'bg-white text-rose-600 hover:bg-rose-50 active:scale-95 shadow-xs'
          } disabled:opacity-40 disabled:pointer-events-none`}
        >
          {pendingAction === 'STOP' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Square className="w-3.5 h-3.5 fill-current" />
          )}
          <span>Dừng</span>
        </button>

        <button
          type="button"
          disabled={isOffline || pendingAction !== null || (!isOpen && !isStopped && !isOpening && !isClosing)}
          onClick={(e) => handleAction('CLOSE', e)}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
            !isOpen && !isStopped && !isOpening && !isClosing
              ? 'bg-slate-700 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-200 active:scale-95 shadow-xs'
          } disabled:opacity-40 disabled:pointer-events-none`}
        >
          {pendingAction === 'CLOSE' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5" />
          )}
          <span>Đóng</span>
        </button>
      </div>
    </article>
  );
};
