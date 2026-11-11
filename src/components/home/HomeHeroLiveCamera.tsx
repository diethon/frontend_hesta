import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from './HomeIcons';
import { notify } from '../ui/notify';

export type CameraState = 'live' | 'loading' | 'offline' | 'empty';

interface HomeHeroLiveCameraProps {
  homeId?: string;
  totalDevices: number;
  onlineDevices: number;
  activeLightsCount: number;
  avgTemperature?: number;
  avgHumidity?: number;
  activePowerWatts?: number;
  onTurnOffAllLights?: () => void;
  state?: CameraState;
}

export const HomeHeroLiveCamera: React.FC<HomeHeroLiveCameraProps> = ({
  homeId,
  totalDevices = 8,
  onlineDevices = 8,
  activeLightsCount = 2,
  avgTemperature = 26.9,
  avgHumidity = 61.8,
  activePowerWatts = 350,
  onTurnOffAllLights,
  state = 'live',
}) => {
  const navigate = useNavigate();
  const [selectedCamera, setSelectedCamera] = useState('Camera phòng khách');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);

  const cameras = ['Camera phòng khách', 'Camera sân trước', 'Camera ban công'];

  const handleSnapshot = () => {
    setIsSnapping(true);
    setTimeout(() => {
      setIsSnapping(false);
      notify.success('Đã chụp ảnh camera', 'Hình ảnh camera an ninh đã được lưu vào nhật ký.');
    }, 450);
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

  const SensorChips = () => (
    <div className="camera-sensors">
      <span className="camera-chip">
        <Icon name="thermometer" size={16} />
        {avgTemperature.toFixed(1)}°C
      </span>
      <span className="camera-chip">
        <Icon name="droplet" size={16} />
        {avgHumidity.toFixed(1)}%
      </span>
      <span className="camera-chip">
        <Icon name="energy" size={16} />
        {activePowerWatts} W
      </span>
      <span className="camera-chip success">
        <Icon name="shield" size={16} />
        An toàn
      </span>
    </div>
  );

  return (
    <section className={`hero camera-card glass-g2 camera-${state}`}>
      <div className="camera-viewport">
        {state === 'live' && (
          <img
            className={`camera-image transition-all duration-300 ${
              isSnapping ? 'brightness-150 scale-[1.01]' : ''
            }`}
            src="https://images.unsplash.com/photo-1632829882891-5047ccc421bc?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1600"
            alt="Hình ảnh trực tiếp phòng khách sáng và yên tĩnh"
            onError={(e) => {
              // Fallback to local image if internet is slow
              e.currentTarget.src = '/camera_living_room.jpg';
            }}
          />
        )}

        {state === 'loading' && (
          <div className="camera-state camera-loading">
            <Icon name="camera" size={34} />
            <span>Đang kết nối camera</span>
          </div>
        )}

        {state === 'offline' && (
          <div className="camera-state">
            <Icon name="cameraOff" size={38} />
            <strong>Camera ngoại tuyến</strong>
            <button
              type="button"
              className="secondary-button"
              onClick={() => notify.info('Đang kết nối lại camera…')}
            >
              <Icon name="refresh" size={17} />
              Thử lại
            </button>
          </div>
        )}

        {state === 'empty' && (
          <div className="camera-state">
            <Icon name="camera" size={38} />
            <strong>Chưa có camera</strong>
            <button
              type="button"
              className="camera-primary"
              onClick={() => notify.info('Thêm camera an ninh mới')}
            >
              <Icon name="plus" size={17} />
              Thêm camera
            </button>
          </div>
        )}

        {state !== 'empty' && (
          <div className="camera-top-left">
            <span className="live-badge">
              <span className="live-dot" />
              Trực tiếp
            </span>

            <div className="relative">
              <button
                type="button"
                className="camera-name"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <span>{selectedCamera}</span>
                <Icon name="chevronDown" size={15} />
              </button>

              {isDropdownOpen && (
                <div className="absolute left-0 mt-2 w-48 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xl py-1 z-30">
                  {cameras.map((cam) => (
                    <button
                      key={cam}
                      type="button"
                      onClick={() => {
                        setSelectedCamera(cam);
                        setIsDropdownOpen(false);
                        notify.info(`Đã chuyển sang ${cam}`);
                      }}
                      className={`w-full text-left px-3.5 py-2 text-xs font-semibold transition-colors ${
                        selectedCamera === cam
                          ? 'text-primary bg-primary/10'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {cam}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Overlaid inside viewport on desktop */}
        <SensorChips />

        {state !== 'empty' && (
          <div className="camera-bottom">
            <p>
              <span className="safe-dot" /> Nhà an toàn · {activeLightsCount} đèn đang bật ·{' '}
              {onlineDevices}/{totalDevices} thiết bị trực tuyến
            </p>

            <div className="camera-controls">
              <button
                type="button"
                className="camera-control"
                aria-label="Chụp ảnh camera"
                title="Chụp ảnh camera"
                onClick={handleSnapshot}
              >
                <Icon name="camera" size={18} />
              </button>

              <button
                type="button"
                className="camera-control"
                aria-label="Toàn màn hình Digital Twin"
                title="Toàn màn hình Digital Twin"
                onClick={handleFullscreen}
              >
                <Icon name="maximize" size={18} />
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={handleQuickTurnOff}
                title="Tắt nhanh các đèn đang bật"
              >
                <Icon name="power" size={18} />
                <span>Tắt nhanh đèn</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Rendered below viewport on mobile viewports via responsive CSS */}
      <SensorChips />
    </section>
  );
};
