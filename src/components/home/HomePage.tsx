import React, { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, useSearchParams } from "react-router";
import type { UserResponse } from "../../types/auth";
import type { DeviceResponse } from "../../types/device";
import type { RoomResponse } from "../../types/room";
import type { SceneResponse } from "../../types/scene";
import type { EnergySummary } from "../../types/energy";
import { ProfileModal } from "../profile/ProfileModal";
import { MemberManagement } from "./MemberManagement";
import { SceneManagement } from "./SceneManagement";
import { RoomManagementModal } from "../device/RoomManagementModal";
import { HomeHeroLiveCamera } from "./HomeHeroLiveCamera";
import { HomeQuickScenes } from "./HomeQuickScenes";
import { HomeFavoriteDevices } from "./HomeFavoriteDevices";
import { HomeEnergyWidget } from "./HomeEnergyWidget";
import { getMyHomes, createHome, updateHome } from "../../services/homeApi";
import { getRooms } from "../../services/roomApi";
import { getDevicesByHome } from "../../services/deviceApi";
import { getScenes } from "../../services/sceneApi";
import { getHomeEnergySummary } from "../../services/energyApi";
import {
  Pencil,
  Sparkles,
  X,
  Plus,
  Home,
  Building2,
  RotateCw,
  Layers,
  Users,
} from "lucide-react";
import { currentHomeChanged, currentHomeCleared } from "../../store/homeSlice";
import { useAppDispatch } from "../../store/hooks";
import { getErrorMessage } from "../../utils/errors";
import { HomeSidebar } from "../ui/HomeSidebar";
import { NotificationBell } from "../notification/NotificationBell";
import { VoiceAssistantButton } from "../ui/VoiceAssistant";
import { notify } from '../ui/notify';
import { UserAvatar } from '../ui/UserAvatar';

interface HomePageProps {
  user: UserResponse;
  onLogout: () => void;
  onProfileUpdate: (user: UserResponse) => void;
}

interface HomeSummary {
  homeId: string;
  homeName: string;
  role: "OWNER" | "MEMBER";
}

function retainSelectedHome(
  homes: HomeSummary[],
  selectedHome: HomeSummary | null,
) {
  if (homes.length === 0) return null;
  if (!selectedHome) return homes[0];
  return homes.find((home) => home.homeId === selectedHome.homeId) ?? homes[0];
}

