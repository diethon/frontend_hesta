import React, { useState } from 'react';
import { Camera, Maximize2, Power, Thermometer, Droplets, Zap, ShieldCheck } from 'lucide-react';
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
}

export const HomeHeroLiveCamera: React.FC<HomeHeroLiveCameraProps> = ({
  homeId,
  totalDevices,
  onlineDevices,
  activeLightsCount,
  avgTemperature = 26.9,
  avgHumidity = 61.8,
  activePowerWatts = 350,
}) => {
  const navigate = useNavigate();
  const [isPowerOn, setIsPowerOn] = useState(true);
  const [isSnapping, setIsSnapping] = useState(false);

  const handleSnapshot = () => {
    setIsSnapping(true);
    setTimeout(() => {
      setIsSnapping(false);
      notify.success('Đã chụp ảnh camera phòng khách', 'Ảnh snapshot đã được lưu vào nhật ký giám sát an ninh.');
    }, 400);
  };

  const handleFullscreen = () => {
    if (homeId) {
      navigate(`/home/${encodeURIComponent(homeId)}/digital-twin`);
    } else {
      notify.info('Mở chế độ toàn màn hình camera.');
    }
  };

  const handleTogglePower = () => {
    setIsPowerOn((prev) => !prev);
    notify.info(isPowerOn ? 'Đã tắt nguồn giám sát phòng khách' : 'Đã bật nguồn giám sát phòng khách');
  };

  return (
    <div className="space-y-4">
      {/* ── Main Camera Hero Card ── */}
      <div className="relative aspect-[16/9] sm:aspect-[21/9] md:aspect-[16/8] w-full overflow-hidden rounded-3xl border border-line/80 shadow-soft group select-none">
        {/* Background Image */}
        <img
          src="/camera_living_room.jpg"
          alt="Camera phòng khách"
          className={`h-full w-full object-cover transition-all duration-700 ${
            isPowerOn ? 'filter brightness-95 contrast-105' : 'filter brightness-30 grayscale'
          } ${isSnapping ? 'brightness-150' : ''}`}
        />

        {/* Ambient Dark Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/40 pointer-events-none" />

        {/* Top Badges */}
        <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex flex-wrap items-center gap-2.5 z-10">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 dark:bg-slate-900/80 backdrop-blur-md shadow-xs border border-white/40">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <span className="text-xs font-bold tracking-wide text-slate-800 dark:text-slate-100">Live</span>
          </div>

          <div className="px-4 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white text-xs font-semibold shadow-xs">
            Camera phòng khách
          </div>
        </div>

        {/* Bottom Overlay Info & Controls */}
        <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 flex flex-wrap items-center justify-between gap-3 z-10">
          {/* Status summary */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-black/40 backdrop-blur-md border border-white/15 text-white text-xs sm:text-sm font-medium shadow-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            <span>
              Nhà an toàn · {activeLightsCount} đèn đang bật · {onlineDevices}/{totalDevices || 8} thiết bị trực tuyến
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSnapshot}
              aria-label="Chụp ảnh nhanh"
              title="Chụp ảnh nhanh từ camera"
              className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl bg-white/20 hover:bg-white/30 text-white backdrop-blur-md border border-white/25 transition-all shadow-sm hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <button
              type="button"
              onClick={handleFullscreen}
              aria-label="Toàn màn hình Digital Twin"
              title="Xem Digital Twin không gian 3D"
              className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl bg-white/20 hover:bg-white/30 text-white backdrop-blur-md border border-white/25 transition-all shadow-sm hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <button
              type="button"
              onClick={handleTogglePower}
              aria-label="Bật/Tắt nguồn phòng"
              title="Bật/Tắt nguồn camera"
              className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl backdrop-blur-md border transition-all shadow-sm hover:scale-105 active:scale-95 cursor-pointer ${
                isPowerOn
                  ? 'bg-primary text-white border-primary/40 shadow-soft'
                  : 'bg-white/15 text-white/70 border-white/20'
              }`}
            >
              <Power className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── 4 Environmental Metric Badges Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-surface/90 border border-line shadow-xs backdrop-blur-md transition-all hover:border-primary/40 hover:shadow-soft">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
            <Thermometer className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">Nhiệt độ</p>
            <p className="text-base font-bold text-text">{avgTemperature.toFixed(1)}°C</p>
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-surface/90 border border-line shadow-xs backdrop-blur-md transition-all hover:border-primary/40 hover:shadow-soft">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-500">
            <Droplets className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">Độ ẩm</p>
            <p className="text-base font-bold text-text">{avgHumidity.toFixed(1)}%</p>
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-surface/90 border border-line shadow-xs backdrop-blur-md transition-all hover:border-primary/40 hover:shadow-soft">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">Công suất</p>
            <p className="text-base font-bold text-text">{activePowerWatts} W</p>
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-surface/90 border border-line shadow-xs backdrop-blur-md transition-all hover:border-emerald-500/40 hover:shadow-soft">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">An ninh</p>
            <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">An toàn</p>
          </div>
        </div>
      </div>
    </div>
  );
};
