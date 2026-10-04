import React from 'react';
import type { DeviceResponse } from '../../../types/device';
import { Cctv, Video, AlertTriangle, SlidersHorizontal, Eye } from 'lucide-react';

interface CameraCardProps {
  device: DeviceResponse;
  onClick?: (deviceId: string) => void;
}

export const CameraCard: React.FC<CameraCardProps> = ({ device, onClick }) => {
  const isOffline = device.status === 'OFFLINE';
  const state = device.currentState;
  const fallDetected = state?.fallDetected === true;
  const motionDetected = state?.motion === true;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(device.id)}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.(device.id)}
      className={`relative flex flex-col justify-between rounded-2xl border transition-all duration-200 overflow-hidden select-none cursor-pointer group ${
        isOffline
          ? 'bg-slate-900/60 border-line opacity-70 grayscale'
          : fallDetected
          ? 'bg-slate-950 border-2 border-rose-500 shadow-lg shadow-rose-500/25 animate-pulse'
          : 'bg-slate-900 border-slate-800 shadow-sm hover:shadow-md'
      }`}
      aria-label={`${device.name}`}
    >
      {/* ── VIDEO / CAMERA PREVIEW FRAME ── */}
      <div className="relative aspect-video w-full bg-slate-950 flex flex-col justify-between p-4 overflow-hidden">
        {/* Subtle camera lens aesthetic background */}
        <div className="absolute inset-0 bg-radial from-slate-800/40 via-transparent to-black pointer-events-none" />

        {/* Top Header Overlay */}
        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider ${
                isOffline
                  ? 'bg-slate-800 text-slate-400'
                  : fallDetected
                  ? 'bg-rose-500 text-white animate-bounce'
                  : 'bg-black/60 backdrop-blur-md text-emerald-400 border border-emerald-500/30'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isOffline
                    ? 'bg-slate-500'
                    : fallDetected
                    ? 'bg-white'
                    : 'bg-emerald-400 animate-ping'
                }`}
              />
              {isOffline ? 'OFFLINE' : fallDetected ? 'NGUY HIỂM: TÉ NGÃ' : 'TRỰC TIẾP'}
            </span>

            {motionDetected && !fallDetected && (
              <span className="bg-amber-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                CHUYỂN ĐỘNG
              </span>
            )}
          </div>

          <button
            type="button"
            title="Chi tiết & Lịch sử"
            onClick={(e) => {
              e.stopPropagation();
              onClick?.(device.id);
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-md transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Center Live Graphic */}
        <div className="relative z-10 my-auto flex flex-col items-center justify-center text-slate-500 py-3">
          {fallDetected ? (
            <AlertTriangle className="w-12 h-12 text-rose-500 animate-pulse mb-1" />
          ) : (
            <Video className="w-10 h-10 text-slate-600 mb-1 group-hover:text-slate-400 transition-colors" />
          )}
          <span className="text-xs font-medium text-slate-400">
            {isOffline
              ? 'Không có tín hiệu camera'
              : fallDetected
              ? 'CẢNH BÁO TÉ NGÃ ĐÃ ĐƯỢC KÍCH HOẠT!'
              : 'AI Vision · Nhận diện người & chuyển động'}
          </span>
        </div>

        {/* Bottom Bar Overlay */}
        <div className="relative z-10 flex items-center justify-between text-white text-xs pt-1 border-t border-white/10">
          <div className="flex items-center gap-1.5 font-semibold truncate">
            <Cctv className="w-3.5 h-3.5 text-primary" />
            <span className="truncate">{device.name}</span>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-slate-400 shrink-0">
            <Eye className="w-3.5 h-3.5 text-emerald-400" />
            <span>FHD · 30 FPS</span>
          </div>
        </div>
      </div>
    </article>
  );
};