export const HomePage: React.FC<HomePageProps> = ({
  user,
  onLogout,
  onProfileUpdate,
}) => {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const requestedHomeId = searchParams.get("homeId");

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Home state
  const [userHome, setUserHome] = useState<HomeSummary | null>(null);
  const [homesList, setHomesList] = useState<HomeSummary[]>([]);
  const [newHomeName, setNewHomeName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameHomeName, setRenameHomeName] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [onboardingHomeName, setOnboardingHomeName] = useState("");
  const [onboardingLoading, setOnboardingLoading] = useState(false);

  // Dashboard Data State
  const [rooms, setRooms] = useState<RoomResponse[]>([]);
  const [devices, setDevices] = useState<DeviceResponse[]>([]);
  const [scenes, setScenes] = useState<SceneResponse[]>([]);
  const [energySummary, setEnergySummary] = useState<EnergySummary | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [activeTabSection, setActiveTabSection] = useState<'dashboard' | 'scenes' | 'members'>('dashboard');

  const fetchHomes = async () => {
    try {
      const homes = (await getMyHomes()) as HomeSummary[];
      setHomesList(homes || []);
      if (homes && homes.length > 0) {
        setUserHome((prev) => {
          if (!prev) return homes[0];
          const exists = homes.find((home) => home.homeId === prev.homeId);
          return exists ? prev : homes[0];
        });
      }
    } catch (err) {
      console.error("Failed to fetch homes", err);
    }
  };

  useEffect(() => {
    let active = true;
    getMyHomes()
      .then((homes) => {
        if (!active) return;
        setHomesList(homes || []);
        setUserHome((selectedHome) =>
          retainSelectedHome(homes || [], homes?.find((home) => home.homeId === requestedHomeId) ?? selectedHome),
        );
      })
      .catch((error: unknown) => {
        if (active) console.error("Failed to fetch homes", error);
      });
    return () => {
      active = false;
    };
  }, [requestedHomeId]);

  // Load home details, rooms, devices, scenes, energy
  const loadHomeDashboardData = useCallback(async (homeId: string) => {
    try {
      const [fetchedRooms, fetchedDevices, fetchedScenes, fetchedEnergy] = await Promise.allSettled([
        getRooms(homeId),
        getDevicesByHome(homeId),
        getScenes(homeId),
        getHomeEnergySummary(homeId).catch(() => null),
      ]);

      if (fetchedRooms.status === 'fulfilled') setRooms(fetchedRooms.value || []);
      if (fetchedDevices.status === 'fulfilled') setDevices(fetchedDevices.value || []);
      if (fetchedScenes.status === 'fulfilled') setScenes(fetchedScenes.value || []);
      if (fetchedEnergy.status === 'fulfilled' && fetchedEnergy.value) setEnergySummary(fetchedEnergy.value);
    } catch (err) {
      console.warn("Error loading dashboard data:", err);
    }
  }, []);

  useEffect(() => {
    if (userHome?.homeId) {
      loadHomeDashboardData(userHome.homeId);
    }
  }, [userHome?.homeId, loadHomeDashboardData]);

  // Scroll into view on deep links
  useEffect(() => {
    if (!userHome) return;
    if (location.hash === "#scenes-section") {
      setActiveTabSection('scenes');
      document.getElementById("scenes-section")?.scrollIntoView({ behavior: "smooth" });
    } else if (location.hash === "#members-section") {
      setActiveTabSection('members');
      document.getElementById("members-section")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [location.hash, location.key, userHome]);

  useEffect(() => {
    dispatch(currentHomeChanged(userHome?.homeId ?? null));
  }, [dispatch, userHome?.homeId]);

  useEffect(
    () => () => {
      dispatch(currentHomeCleared());
    },
    [dispatch],
  );

  const handleCreateHome = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      await createHome(newHomeName.trim());
      notify.success('Tạo nhà thành công', 'Bạn có thể mở Digital Twin để bắt đầu thiết kế sơ đồ.');
      setIsCreateModalOpen(false);
      setNewHomeName("");
      fetchHomes();
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, 'Lỗi khi tạo nhà'));
    } finally {
      setCreateLoading(false);
    }
  };

  useEffect(() => {
    if (userHome && userHome.role === "OWNER") {
      const dismissed = localStorage.getItem(`dismiss_home_name_${userHome.homeId}`);
      if (!dismissed && userHome.homeName.startsWith("Nhà của ")) {
        setOnboardingHomeName(userHome.homeName);
        setIsOnboardingModalOpen(true);
      }
    }
  }, [userHome?.homeId]);

  const handleOpenRename = (home: HomeSummary) => {
    setRenameHomeName(home.homeName);
    setIsRenameModalOpen(true);
  };

  const handleUpdateHomeName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = renameHomeName.trim();
    if (!userHome || !trimmed) return;
    setRenameLoading(true);
    try {
      await updateHome(userHome.homeId, trimmed);
      setIsRenameModalOpen(false);
      notify.success('Đã đổi tên nhà thành công', trimmed);
      await fetchHomes();
    } catch (err) {
      notify.error(getErrorMessage(err, 'Lỗi khi đổi tên nhà'));
    } finally {
      setRenameLoading(false);
    }
  };

  const handleSaveOnboardingName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = onboardingHomeName.trim();
    if (!userHome || !trimmed) return;
    setOnboardingLoading(true);
    try {
      await updateHome(userHome.homeId, trimmed);
      localStorage.setItem(`dismiss_home_name_${userHome.homeId}`, 'true');
      setIsOnboardingModalOpen(false);
      notify.success('Đã cập nhật tên nhà thành công', trimmed);
      await fetchHomes();
    } catch (err) {
      notify.error(getErrorMessage(err, 'Lỗi khi cập nhật tên nhà'));
    } finally {
      setOnboardingLoading(false);
    }
  };

  const handleDismissOnboarding = () => {
    if (userHome) {
      localStorage.setItem(`dismiss_home_name_${userHome.homeId}`, 'true');
    }
    setIsOnboardingModalOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Compute live aggregates from devices
  const onlineDevicesCount = devices.filter((d) => d.status === 'ONLINE').length;
  const activeLightsCount = devices.filter((d) => {
    const isLight = d.deviceType === 'LIGHT' || d.deviceType === 'LED_RGB';
    const isPowerOn = d.currentState?.power === 'ON' || d.currentState?.power === true;
    return isLight && isPowerOn;
  }).length;

  // Temperature & humidity calculation
  const sensorDevices = devices.filter((d) => d.deviceType.includes('SENSOR') && d.currentState?.temperature);
  const avgTemp = sensorDevices.length > 0
    ? sensorDevices.reduce((acc, s) => acc + Number(s.currentState.temperature || 0), 0) / sensorDevices.length
    : 26.9;
  const avgHum = sensorDevices.length > 0
    ? sensorDevices.reduce((acc, s) => acc + Number(s.currentState.humidity || 0), 0) / sensorDevices.length
    : 61.8;

  // Format date in Vietnamese: e.g. "THỨ HAI, 26 THÁNG 10"
  const today = new Date();
  const dateFormatted = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(today).toUpperCase();

  const currentHour = today.getHours();
  const greeting = currentHour < 12 ? 'Chào buổi sáng' : currentHour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';

  return (
    <div className="app-shell relative overflow-x-hidden min-h-screen">
      <HomeSidebar activeItem="overview" homeId={userHome?.homeId} />

      <div className="lg:pl-64">
        {/* Top Navbar */}
        <nav className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur-xl sm:px-6">
          {/* Left Title & Home Switcher */}
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted">
                {dateFormatted}
              </p>
              <h1 className="truncate text-base sm:text-xl font-extrabold tracking-tight text-text">
                {greeting}, {user.fullName?.split(' ').slice(-1)[0] || user.fullName}
              </h1>
            </div>

            {/* Quick Home Switcher */}
            {homesList.length > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 ml-2 pl-3 border-l border-line/70">
                <select
                  value={userHome?.homeId || ""}
                  onChange={(e) => {
                    const selected = homesList.find((h) => h.homeId === e.target.value);
                    if (selected) setUserHome(selected);
                  }}
                  className="rounded-xl border border-line bg-sidebar px-3 py-1.5 text-xs font-semibold text-text outline-none transition focus:border-primary cursor-pointer"
                >
                  {homesList.map((h) => (
                    <option key={h.homeId} value={h.homeId}>
                      {h.homeName} ({h.role === "OWNER" ? "Chủ nhà" : "Thành viên"})
                    </option>
                  ))}
                </select>

                {userHome?.role === "OWNER" && (
                  <button
                    type="button"
                    onClick={() => handleOpenRename(userHome)}
                    className="p-1.5 rounded-lg border border-line bg-sidebar hover:bg-sidebar-hover text-icon hover:text-primary transition-colors cursor-pointer"
                    title="Đổi tên nhà"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs transition-all cursor-pointer shadow-2xs"
                  title="Thêm nhà mới"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm nhà</span>
                </button>
              </div>
            )}
          </div>

          {/* Right Controls */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <VoiceAssistantButton />
            <NotificationBell />

            {/* Profile Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                aria-label="Mở menu tài khoản"
                aria-expanded={isDropdownOpen}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-line bg-primary shadow-soft transition-transform hover:scale-105 focus:outline-none"
              >
                <UserAvatar
                  src={user.avatarUrl}
                  name={user.fullName}
                  size={40}
                  fallbackClassName="text-sm font-bold text-white"
                />
              </button>

              {isDropdownOpen && (
                <div className="gentle-rise absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-line bg-surface py-1 shadow-float">
                  <div className="px-4 py-2 border-b border-line">
                    <p className="truncate text-sm font-bold text-text">{user.fullName}</p>
                    <p className="truncate text-xs text-muted">{user.email}</p>
                  </div>

                  <div className="p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setIsProfileModalOpen(true);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-text hover:bg-sidebar-hover hover:text-primary rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-icon" />
                      <span>Hồ sơ & Bảo mật</span>
                    </button>
                  </div>

                  <div className="border-t border-line p-1">
                    <button
                      type="button"
                      onClick={onLogout}
                      className="w-full text-left px-3 py-2 text-sm text-error hover:bg-error-soft rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* Main Dashboard Content */}
        <main id="main-content" className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
          {userHome ? (
            <>
              {/* Optional Section Selector for Seamless Deep Links */}
              <div className="flex items-center gap-2 border-b border-line pb-2">
                <button
                  type="button"
                  onClick={() => setActiveTabSection('dashboard')}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    activeTabSection === 'dashboard'
                      ? 'bg-primary text-white shadow-soft'
                      : 'bg-surface text-muted hover:text-text hover:bg-sidebar'
                  }`}
                >
                  <Home className="w-4 h-4" />
                  <span>Tổng quan Không gian</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTabSection('scenes')}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    activeTabSection === 'scenes'
                      ? 'bg-primary text-white shadow-soft'
                      : 'bg-surface text-muted hover:text-text hover:bg-sidebar'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Quản lý Kịch bản ({scenes.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTabSection('members')}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    activeTabSection === 'members'
                      ? 'bg-primary text-white shadow-soft'
                      : 'bg-surface text-muted hover:text-text hover:bg-sidebar'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Thành viên gia đình</span>
                </button>
              </div>

              {/* TAB 1: Main Modern Dashboard (Figma Layout) */}
              {activeTabSection === 'dashboard' && (
                <div className="space-y-8">
                  {/* Row 1: Hero Camera Card & Environmental Badges */}
                  <HomeHeroLiveCamera
                    homeId={userHome.homeId}
                    totalDevices={devices.length || 8}
                    onlineDevices={onlineDevicesCount || 8}
                    activeLightsCount={activeLightsCount}
                    avgTemperature={avgTemp}
                    avgHumidity={avgHum}
                    activePowerWatts={energySummary?.activeDeviceCount ? energySummary.activeDeviceCount * 45 : 350}
                  />

                  {/* Row 2: Rooms (Không gian - Phòng) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Không gian</p>
                        <h2 className="text-xl font-bold tracking-tight text-text">Phòng</h2>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsRoomModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs transition-all cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Thêm</span>
                      </button>
                    </div>

                    {/* Room Filter Pills */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                      <button
                        type="button"
                        onClick={() => setSelectedRoomId(null)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                          selectedRoomId === null
                            ? 'bg-primary text-white shadow-soft scale-102'
                            : 'bg-surface text-muted hover:text-text hover:bg-sidebar border border-line'
                        }`}
                      >
                        <span>Tất cả</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          selectedRoomId === null ? 'bg-white/20 text-white' : 'bg-sidebar text-muted'
                        }`}>
                          {devices.length || 4}
                        </span>
                      </button>

                      {rooms.map((room) => {
                        const isSelected = selectedRoomId === room.id;
                        const roomDeviceCount = devices.filter((d) => d.roomId === room.id).length;
                        return (
                          <button
                            key={room.id}
                            type="button"
                            onClick={() => setSelectedRoomId(room.id)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                              isSelected
                                ? 'bg-primary text-white shadow-soft scale-102'
                                : 'bg-surface text-muted hover:text-text hover:bg-sidebar border border-line'
                            }`}
                          >
                            <span>{room.name}</span>
                            {roomDeviceCount > 0 && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                isSelected ? 'bg-white/20 text-white' : 'bg-sidebar text-muted'
                              }`}>
                                {roomDeviceCount}
                              </span>
                            )}
                          </button>
                        );
                      })}

                      {rooms.length === 0 && (
                        <>
                          {['P. khách', 'P. ngủ', 'P. bếp', 'Hành lang', 'Ban công'].map((mockRoomName) => (
                            <button
                              key={mockRoomName}
                              type="button"
                              onClick={() => notify.info(`Lọc theo ${mockRoomName}`)}
                              className="px-5 py-2.5 rounded-2xl text-xs font-bold bg-surface text-muted hover:text-text hover:bg-sidebar border border-line shrink-0 cursor-pointer transition-all"
                            >
                              {mockRoomName}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Row 3: Quick Scenes (Truy cập nhanh - Kịch bản) */}
                  <HomeQuickScenes
                    homeId={userHome.homeId}
                    scenes={scenes}
                    onOpenSceneManagement={() => setActiveTabSection('scenes')}
                  />

                  {/* Row 4: Favorite Devices (Left 8 cols) & Energy Widget (Right 4 cols) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    <div className="lg:col-span-8">
                      <HomeFavoriteDevices
                        homeId={userHome.homeId}
                        devices={devices}
                        selectedRoomId={selectedRoomId}
                        onRefreshDevices={() => loadHomeDashboardData(userHome.homeId)}
                      />
                    </div>

                    <div className="lg:col-span-4">
                      <HomeEnergyWidget
                        homeId={userHome.homeId}
                        energySummary={energySummary}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Detailed Scene Management (Preserves existing functional logic) */}
              {activeTabSection === 'scenes' && (
                <section id="scenes-section" className="scroll-mt-24 space-y-4">
                  <SceneManagement
                    key={userHome.homeId}
                    homeId={userHome.homeId}
                    currentUserRole={userHome.role}
                  />
                </section>
              )}

              {/* TAB 3: Member Management (Preserves existing functional logic) */}
              {activeTabSection === 'members' && (
                <section id="members-section" className="scroll-mt-24 space-y-4">
                  <MemberManagement
                    homeId={userHome.homeId}
                    currentUserRole={userHome.role}
                  />
                </section>
              )}
            </>
          ) : (
            /* Empty State when no home exists yet */
            <div className="surface-card mt-8 border-dashed border-2 border-primary/20 p-10 text-center rounded-3xl bg-gradient-to-b from-surface via-surface to-primary/5 max-w-lg mx-auto shadow-sm">
              <div className="w-16 h-16 bg-primary/10 text-primary border border-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs">
                <Home className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-text mb-2">
                Bạn chưa tham gia Ngôi nhà nào
              </h3>
              <p className="text-xs text-muted mb-6 leading-relaxed">
                Bạn cần có một Ngôi nhà để kết nối thiết bị IoT, bố trí sơ đồ Digital Twin và chia sẻ quyền điều khiển.
              </p>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl transition-all shadow-md hover:shadow-lg cursor-pointer mx-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Tạo nhà mới ngay</span>
              </button>
            </div>
          )}
        </main>
      </div>

      {/* ── All Working Modals ── */}
      {/* Room Management Modal */}
      {userHome && isRoomModalOpen && (
        <RoomManagementModal
          isOpen={isRoomModalOpen}
          onClose={() => setIsRoomModalOpen(false)}
          homeId={userHome.homeId}
          onRoomsChanged={() => loadHomeDashboardData(userHome.homeId)}
        />
      )}

      {/* Create Home Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-home-title"
            className="surface-card w-full max-w-md rounded-3xl shadow-2xl border border-line overflow-hidden bg-gradient-to-b from-surface via-surface to-primary/5 animate-in zoom-in-95 duration-200"
          >
            <div className="p-6 border-b border-line flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
                  <Home className="w-6 h-6" />
                </div>
                <div>
                  <h3 id="create-home-title" className="text-lg font-bold text-text leading-snug">
                    Tạo Ngôi Nhà Mới
                  </h3>
                  <p className="text-xs text-muted">
                    Khởi tạo không gian sống & kết nối thiết bị thông minh
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Đóng cửa sổ tạo nhà"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-xl text-icon hover:bg-sidebar-hover hover:text-text transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateHome} className="p-6 space-y-5">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="new-home-name" className="text-xs font-bold uppercase tracking-wider text-muted">
                    Tên ngôi nhà của bạn <span className="text-primary">*</span>
                  </label>
                  <span className="text-[11px] font-mono text-muted">{newHomeName.length}/50</span>
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <input
                    id="new-home-name"
                    type="text"
                    placeholder="VD: Căn hộ 1205, Biệt thự Ecopark, Nhà riêng…"
                    value={newHomeName}
                    onChange={(e) => setNewHomeName(e.target.value)}
                    className="w-full bg-surface border border-line rounded-xl pl-10 pr-4 py-3 text-sm text-text placeholder-muted/60 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    maxLength={50}
                    autoFocus
                    autoComplete="off"
                  />
                </div>

                <div className="mt-2.5">
                  <p className="text-[11px] text-muted mb-1.5 font-medium">Gợi ý nhanh:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["Nhà riêng", "Căn hộ chung cư", "Biệt thự sân vườn", "Văn phòng làm việc"].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setNewHomeName(tag)}
                        className="text-[11px] px-2.5 py-1 rounded-lg border border-line bg-sidebar hover:border-primary/50 hover:bg-primary/5 text-muted hover:text-text transition-all cursor-pointer"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-line text-xs font-semibold text-text hover:bg-sidebar transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  {createLoading ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang khởi tạo…</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Xác nhận tạo mới</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Home Modal */}
      {isRenameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="surface-card w-full max-w-sm rounded-2xl shadow-xl border border-line overflow-hidden">
            <div className="p-5 border-b border-line flex justify-between items-center">
              <h3 className="text-base font-bold text-text flex items-center gap-2">
                <Pencil className="w-4 h-4 text-primary" />
                Đổi Tên Nhà
              </h3>
              <button
                type="button"
                onClick={() => setIsRenameModalOpen(false)}
                className="p-1 rounded-lg text-icon hover:text-text hover:bg-sidebar-hover"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpdateHomeName} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted mb-1.5">Tên ngôi nhà của bạn</label>
                <input
                  type="text"
                  value={renameHomeName}
                  onChange={(e) => setRenameHomeName(e.target.value)}
                  placeholder="VD: Nhà riêng, Căn hộ 1205…"
                  maxLength={50}
                  className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm text-text placeholder:text-muted focus:border-primary outline-none"
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsRenameModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-line text-muted hover:text-text"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={renameLoading || !renameHomeName.trim()}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-primary text-white hover:bg-primary-hover shadow-xs disabled:opacity-50"
                >
                  {renameLoading ? "Đang lưu…" : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* First-time Onboarding Modal */}
      {isOnboardingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="surface-card w-full max-w-md rounded-2xl shadow-2xl border border-line p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-base font-bold text-text">Chào mừng bạn đến với HESTA!</h3>
                <p className="text-xs text-muted">
                  Hãy đặt tên cho ngôi nhà của bạn để dễ dàng nhận biết và quản lý.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveOnboardingName} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-muted mb-1.5">Tên ngôi nhà của bạn</label>
                <input
                  type="text"
                  value={onboardingHomeName}
                  onChange={(e) => setOnboardingHomeName(e.target.value)}
                  placeholder="VD: Nhà riêng, Căn hộ 1205…"
                  maxLength={50}
                  className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm text-text placeholder:text-muted focus:border-primary outline-none"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={handleDismissOnboarding}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-line text-muted hover:text-text transition-colors"
                >
                  Để sau
                </button>
                <button
                  type="submit"
                  disabled={onboardingLoading || !onboardingHomeName.trim()}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-primary text-white hover:bg-primary-hover shadow-xs transition-colors disabled:opacity-50"
                >
                  {onboardingLoading ? "Đang lưu…" : "Lưu tên nhà"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {isProfileModalOpen ? (
        <ProfileModal
          isOpen
          onClose={() => setIsProfileModalOpen(false)}
          user={user}
          onProfileUpdate={onProfileUpdate}
        />
      ) : null}
    </div>
  );
};
