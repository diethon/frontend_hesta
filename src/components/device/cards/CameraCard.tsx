import React, { useState } from 'react';
import { motion } from 'motion/react';
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
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <motion.article
      role="button"
      tabIndex={0}
      whileHover={{ translateY: -3 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 450, damping: 25 }}
      onClick={() => onClick?.(device.id)}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.(device.id)}
      className={`relative flex flex-col justify-between rounded-2xl border transition-all duration-200 overflow-hidden select-none cursor-pointer group ${
        isOffline
          ? 'bg-[var(--g1)] border-[var(--border)] opacity-70 grayscale'
          : fallDetected
          ? 'bg-[#090d16] border-2 border-rose-500 shadow-lg shadow-rose-500/25 animate-pulse'
          : 'bg-[#090d16] border-[#1e293b] shadow-sm hover:shadow-md'
      }`}
      aria-label={`${device.name}`}
    >
      {/* ── VIDEO / CAMERA PREVIEW FRAME ── */}
      <div className="relative aspect-video w-full bg-[#090d16] flex flex-col justify-between p-4 overflow-hidden">
        {!isOffline && !imgFailed && (
          <img
            src="/camera_living_room.jpg"
            alt={device.name}
            onError={() => setImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-45 group-hover:opacity-60 transition-opacity pointer-events-none"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#090d16]/95 via-[#090d16]/40 to-[#090d16]/70 pointer-events-none" />

        {/* Top Header Overlay */}
        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider ${
                isOffline
                  ? 'bg-[#1e293b] text-white/75'
                  : fallDetected
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'bg-[#0b111e]/85 backdrop-blur-md text-emerald-300 border border-emerald-500/30'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isOffline
                    ? 'bg-white/50'
                    : fallDetected
                    ? 'bg-white'
                    : 'bg-emerald-400 animate-ping'
                }`}
              />
              {isOffline ? 'OFFLINE' : fallDetected ? 'NGUY HIỂM: TÉ NGÃ' : 'TRỰC TIẾP'}
            </span>

            {motionDetected && !fallDetected && (
              <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
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
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/80 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-md transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Center Live Graphic */}
        <div className="relative z-10 my-auto flex flex-col items-center justify-center py-3">
          {fallDetected ? (
            <AlertTriangle className="w-11 h-11 text-rose-400 animate-pulse mb-1" />
          ) : (
            <Video className="w-9 h-9 text-white/70 mb-1 group-hover:text-white transition-colors" />
          )}
          <span className="text-xs font-semibold text-white/90 text-center">
            {isOffline
              ? 'Không có tín hiệu camera'
              : fallDetected
              ? 'CẢNH BÁO TÉ NGÃ ĐÃ ĐƯỢC KÍCH HOẠT!'
              : 'AI Vision · Giám sát toàn cảnh 100%'}
          </span>
        </div>

        {/* Bottom Bar Overlay */}
        <div className="relative z-10 flex items-center justify-between text-white text-xs pt-1.5 border-t border-white/15 tabular-nums">
          <div className="flex items-center gap-1.5 font-semibold truncate">
            <Cctv className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="truncate">{device.name}</span>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-white/85 shrink-0">
            <Eye className="w-3.5 h-3.5 text-emerald-400" />
            <span>FHD · 30 FPS</span>
          </div>
        </div>
      </div>
    </motion.article>
  );
};
