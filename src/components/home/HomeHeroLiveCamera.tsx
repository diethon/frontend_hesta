import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from './HomeIcons';
import { notify } from '../ui/notify';
import { fallDetectionService } from '../../services/fallDetectionService';

export type CameraState = 'live' | 'loading' | 'offline' | 'empty';

interface HomeHeroLiveCameraProps {
  homeId?: string;
  totalDevices: number;
  onlineDevices: number;
  activeLightsCount: number;
  avgTemperature?: number | null;
  avgHumidity?: number | null;
  activePowerWatts?: number;
  onTurnOffAllLights?: () => void;
  state?: CameraState;
}

export const HomeHeroLiveCamera: React.FC<HomeHeroLiveCameraProps> = ({
  homeId,
  totalDevices = 0,
  onlineDevices = 0,
  activeLightsCount = 0,
  avgTemperature = null,
  avgHumidity = null,
  activePowerWatts = 0,
  onTurnOffAllLights,
  state = 'live',
}) => {
  const navigate = useNavigate();
  const [selectedCamera, setSelectedCamera] = useState('Camera phòng khách');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);
  const [aiInfo, setAiInfo] = useState<{
    isOnline: boolean;
    fps: number;
    alert: boolean;
    state: string;
  }>({
    isOnline: false,
    fps: 0,
    alert: false,
    state: 'STANDING',
  });

  const cameras = ['Camera phòng khách', 'Camera sân trước', 'Camera ban công'];

  // Poll local AI Fall Detection status
  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const data = await fallDetectionService.checkAiStatus();
        if (!isMounted) return;
        if (data) {
          setAiInfo({
            isOnline: true,
            fps: data.fps || 30,
            alert: Boolean(data.alert),
            state: data.state || 'STANDING',
          });
        } else {
          setAiInfo((prev) => ({ ...prev, isOnline: false }));
        }
      } catch {
        if (isMounted) setAiInfo((prev) => ({ ...prev, isOnline: false }));
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleSnapshot = () => {
    setIsSnapping(true);
    setTimeout(() => {
      setIsSnapping(false);
      notify.success('Đã chụp ảnh camera', 'Hình ảnh camera an ninh đã được lưu vào nhật ký.');
    }, 400);
  };

  const handleFullscreen = () => {
    if (homeId) {
      navigate(`/home/${encodeURIComponent(homeId)}/digital-twin`);
    } else {
      notify.info('Mở mô hình 3D toàn màn hình.');
    }
  };

  const handleQuickTurnOff = () => {
    if (onTurnOffAllLights) {
      onTurnOffAllLights();
    } else {
      notify.success('Đã tắt nhanh các đèn đang bật trong phòng.');
    }
  };

  return (
    <section className={`hero camera-card camera-${state}`}>
      <div className="camera-viewport">
        {state === 'live' && (
          <>
            {/* Ambient background blur to soften video edges */}
            <img
              className="camera-ambient-blur"
              src={
                selectedCamera === 'Camera phòng khách'
                  ? 'http://localhost:5000/video_feed'
                  : '/camera_living_room.jpg'
              }
              alt=""
              aria-hidden="true"
            />

            {/* Main video feed with soft rounded corners */}
            <img
              className={`camera-image transition-all duration-300 ${
                isSnapping ? 'brightness-125' : ''
              }`}
              src={
                selectedCamera === 'Camera phòng khách'
                  ? 'http://localhost:5000/video_feed'
                  : '/camera_living_room.jpg'
              }
              alt="Hình ảnh trực tiếp camera an ninh"
              onError={(e) => {
                e.currentTarget.src = '/camera_living_room.jpg';
              }}
            />
          </>
        )}

        {isSnapping && <div className="camera-snap-flash" />}

        {state === 'loading' && (
          <div className="camera-state camera-loading">
            <Icon name="camera" size={34} />
            <span>Đang kết nối camera…</span>
          </div>
        )}

        {state === 'offline' && (
          <div className="camera-state">
            <Icon name="cameraOff" size={38} />
            <strong>Camera ngoại tuyến</strong>
            <button
              type="button"
              className="camera-control-btn w-auto px-4 rounded-full flex items-center gap-2"
              onClick={() => notify.info('Đang kết nối lại camera…')}
            >
              <Icon name="refresh" size={16} />
              <span>Thử lại</span>
            </button>
          </div>
        )}

        {state === 'empty' && (
          <div className="camera-state">
            <Icon name="camera" size={38} />
            <strong>Chưa có camera</strong>
            <button
              type="button"
              className="camera-light-btn active"
              onClick={() => notify.info('Thêm camera an ninh mới')}
            >
              <Icon name="plus" size={16} />
              <span>Thêm camera</span>
            </button>
          </div>
        )}

        {/* ── Top HUD Header Bar ── */}
        {state !== 'empty' && (
          <div className="camera-hud-header">
            <div className="camera-hud-left">
              {/* Live Badge */}
              <div className="camera-live-badge">
                <span className="camera-live-dot" />
                <span>TRỰC TIẾP</span>
              </div>

              {/* Camera Selector Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  className="camera-name-pill"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  title="Chọn camera quan sát"
                >
                  <Icon name="camera" size={14} className="opacity-80" />
                  <span>{selectedCamera}</span>
                  <Icon
                    name="chevronDown"
                    size={13}
                    className={`opacity-70 transition-transform duration-200 ${
                      isDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isDropdownOpen && (
                  <div className="camera-dropdown-menu">
                    {cameras.map((cam) => {
                      const isSelected = selectedCamera === cam;
                      return (
                        <button
                          key={cam}
                          type="button"
                          onClick={() => {
                            setSelectedCamera(cam);
                            setIsDropdownOpen(false);
                            notify.info(`Đã chuyển sang ${cam}`);
                          }}
                          className={`camera-dropdown-item ${isSelected ? 'active' : ''}`}
                        >
                          <span>{cam}</span>
                          {isSelected && (
                            <Icon name="check" size={14} className="shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="camera-hud-right">
              {/* AI Fall Detection Live Badge */}
              <button
                type="button"
                onClick={() =>
                  navigate(
                    homeId
                      ? `/home/${encodeURIComponent(homeId)}/fall-detection`
                      : '/fall-detection'
                  )
                }
                className={`camera-ai-pill ${aiInfo.alert ? 'alert' : ''}`}
                title="Mở Trung Tâm Giám Sát Thị Giác & Cứu Hộ Té Ngã AI"
              >
                <span className={`camera-ai-dot ${aiInfo.alert ? 'alert' : ''}`} />
                <span>
                  {aiInfo.alert
                    ? 'CẢNH BÁO TÉ NGÃ!'
                    : aiInfo.isOnline
                    ? `AI Pose · ${Math.round(aiInfo.fps || 30)} FPS`
                    : 'AI Giám Sát'}
                </span>
              </button>

              {/* Compact Environment Chip */}
              {(avgTemperature != null || avgHumidity != null || activePowerWatts > 0) && (
                <div className="camera-env-pill">
                  {avgTemperature != null && (
                    <span className="flex items-center gap-1">
                      <Icon name="thermometer" size={13} className="text-amber-400" />
                      <span>{avgTemperature.toFixed(1)}°C</span>
                    </span>
                  )}
                  {avgTemperature != null && avgHumidity != null && (
                    <span className="opacity-40">·</span>
                  )}
                  {avgHumidity != null && (
                    <span className="flex items-center gap-1 opacity-90">
                      <Icon name="droplet" size={13} className="text-sky-400" />
                      <span>{avgHumidity.toFixed(0)}%</span>
                    </span>
                  )}
                  {activePowerWatts > 0 && (
                    <>
                      <span className="opacity-40">·</span>
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Icon name="energy" size={13} />
                        <span>{activePowerWatts} W</span>
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Bottom HUD Footer Bar ── */}
        {state !== 'empty' && (
          <div className="camera-bottom">
            <div className="camera-bottom-status">
              <span className="camera-safe-dot" />
              <span>
                Nhà an toàn
                <span className="opacity-40 mx-1.5">·</span>
                {activeLightsCount} đèn bật
                <span className="opacity-40 mx-1.5">·</span>
                {onlineDevices}/{totalDevices} trực tuyến
              </span>
            </div>

            <div className="camera-controls">
              <button
                type="button"
                className="camera-control-btn"
                aria-label="Chụp ảnh camera"
                title="Chụp ảnh camera"
                onClick={handleSnapshot}
              >
                <Icon name="camera" size={17} />
              </button>

              <button
                type="button"
                className="camera-control-btn"
                aria-label="Toàn màn hình Digital Twin"
                title="Toàn màn hình Digital Twin"
                onClick={handleFullscreen}
              >
                <Icon name="maximize" size={17} />
              </button>

              <button
                type="button"
                className={`camera-light-btn ${activeLightsCount > 0 ? 'active' : ''}`}
                onClick={handleQuickTurnOff}
                title={
                  activeLightsCount > 0
                    ? `Tắt nhanh ${activeLightsCount} đèn đang bật`
                    : 'Tắt nhanh đèn'
                }
              >
                <Icon name="power" size={15} />
                <span>
                  {activeLightsCount > 0 ? `Tắt ${activeLightsCount} đèn` : 'Tắt nhanh'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
