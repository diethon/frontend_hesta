import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useSearchParams, useNavigate, Navigate } from "react-router";
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
import { HomeRoomsWidget } from "./HomeRoomsWidget";
import { HomeQuickScenes } from "./HomeQuickScenes";
import { HomeFavoriteDevices } from "./HomeFavoriteDevices";
import { HomeEnergyWidget } from "./HomeEnergyWidget";
import { HomeActivityWidget } from "./HomeActivityWidget";
import { DashboardNavRail } from "./DashboardNavRail";
import { DashboardTopBar, type HomeOption } from "./DashboardTopBar";
import { DashboardBottomNav } from "./DashboardBottomNav";
import { getMyHomes, createHome, updateHome } from "../../services/homeApi";
import { getRooms } from "../../services/roomApi";
import { getDevicesByHome, sendManualPowerCommand } from "../../services/deviceApi";
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
  ArrowLeft,
} from "lucide-react";
import { currentHomeChanged, currentHomeCleared } from "../../store/homeSlice";
import { useAppDispatch } from "../../store/hooks";
import { getErrorMessage } from "../../utils/errors";
import { notify } from '../ui/notify';

interface HomePageProps {
  user: UserResponse;
  onLogout: () => void;
  onProfileUpdate: (user: UserResponse) => void;
}

