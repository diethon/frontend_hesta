import React, { useState } from 'react';
import {
  Camera,
  Maximize2,
  Power,
  ChevronDown,
  Thermometer,
  Droplets,
  Zap,
  ShieldCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { notify } from '../ui/notify';

interface HomeHeroLiveCameraProps {
  homeId?: string;
  totalDevices: number;
  onlineDevices: number;
  activeLightsCount: number;
  avgTemperature?: number;
  avgHumidity?: number;
  activePowerWatts?: number;
  onTurnOffAllLights?: () => void;
}

export const HomeHeroLiveCamera: React.FC<HomeHeroLiveCameraProps> = ({
  homeId,
  totalDevices,
  onlineDevices,
  activeLightsCount,
  avgTemperature = 26.9,
  avgHumidity = 61.8,
  activePowerWatts = 350,
  onTurnOffAllLights,
}) => {
  const navigate = useNavigate();
  const [isSnapping, setIsSnapping] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState('Camera phòng khách');
  const [isCameraDropdownOpen, setIsCameraDropdownOpen] = useState(false);

  const cameras = ['Camera phòng khách', 'Camera sân trước', 'Camera ban công'];

  const handleSnapshot = () => {
    setIsSnapping(true);
    setTimeout(() => {
      setIsSnapping(false);
      notify.success('Đã lưu ảnh snapshot', 'Ảnh chụp từ camera đã được lưu vào nhật ký an ninh.');
    }, 400);
  };

  const handleFullscreen = () => {
    if (homeId) {
      navigate(`/home/${encodeURIComponent(homeId)}/digital-twin`);
    } else {
      notify.info('Mở Digital Twin toàn màn hình.');
    }
  };

  const handleQuickTurnOffLights = () => {
    if (onTurnOffAllLights) {
      onTurnOffAllLights();
    } else {
      notify.success('Đã tắt nhanh toàn bộ đèn trong phòng');
    }
  };

  return (
    <div className="relative aspect-[16/10] sm:aspect-[16/9] w-full overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.06)] group select-none bg-slate-900">
      {/* Background Image */}
      <img
        src="/camera_living_room.jpg"
        alt="Camera phòng khách"
        className={`h-full w-full object-cover transition-all duration-700 ${
          isSnapping ? 'brightness-150' : 'brightness-95 contrast-105'
        }`}
      />

      {/* Subtle Dark Overlays for Text Readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/50 pointer-events-none" />

      {/* ── Top Bar inside Camera Card ── */}
      <div className="absolute top-4 left-4 right-4 sm:top-5 sm:left-5 sm:right-5 flex flex-wrap items-center justify-between gap-2.5 z-10">
        {/* Top-Left Badges: Live & Camera Selector */}
        <div className="flex items-center gap-2">
          {/* Live badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 dark:bg-slate-900/90 backdrop-blur-md shadow-sm border border-white/40">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Live</span>
          </div>

          {/* Camera Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsCameraDropdownOpen(!isCameraDropdownOpen)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white text-xs font-semibold backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-xs"
            >
              <span>{selectedCamera}</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-80" />
            </button>

            {isCameraDropdownOpen && (
              <div className="absolute left-0 mt-2 w-44 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1 z-20">
                {cameras.map((cam) => (
                  <button
                    key={cam}
                    type="button"
                    onClick={() => {
                      setSelectedCamera(cam);
                      setIsCameraDropdownOpen(false);
                      notify.info(`Đã chuyển sang ${cam}`);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs font-medium transition-colors ${
                      selectedCamera === cam
                        ? 'text-primary font-bold bg-primary/10'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {cam}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top-Right Overlaid Environmental Metrics (Figma Exact Placement) */}
        <div className="hidden sm:flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white/85 dark:bg-slate-900/80 backdrop-blur-md border border-white/30 text-slate-800 dark:text-slate-100 text-xs font-bold shadow-xs">
            <Thermometer className="w-3.5 h-3.5 text-amber-500" />
            <span>{avgTemperature.toFixed(1)}°C</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white/85 dark:bg-slate-900/80 backdrop-blur-md border border-white/30 text-slate-800 dark:text-slate-100 text-xs font-bold shadow-xs">
            <Droplets className="w-3.5 h-3.5 text-cyan-500" />
            <span>{avgHumidity.toFixed(1)}%</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white/85 dark:bg-slate-900/80 backdrop-blur-md border border-white/30 text-slate-800 dark:text-slate-100 text-xs font-bold shadow-xs">
            <Zap className="w-3.5 h-3.5 text-indigo-500" />
            <span>{activePowerWatts} W</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white/85 dark:bg-slate-900/80 backdrop-blur-md border border-white/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>An toàn</span>
          </div>
        </div>
      </div>

      {/* ── Bottom Overlay Info & Controls ── */}
      <div className="absolute bottom-4 left-4 right-4 sm:bottom-5 sm:left-5 sm:right-5 flex flex-wrap items-center justify-between gap-3 z-10">
        {/* Status text */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/15 text-white text-xs sm:text-sm font-medium shadow-xs">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
          <span>
            Nhà an toàn · {activeLightsCount} đèn đang bật · {onlineDevices}/{totalDevices || 8} thiết bị trực tuyến
          </span>
        </div>

        {/* Action buttons matching Figma */}
        <div className="flex items-center gap-2">
          {/* Snapshot */}
          <button
            type="button"
            onClick={handleSnapshot}
            aria-label="Chụp ảnh nhanh"
            title="Chụp ảnh snapshot"
            className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-black/40 hover:bg-black/60 text-white backdrop-blur-md border border-white/20 transition-all shadow-xs hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Camera className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>

          {/* Fullscreen / 3D Twin */}
          <button
            type="button"
            onClick={handleFullscreen}
            aria-label="Xem 3D Digital Twin"
            title="Toàn màn hình Digital Twin"
            className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-black/40 hover:bg-black/60 text-white backdrop-blur-md border border-white/20 transition-all shadow-xs hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Maximize2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>

          {/* Tắt nhanh đèn (Exact Figma pill button) */}
          <button
            type="button"
            onClick={handleQuickTurnOffLights}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/90 hover:bg-white text-slate-900 text-xs font-bold backdrop-blur-md border border-white/50 transition-all shadow-xs hover:scale-105 active:scale-95 cursor-pointer"
            title="Tắt nhanh toàn bộ đèn"
          >
            <Power className="w-3.5 h-3.5 text-slate-800" />
            <span className="hidden xs:inline">Tắt nhanh đèn</span>
          </button>
        </div>
      </div>
    </div>
  );
};
