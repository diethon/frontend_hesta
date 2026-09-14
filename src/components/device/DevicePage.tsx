import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { DeviceCard } from './DeviceCard';
import { DeviceDetailModal } from './DeviceDetailModal';
import { getDevicesByHome, getDevicesByRoom } from '../../services/deviceApi';
import { getHomeRooms } from '../../services/homeApi';
import type { DeviceResponse } from '../../types/device';
export const DevicePage: React.FC = () => {
  const { homeId } = useParams<{ homeId: string }>();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<{id: string, name: string}[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | 'ALL'>('ALL');
  const [devices, setDevices] = useState<DeviceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<DeviceResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchRooms = async () => {
    if (!homeId) return;
    try {
      const data = await getHomeRooms(homeId);
      setRooms(data || []);
    } catch (err: any) {
      console.error("Lỗi tải phòng:", err);
    }
  };

  const fetchDevices = async () => {
    try {
      setLoading(true);
      if (homeId) {
        if (selectedRoomId === 'ALL') {
          const data = await getDevicesByHome(homeId);
          setDevices(data || []);
        } else {
          const data = await getDevicesByRoom(selectedRoomId);
          setDevices(data || []);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi tải danh sách thiết bị');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [homeId]);

  useEffect(() => {
    fetchDevices();
  }, [homeId, selectedRoomId]);

  const handleTogglePower = (deviceId: string, currentPower: string) => {
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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
          <button 
            onClick={() => navigate('/home')}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Quản lý Thiết bị</h1>
            <p className="text-sm text-slate-400">Danh sách các thiết bị trong nhà</p>
          </div>
        </div>

        {/* Room Selection Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-800 scrollbar-hide items-center">
          <button
            onClick={() => setSelectedRoomId('ALL')}
            className={"px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors " + 
              (selectedRoomId === 'ALL' 
                ? 'bg-blue-600 text-white' 
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800')}
          >
            Tất cả phòng
          </button>
          {rooms.map(room => (
            <button
              key={room.id}
              onClick={() => setSelectedRoomId(room.id)}
              className={"px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors " + 
                (selectedRoomId === room.id 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800')}
            >
              {room.name}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-slate-400 py-10 text-center">Đang tải thiết bị...</div>
        ) : error ? (
          <div className="text-rose-400 bg-rose-950/30 p-4 rounded-xl border border-rose-900/50">{error}</div>
        ) : devices.length === 0 ? (
          <div className="text-slate-400 py-10 text-center bg-slate-900/50 rounded-2xl border border-slate-800 dashed">
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