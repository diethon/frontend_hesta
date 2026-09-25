import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { DeviceCard } from './DeviceCard';
import { DeviceDetailModal } from './DeviceDetailModal';
import { getDevicesByHome, getDevicesByRoom, sendDeviceCommand } from '../../services/deviceApi';
import { getHomeRooms } from '../../services/homeApi';
import type { DeviceResponse } from '../../types/device';
import { getErrorMessage } from '../../utils/errors';
import { AppSidebar, DeviceIcon, HomeIcon } from '../ui/AppSidebar';
import { NotificationBell } from '../notification/NotificationBell';
import { currentHomeChanged, currentHomeCleared } from '../../store/homeSlice';
import { useAppDispatch } from '../../store/hooks';
export const DevicePage: React.FC = () => {
  const { homeId } = useParams<{ homeId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [rooms, setRooms] = useState<{id: string, name: string}[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | 'ALL'>('ALL');
  const [devices, setDevices] = useState<DeviceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<DeviceResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    dispatch(currentHomeChanged(homeId ?? null));
    return () => {
      dispatch(currentHomeCleared());
    };
  }, [dispatch, homeId]);

  const fetchRooms = useCallback(async () => {
    if (!homeId) return;
    try {
      const data = await getHomeRooms(homeId);
      setRooms(data || []);
    } catch (err: unknown) {
      console.error("Lỗi tải phòng:", err);
    }
  }, [homeId]);

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      if (homeId) {
        if (selectedRoomId === 'ALL') {
          const data = await getDevicesByHome(homeId);
          setDevices(data || []);
        } else {
          const data = await getDevicesByRoom(selectedRoomId);
          setDevices(data || []);
        }
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Lỗi tải danh sách thiết bị'));
    } finally {
      setLoading(false);
    }
  }, [homeId, selectedRoomId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchRooms(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchRooms]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchDevices(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchDevices]);

  const handleTogglePower = async (deviceId: string, currentPower: string) => {
    // 1. Optimistic update
    setDevices(prev =>
      prev.map(d => {
        if (d.id === deviceId) {
          return {
            ...d,
            currentState: {
              ...d.currentState,
              power: currentPower === 'ON' ? 'OFF' : 'ON',
            },
          };
        }
        return d;
      })
    );

    // 2. Determine action
    const actionToSend = currentPower === 'ON' ? 'TURN_OFF' : 'TURN_ON';

    try {
      // 3. Send API request
      await sendDeviceCommand(deviceId, actionToSend);
    } catch (err) {
      console.error("Lỗi khi gửi lệnh điều khiển:", err);
      // Revert if error
      setDevices(prev =>
        prev.map(d => {
          if (d.id === deviceId) {
            return {
              ...d,
              currentState: {
                ...d.currentState,
                power: currentPower, // Revert back
              },
            };
          }
          return d;
        })
      );
    }
  };

  const handleDeviceClick = (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (device) {
      setSelectedDevice(device);
      setIsModalOpen(true);
    }
  };

  const handleDeviceRemoved = (deviceId: string) => {
    setDevices(prev => prev.filter(d => d.id !== deviceId));
  };

  return (
    <div className="app-shell">
      <AppSidebar
        activeItem="devices"
        contextLabel="Không gian sống"
        items={[
          { id: 'home', label: 'Tổng quan', icon: <HomeIcon />, onClick: () => navigate('/home') },
          { id: 'devices', label: 'Thiết bị', icon: <DeviceIcon />, onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
        ]}
      />
      <main id="main-content" className="lg:pl-64">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="surface-card flex items-center gap-4 p-5 sm:p-6">
          <button 
            type="button"
            aria-label="Quay lại trang tổng quan"
            onClick={() => navigate('/home')}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-sidebar text-icon transition-colors hover:bg-sidebar-hover hover:text-primary-hover"
          >
            <svg aria-hidden={true} className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-text">Thiết bị trong nhà</h1>
            <p className="text-sm text-muted">Theo dõi kết nối, trạng thái và thông tin từng phòng</p>
          </div>
          <NotificationBell />
        </div>

        {/* Room Selection Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-line bg-white p-2 shadow-soft custom-scrollbar">
          <button
            onClick={() => setSelectedRoomId('ALL')}
            className={"px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors " + 
              (selectedRoomId === 'ALL' 
                ? 'bg-primary text-white shadow-sm'
                : 'bg-transparent text-muted hover:bg-sidebar-hover hover:text-text')}
          >
            Tất cả phòng
          </button>
          {rooms.map(room => (
            <button
              key={room.id}
              onClick={() => setSelectedRoomId(room.id)}
              className={"px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors " + 
                (selectedRoomId === room.id 
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-transparent text-muted hover:bg-sidebar-hover hover:text-text')}
            >
              {room.name}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="surface-card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4" aria-label="Đang tải thiết bị">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-32 animate-pulse rounded-2xl bg-off-soft" />)}
          </div>
        ) : error ? (
          <div role="alert" aria-live="polite" className="rounded-xl border border-rose-900/50 bg-rose-950/30 p-4 text-rose-400">{error}</div>
        ) : devices.length === 0 ? (
          <div className="surface-card border-dashed py-14 text-center text-muted">
            Chưa có thiết bị nào trong khu vực này.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {devices.map(device => (
              <DeviceCard
                key={device.id}
                device={device}
                onTogglePower={handleTogglePower}
                onClick={handleDeviceClick}
              />
            ))}
          </div>
        )}
      </div>
      </main>

      <DeviceDetailModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setTimeout(() => setSelectedDevice(null), 200);
        }}
        device={selectedDevice}
        onDeviceRemoved={handleDeviceRemoved}
      />
    </div>
  );
};