function retainSelectedHome(
  homes: HomeOption[],
  selectedHome: HomeOption | null,
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
  if (user?.platformRole === 'ADMIN') {
    return <Navigate to="/admin" replace />;
  }

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const requestedHomeId = searchParams.get("homeId");

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Home state
  const [userHome, setUserHome] = useState<HomeOption | null>(null);
  const [homesList, setHomesList] = useState<HomeOption[]>([]);
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
      const homes = (await getMyHomes()) as HomeOption[];
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

  // Deep links scroll and tab selection
  useEffect(() => {
    if (!userHome) return;
    if (location.hash === "#scenes-section") {
      navigate(`/homes/${encodeURIComponent(userHome.homeId)}/scenes`);
    } else if (location.hash === "#members-section") {
      setActiveTabSection('members');
    }
  }, [location.hash, location.key, userHome, navigate]);

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

  const handleOpenRename = (home: HomeOption) => {
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

  // Turn off all lights quick handler
  const handleTurnOffAllLights = async () => {
    const activeLights = devices.filter((d) => {
      const isLight = d.deviceType === 'LIGHT' || d.deviceType === 'LED_RGB';
      const isPowerOn = d.currentState?.power === 'ON' || d.currentState?.power === true;
      return isLight && isPowerOn;
    });

    if (activeLights.length === 0) {
      notify.info('Không có đèn nào đang bật.');
      return;
    }

    try {
      await Promise.allSettled(
        activeLights.map((light) => sendManualPowerCommand(light.id, 'TURN_OFF'))
      );
      notify.success(`Đã tắt ${activeLights.length} đèn đang bật`);
      if (userHome) loadHomeDashboardData(userHome.homeId);
    } catch (err: unknown) {
      notify.error(getErrorMessage(err, 'Lỗi khi tắt đèn.'));
    }
  };

  // Compute live aggregates from devices
  const onlineDevicesCount = devices.filter((d) => d.status === 'ONLINE').length;
  const activeLightsCount = devices.filter((d) => {
    const isLight = d.deviceType === 'LIGHT' || d.deviceType === 'LED_RGB';
    const isPowerOn = d.currentState?.power === 'ON' || d.currentState?.power === true;
    return isLight && isPowerOn;
  }).length;

  const sensorDevices = devices.filter((d) => d.deviceType.includes('SENSOR') && d.currentState?.temperature);
  const avgTemp = sensorDevices.length > 0
    ? sensorDevices.reduce((acc, s) => acc + Number(s.currentState.temperature || 0), 0) / sensorDevices.length
    : 26.9;
  const avgHum = sensorDevices.length > 0
    ? sensorDevices.reduce((acc, s) => acc + Number(s.currentState.humidity || 0), 0) / sensorDevices.length
    : 61.8;

  return (
    <div className="app-shell">
      {/* 3 Pastel Meshes from Figma design */}
      <div className="mesh mesh-one" />
      <div className="mesh mesh-two" />
      <div className="mesh mesh-three" />

      {/* Modern Figma Floating Navigation Rail */}
      <DashboardNavRail
        homeId={userHome?.homeId}
        activeItem={
          activeTabSection === 'dashboard'
            ? 'overview'
            : activeTabSection === 'scenes'
              ? 'scenes'
              : 'members'
        }
        user={user}
        onOpenSettings={() => setIsProfileModalOpen(true)}
        onSelectOverview={() => {
          setActiveTabSection('dashboard');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onSelectMembers={() => setActiveTabSection('members')}
        onOpenProfile={() => setIsProfileModalOpen(true)}
      />

      <main>
        {/* Figma Topbar */}
        <DashboardTopBar
          user={user}
          currentHome={userHome}
          homesList={homesList}
          onSelectHome={(h) => setUserHome(h)}
          onOpenCreateHome={() => setIsCreateModalOpen(true)}
          onOpenRenameHome={(h) => handleOpenRename(h)}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          onLogout={onLogout}
        />

        {/* Fallback back-to-dashboard banner if viewing Scenes or Members */}
        {activeTabSection !== 'dashboard' && (
          <div className="mb-6 flex items-center justify-between p-3 rounded-2xl glass-g2">
            <button
              type="button"
              onClick={() => setActiveTabSection('dashboard')}
              className="flex items-center gap-2 text-xs font-bold text-accent hover:opacity-80 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại Tổng quan Dashboard</span>
            </button>
            <span className="text-xs font-semibold text-secondary">
              {activeTabSection === 'scenes' ? 'Quản lý Kịch bản' : 'Thành viên gia đình'}
            </span>
          </div>
        )}

        {/* ── Main Dashboard: Pixel-perfect Figma Layout ── */}
        {activeTabSection === 'dashboard' && (
          <div className="dashboard">
            <HomeHeroLiveCamera
              homeId={userHome?.homeId}
              totalDevices={devices.length || 8}
              onlineDevices={onlineDevicesCount || 8}
              activeLightsCount={activeLightsCount}
              avgTemperature={avgTemp}
              avgHumidity={avgHum}
              activePowerWatts={energySummary?.activeDeviceCount ? energySummary.activeDeviceCount * 45 : 350}
              onTurnOffAllLights={handleTurnOffAllLights}
            />

            <HomeRoomsWidget
              rooms={rooms}
              devices={devices}
              selectedRoomId={selectedRoomId}
              onSelectRoom={(roomId) => setSelectedRoomId(roomId)}
              onOpenAddRoom={() => setIsRoomModalOpen(true)}
            />

            <HomeQuickScenes
              homeId={userHome?.homeId}
              scenes={scenes}
              onOpenSceneManagement={() => {
                if (userHome?.homeId) {
                  navigate(`/homes/${encodeURIComponent(userHome.homeId)}/scenes`);
                } else {
                  notify.info('Hãy chọn hoặc tạo một ngôi nhà trước.');
                }
              }}
            />

            <HomeFavoriteDevices
              homeId={userHome?.homeId}
              devices={devices}
              selectedRoomId={selectedRoomId}
              onRefreshDevices={() => userHome && loadHomeDashboardData(userHome.homeId)}
            />

            <HomeEnergyWidget
              homeId={userHome?.homeId}
              energySummary={energySummary}
            />

            <HomeActivityWidget homeId={userHome?.homeId} />
          </div>
        )}

        {/* ── Detailed Scene Management (Preserves existing functional logic) ── */}
        {activeTabSection === 'scenes' && userHome && (
          <section id="scenes-section" className="scroll-mt-24 space-y-4">
            <SceneManagement
              key={userHome.homeId}
              homeId={userHome.homeId}
              currentUserRole={userHome.role}
            />
          </section>
        )}

        {/* ── Detailed Member Management (Preserves existing functional logic) ── */}
        {activeTabSection === 'members' && userHome && (
          <section id="members-section" className="scroll-mt-24 space-y-4">
            <MemberManagement
              homeId={userHome.homeId}
              currentUserRole={userHome.role}
            />
          </section>
        )}
      </main>

      {/* Figma Mobile Bottom Navigation */}
      <DashboardBottomNav
        homeId={userHome?.homeId}
        activeItem={activeTabSection === 'dashboard' ? 'overview' : 'scenes'}
        onSelectOverview={() => setActiveTabSection('dashboard')}
        onOpenMore={() => setIsProfileModalOpen(true)}
      />

      {/* ── Functional Modals ── */}
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
