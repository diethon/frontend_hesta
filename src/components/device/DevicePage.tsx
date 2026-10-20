import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Plus } from 'lucide-react';
import { DeviceCard } from './DeviceCard';
import { DeviceDrawer } from './DeviceDrawer';
import { AddDeviceModal } from './AddDeviceModal';
import { StatusChips } from './StatusChips';
import { DeviceFilters } from './DeviceFilters';
import { SceneBar } from './SceneBar';
import { DeviceGroupSection } from './DeviceGroupSection';
import {
  getDevicesByHome,
  sendDeviceCommand,
  sendManualPowerCommand,
} from '../../services/deviceApi';
import { getHomeRooms } from '../../services/homeApi';
import type { DeviceResponse } from '../../types/device';
import { getErrorMessage, isDuplicateCommandError } from '../../utils/errors';
import { HomeSidebar } from '../ui/HomeSidebar';
import { NotificationBell } from '../notification/NotificationBell';
import { VoiceAssistantButton } from '../ui/VoiceAssistant';
import { currentHomeChanged, currentHomeCleared } from '../../store/homeSlice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { notify } from '../ui/notify';
import { isAcDevice, isWideCard } from './deviceHelpers';
import { realtimeEventDispatcher } from '../../realtime/realtimeEvents';
import type { RealtimeEvent } from '../../realtime/realtimeTypes';

// ──────────────────────────────────────────────────────────────────────
// Category filter helpers
// ──────────────────────────────────────────────────────────────────────

const CATEGORY_TYPES: Record<string, string[]> = {
  LIGHTS: ['LIGHT', 'LED_RGB', 'SMART_PLUG', 'LUX_SENSOR', 'LIGHT_SENSOR'],
  CLIMATE: ['TEMP_HUMID_SENSOR', 'AIR_CONDITIONER'],
  SECURITY: ['MOTION_SENSOR', 'SMOKE_SENSOR', 'CAMERA_AI', 'GATE', 'ROLLING_DOOR'],
};



const filterByCategory = (devices: DeviceResponse[], category: string): DeviceResponse[] => {
  if (category === 'ALL') return devices;
  if (category === 'OFFLINE') return devices.filter((d) => d.status === 'OFFLINE');
  if (category === 'LIGHTS') {
    return devices.filter((d) => CATEGORY_TYPES.LIGHTS.includes(d.deviceType));
  }
  if (category === 'CLIMATE') {
    return devices.filter((d) => d.deviceType === 'TEMP_HUMID_SENSOR' || isAcDevice(d));
  }
  if (category === 'SECURITY') {
    return devices.filter((d) => CATEGORY_TYPES.SECURITY.includes(d.deviceType));
  }
  return devices;
};

// ──────────────────────────────────────────────────────────────────────
// DevicePage
// ──────────────────────────────────────────────────────────────────────

export const DevicePage: React.FC = () => {
  const { homeId } = useParams<{ homeId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // ── Core state ──
  const [rooms, setRooms] = useState<{ id: string; name: string }[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('ALL');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [devices, setDevices] = useState<DeviceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [powerPendingId, setPowerPendingId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // ── Drawer state ──
  const [selectedDevice, setSelectedDevice] = useState<DeviceResponse | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // ── Drag-and-drop ordering ──
  const [deviceOrder, setDeviceOrder] = useState<string[]>([]);
  const [reorderingDeviceId, setReorderingDeviceId] = useState<string | null>(null);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // Load device order from local storage when homeId changes
  useEffect(() => {
    if (homeId) {
      const saved = localStorage.getItem(`deviceOrder_${homeId}`);
      if (saved) {
        try {
          setDeviceOrder(JSON.parse(saved));
        } catch {
          setDeviceOrder([]);
        }
      }
    }
  }, [homeId]);

  // ── Realtime subscription ──
  const realtimeEvents = useAppSelector((state) => state.realtime?.lastEvent);

  // ── Redux: set current home ──
  useEffect(() => {
    dispatch(currentHomeChanged(homeId ?? null));
    return () => {
      dispatch(currentHomeCleared());
    };
  }, [dispatch, homeId]);

  // ── Handle realtime device state changes ──
  const handleDeviceStateChanged = useCallback((event: RealtimeEvent<any>) => {
    if (!event || event.type !== 'DEVICE_STATE_CHANGED' || !event.data) return;
    const data = event.data as { id?: string; deviceId?: string; currentState?: Record<string, unknown>; status?: string };
    const targetId = data.id || data.deviceId || event.deviceId;
    if (!targetId) return;

    setDevices((prev) =>
      prev.map((d) => {
        if (d.id === targetId) {
          return {
            ...d,
            currentState: data.currentState ? { ...d.currentState, ...data.currentState } : d.currentState,
            status: (data.status as DeviceResponse['status']) ?? d.status,
          };
        }
        return d;
      }),
    );

    // Also update the open drawer
    setSelectedDevice((prev) => {
      if (prev && prev.id === targetId) {
        return {
          ...prev,
          currentState: data.currentState ? { ...prev.currentState, ...data.currentState } : prev.currentState,
          status: (data.status as DeviceResponse['status']) ?? prev.status,
        };
      }
      return prev;
    });
  }, []);

  // Direct fast-path subscription via realtimeEventDispatcher (<1ms latency)
  useEffect(() => {
    return realtimeEventDispatcher.register('DEVICE_STATE_CHANGED', handleDeviceStateChanged);
  }, [handleDeviceStateChanged]);

  // Redux fallback subscription
  useEffect(() => {
    if (realtimeEvents) {
      handleDeviceStateChanged(realtimeEvents);
    }
  }, [realtimeEvents, handleDeviceStateChanged]);

  // ── Fetch rooms ──
  const fetchRooms = useCallback(async () => {
    if (!homeId) return;
    try {
      const data = await getHomeRooms(homeId);
      setRooms(data || []);
    } catch (err: unknown) {
      console.error('Lỗi tải phòng:', err);
    }
  }, [homeId]);

  // ── Fetch devices ──
  const fetchDevices = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setError('');
      if (homeId) {
        const data = await getDevicesByHome(homeId);
        setDevices(data || []);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Lỗi tải danh sách thiết bị'));
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [homeId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchRooms(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchRooms]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchDevices(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchDevices]);

  // ── Toggle power (with 30-min automation override) ──
  const handleTogglePower = async (deviceId: string, currentPower: string) => {
    setPowerPendingId(deviceId);
    const action = currentPower === 'ON' ? 'TURN_OFF' : 'TURN_ON';
    const nextPower = action === 'TURN_ON' ? 'ON' : 'OFF';

    // Optimistic update both devices list and selectedDevice
    setDevices((prev) =>
      prev.map((d) =>
        d.id === deviceId
          ? { ...d, currentState: { ...d.currentState, power: nextPower } }
          : d,
      ),
    );
    setSelectedDevice((prev) =>
      prev && prev.id === deviceId
        ? { ...prev, currentState: { ...prev.currentState, power: nextPower } }
        : prev,
    );

    // 2. Optimistic Toast in 0ms: Thông báo hiển thị tức thì đồng bộ với nút bấm!
    notify.success(
      action === 'TURN_ON' ? 'Đã bật thiết bị' : 'Đã tắt thiết bị',
      'Tự động hóa tạm dừng 30 phút',
    );

    try {
      const result = await sendManualPowerCommand(deviceId, action);
      if (!result.command.success) {
        // Rollback
        setDevices((prev) =>
          prev.map((d) =>
            d.id === deviceId
              ? { ...d, currentState: { ...d.currentState, power: currentPower } }
              : d,
          ),
        );
        setSelectedDevice((prev) =>
          prev && prev.id === deviceId
            ? { ...prev, currentState: { ...prev.currentState, power: currentPower } }
            : prev,
        );
        if (result.command.errorCode === 'COMMAND_IN_PROGRESS_DUPLICATE_REJECTED' || isDuplicateCommandError(result.command)) {
          notify.warning('Thiết bị đang thực thi lệnh trước, vui lòng không click liên tục.');
        } else {
          notify.error(result.command.message || 'Thiết bị không nhận lệnh.');
        }
      } else {
        // Refresh silently in background so UI never reloads or flashes skeleton
        void fetchDevices(true);
      }
    } catch (caught) {
      if (isDuplicateCommandError(caught)) {
        notify.warning('Thiết bị đang thực thi lệnh trước, vui lòng không click liên tục.');
      } else {
        notify.error(getErrorMessage(caught, 'Không thể điều khiển thiết bị.'));
      }
      void fetchDevices(true); // Rollback silently via refetch
    } finally {
      setPowerPendingId(null);
    }
  };

  // ── Color change (LED_RGB) ──
  const handleColorChange = async (deviceId: string, r: number, g: number, b: number) => {
    const updatedStatePatch = {
      power: 'ON',
      r,
      g,
      b,
      color: { r, g, b },
    };

    // Optimistic update immediately to both devices array and selectedDevice drawer
    setDevices((prev) =>
      prev.map((d) =>
        d.id === deviceId
          ? { ...d, currentState: { ...d.currentState, ...updatedStatePatch } }
          : d,
      ),
    );
    setSelectedDevice((prev) =>
      prev && prev.id === deviceId
        ? { ...prev, currentState: { ...prev.currentState, ...updatedStatePatch } }
        : prev,
    );

    const targetDev = devices.find((d) => d.id === deviceId) || selectedDevice;
    const currentBrightness = typeof targetDev?.currentState?.brightness === 'number'
      ? targetDev.currentState.brightness
      : 100;

    try {
      const res = await sendDeviceCommand(deviceId, 'SET_RGB', { r, g, b, brightness: currentBrightness });
      if (res && !res.success) {
        if (res.errorCode === 'COMMAND_IN_PROGRESS_DUPLICATE_REJECTED' || isDuplicateCommandError(res)) {
          return;
        }
        if (res.errorCode === 'TIMEOUT_NO_ACK' || res.status === 'SUPERSEDED') {
          return;
        }
        notify.error(res.message || 'Lỗi khi đổi màu');
      }
    } catch (err) {
      if (isDuplicateCommandError(err)) {
        return;
      }
      notify.error(getErrorMessage(err, 'Lỗi khi đổi màu'));
    }
  };

  // ── Brightness change (LED_RGB) ──
  const handleBrightnessChange = async (deviceId: string, brightness: number) => {
    const updatedStatePatch = { brightness };

    // Optimistic update immediately to both devices array and selectedDevice drawer
    setDevices((prev) =>
      prev.map((d) =>
        d.id === deviceId
          ? { ...d, currentState: { ...d.currentState, ...updatedStatePatch } }
          : d,
      ),
    );
    setSelectedDevice((prev) =>
      prev && prev.id === deviceId
        ? { ...prev, currentState: { ...prev.currentState, ...updatedStatePatch } }
        : prev,
    );

    try {
      const res = await sendDeviceCommand(deviceId, 'SET_BRIGHTNESS', { brightness });
      if (res && !res.success) {
        if (res.errorCode === 'COMMAND_IN_PROGRESS_DUPLICATE_REJECTED' || isDuplicateCommandError(res)) {
          return;
        }
        if (res.errorCode === 'TIMEOUT_NO_ACK' || res.status === 'SUPERSEDED') {
          return;
        }
        notify.error(res.message || 'Lỗi khi chỉnh độ sáng');
      }
    } catch (err) {
      if (isDuplicateCommandError(err)) {
        return;
      }
      notify.error(getErrorMessage(err, 'Lỗi khi chỉnh độ sáng'));
    }
  };

  // ── Device click → open drawer ──
  const handleDeviceClick = (deviceId: string) => {
    const device = devices.find((d) => d.id === deviceId);
    if (device) {
      setSelectedDevice(device);
      setIsDrawerOpen(true);
    }
  };

  // ── Device removed ──
  const handleDeviceRemoved = (deviceId: string) => {
    setDevices((prev) => prev.filter((d) => d.id !== deviceId));
  };

  // ── Device updated ──
  const handleDeviceUpdated = (updatedDevice: DeviceResponse) => {
    setDevices((prev) => prev.map((d) => (d.id === updatedDevice.id ? updatedDevice : d)));
    setSelectedDevice(updatedDevice);
  };

  // ── Scene activation (placeholder logic) ──
  const handleSceneActivate = (sceneId: string) => {
    notify.success('Đang kích hoạt', `Scene: ${sceneId}`);
    // TODO: integrate with Scene API when available
  };

  // ── Statistics & Counts ──
  const roomCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    devices.forEach((d) => {
      if (d.roomId) {
        counts[d.roomId] = (counts[d.roomId] || 0) + 1;
      }
    });
    return counts;
  }, [devices]);

  const activeCount = useMemo(() => {
    return devices.filter((d) => {
      if (d.status !== 'ONLINE') return false;
      const p = d.currentState?.power;
      return p === true || p === 'true' || p === 'ON' || p === 'on';
    }).length;
  }, [devices]);

  const onlineCount = useMemo(() => {
    return devices.filter((d) => d.status === 'ONLINE').length;
  }, [devices]);

  const handleTurnOffAllLights = async () => {
    const onLights = devices.filter((d) => {
      if (!['LIGHT', 'LED_RGB', 'SMART_PLUG'].includes(d.deviceType)) return false;
      const p = d.currentState?.power;
      return p === true || p === 'true' || p === 'ON' || p === 'on';
    });

    if (onLights.length === 0) {
      notify.info('Không có đèn nào đang bật');
      return;
    }

    notify.info(`Đang tắt ${onLights.length} đèn...`);
    for (const light of onLights) {
      try {
        await sendManualPowerCommand(light.id, 'TURN_OFF');
      } catch (e) {
        console.error('Lỗi tắt đèn', light.name, e);
      }
    }
    notify.success('Đã tắt toàn bộ đèn');
    await fetchDevices();
  };

  // ── Filtered + sorted devices ──
  const filteredDevices = useMemo(() => {
    let list = filterByCategory(devices, activeCategory);
    if (selectedRoomId !== 'ALL') {
      list = list.filter((d) => d.roomId === selectedRoomId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((d) => {
        const nameMatch = d.name.toLowerCase().includes(q);
        const roomMatch = d.roomName ? d.roomName.toLowerCase().includes(q) : false;
        const typeMatch = d.deviceType.toLowerCase().includes(q);
        return nameMatch || roomMatch || typeMatch;
      });
    }
    return list;
  }, [devices, activeCategory, selectedRoomId, searchQuery]);

  const sortedDevices = useMemo(() => {
    return [...filteredDevices].sort((a, b) => {
      const indexA = deviceOrder.indexOf(a.id);
      const indexB = deviceOrder.indexOf(b.id);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [filteredDevices, deviceOrder]);

  // ── Drag-and-drop handlers (Enabled via double click) ──
  const handleCardDoubleClick = (deviceId: string) => {
    if (reorderingDeviceId === deviceId) {
      setReorderingDeviceId(null);
    } else {
      setReorderingDeviceId(deviceId);
      notify.info('Chế độ kéo thả đã kích hoạt', 'Nhấn giữ và kéo thẻ này để sắp xếp vị trí hiển thị');
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    dragItem.current = index;
    e.currentTarget.classList.add('opacity-50');
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('opacity-50');
    setReorderingDeviceId(null);
    if (
      dragItem.current !== null &&
      dragOverItem.current !== null &&
      dragItem.current !== dragOverItem.current
    ) {
      const draggedId = sortedDevices[dragItem.current].id;
      const targetId = sortedDevices[dragOverItem.current].id;

      let currentGlobalOrder = [...deviceOrder];
      // Ensure all current devices are in the global order array
      devices.forEach((d) => {
        if (!currentGlobalOrder.includes(d.id)) {
          currentGlobalOrder.push(d.id);
        }
      });

      // Remove dragged item from its current position
      currentGlobalOrder = currentGlobalOrder.filter((id) => id !== draggedId);

      // Find target position
      const targetGlobalIndex = currentGlobalOrder.indexOf(targetId);
      if (targetGlobalIndex !== -1) {
        // If moving down, insert AFTER target. If moving up, insert BEFORE target.
        const isMovingDown = dragItem.current < dragOverItem.current;
        const insertIndex = isMovingDown ? targetGlobalIndex + 1 : targetGlobalIndex;
        currentGlobalOrder.splice(insertIndex, 0, draggedId);
      } else {
        currentGlobalOrder.push(draggedId);
      }

      setDeviceOrder(currentGlobalOrder);
      if (homeId) {
        localStorage.setItem(`deviceOrder_${homeId}`, JSON.stringify(currentGlobalOrder));
      }
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  // ──────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────

  return (
    <div className="app-shell">
      <HomeSidebar activeItem="devices" homeId={homeId} />

      <main id="main-content" className="lg:pl-64">
        <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
          {/* ───── Header ───── */}
          <div className="surface-card flex items-center gap-4 p-5 sm:p-6">
            <button
              type="button"
              aria-label="Quay lại trang tổng quan"
              onClick={() => navigate('/home')}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-sidebar text-icon transition-colors hover:bg-sidebar-hover hover:text-primary-hover"
            >
              <svg
                aria-hidden
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-bold text-text">Thiết bị trong nhà</h1>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {onlineCount} trực tuyến
                  </span>
                  {activeCount > 0 && (
                    <span className="inline-flex items-center text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                      {activeCount} đang bật
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted mt-0.5">
                Theo dõi kết nối, trạng thái và điều khiển thiết bị
              </p>
            </div>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={handleTurnOffAllLights}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold transition-all shadow-xs active:scale-95"
                title="Tắt toàn bộ đèn đang bật"
              >
                <span>Tắt nhanh đèn ({activeCount})</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
              title="Ghép nối thiết bị mới qua Token hoặc QR Code"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Thiết Bị</span>
            </button>
            <VoiceAssistantButton />
            <NotificationBell />
          </div>

          {/* ───── Scene Quick Bar ───── */}
          <section aria-label="Kịch bản nhanh">
            <SceneBar onSceneActivate={handleSceneActivate} />
          </section>

          {/* ───── Virtual Device Groups (Master Control) ───── */}
          {homeId && (
            <section aria-label="Nhóm thiết bị ảo">
              <DeviceGroupSection
                homeId={homeId}
                availableDevices={devices}
                onRefreshDevices={fetchDevices}
              />
            </section>
          )}

          {/* ───── Status Summary Chips ───── */}
          <section aria-label="Thống kê thiết bị">
            <StatusChips
              devices={devices}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
            />
          </section>

          {/* ───── Room Filter Tabs & Search ───── */}
          <DeviceFilters
            rooms={rooms}
            selectedRoomId={selectedRoomId}
            onRoomChange={setSelectedRoomId}
            roomCounts={roomCounts}
            totalDeviceCount={devices.length}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />

          {/* ───── Device Grid ───── */}
          {loading && devices.length === 0 ? (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 grid-flow-dense gap-4"
              aria-label="Đang tải thiết bị"
            >
              {[
                'col-span-1 sm:col-span-2 h-48',
                'col-span-1 h-44',
                'col-span-1 h-44',
                'col-span-1 sm:col-span-2 h-44',
              ].map((cls, i) => (
                <div
                  key={i}
                  className={`${cls} animate-pulse rounded-2xl bg-off-soft`}
                />
              ))}
            </div>
          ) : error ? (
            <div
              role="alert"
              aria-live="polite"
              className="surface-card border-dashed p-6 text-center text-error"
            >
              {error}
            </div>
          ) : sortedDevices.length === 0 ? (
            <div className="surface-card border-dashed py-14 text-center text-muted space-y-4">
              <p className="text-base font-medium">
                {searchQuery
                  ? `Không tìm thấy thiết bị nào phù hợp với từ khóa "${searchQuery}".`
                  : activeCategory !== 'ALL'
                  ? 'Không có thiết bị nào trong danh mục này.'
                  : 'Chưa có thiết bị nào trong khu vực này.'}
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="px-4 py-2 rounded-xl bg-sidebar border border-line text-text text-xs font-bold hover:bg-sidebar-hover transition-colors shadow-xs cursor-pointer"
                  >
                    Xóa bộ lọc tìm kiếm
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs sm:text-sm font-bold hover:bg-primary-hover transition-colors shadow-xs cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ghép nối thiết bị mới</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 grid-flow-dense gap-4 p-1">
              {sortedDevices.map((device, index) => {
                const wide = isWideCard(device);
                const isDraggable = reorderingDeviceId === device.id;
                return (
                  <div
                    key={device.id}
                    draggable={isDraggable}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleCardDoubleClick(device.id);
                    }}
                    onDragStart={(e) => {
                      if (!isDraggable) {
                        e.preventDefault();
                        return;
                      }
                      handleDragStart(e, index);
                    }}
                    onDragEnter={() => {
                      if (dragItem.current !== null) {
                        handleDragEnter(index);
                      }
                    }}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e: React.DragEvent) => {
                      if (dragItem.current !== null) {
                        e.preventDefault();
                      }
                    }}
                    className={`transition-all select-none ${
                      wide ? 'col-span-1 sm:col-span-2' : 'col-span-1'
                    } ${
                      isDraggable
                        ? 'cursor-grab active:cursor-grabbing ring-2 ring-primary ring-offset-2 rounded-2xl shadow-xl scale-[1.01] z-10'
                        : ''
                    }`}
                  >
                    {isDraggable && (
                      <div className="mb-2 flex items-center justify-between px-2.5 py-1 rounded-xl bg-primary/10 border border-primary/20 text-primary text-[11px] font-semibold animate-pulse">
                        <span>⚡ Kéo để đổi vị trí</span>
                        <span className="text-[10px] text-muted opacity-80">(Double-click để hủy)</span>
                      </div>
                    )}
                    <DeviceCard
                      device={device}
                      powerPending={powerPendingId === device.id}
                      onTogglePower={handleTogglePower}
                      onClick={handleDeviceClick}
                      onStateChange={handleDeviceUpdated}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* ───── Device Detail Drawer ───── */}
      <DeviceDrawer
        key={selectedDevice?.id ?? 'closed'}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setTimeout(() => setSelectedDevice(null), 300);
        }}
        device={selectedDevice ? (devices.find((d) => d.id === selectedDevice.id) ?? selectedDevice) : null}
        onDeviceRemoved={handleDeviceRemoved}
        onDeviceUpdated={handleDeviceUpdated}
        onTogglePower={handleTogglePower}
        onColorChange={handleColorChange}
        onBrightnessChange={handleBrightnessChange}
        isPowerPending={powerPendingId === selectedDevice?.id}
      />

      {/* ───── Add Device Modal ───── */}
      {homeId && (
        <AddDeviceModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          homeId={homeId}
          rooms={rooms}
          selectedRoomId={selectedRoomId}
          onSuccess={() => {
            void fetchDevices();
          }}
        />
      )}
    </div>
  );
};
