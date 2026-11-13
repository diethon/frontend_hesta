import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useSearchParams, useNavigate, Navigate } from "react-router";
import type { UserResponse } from "../../types/auth";
import type { DeviceResponse } from "../../types/device";
import type { RoomResponse } from "../../types/room";
import type { SceneResponse } from "../../types/scene";
import type { EnergySummary, EnergyAnalyticsResponse, DeviceEnergyBreakdown } from "../../types/energy";
import { ProfileModal } from "../profile/ProfileModal";
import { MemberManagement } from "./MemberManagement";
import { RoomManagementModal } from "../device/RoomManagementModal";
import { HomeHeroLiveCamera } from "./HomeHeroLiveCamera";
import { HomeRoomsWidget } from "./HomeRoomsWidget";
import { HomeQuickScenes } from "./HomeQuickScenes";
import { HomeFavoriteDevices } from "./HomeFavoriteDevices";
import { HomeEnergyWidget } from "./HomeEnergyWidget";
import { HomeActivityWidget } from "./HomeActivityWidget";
import { SpotlightRecommendationBanner } from "./SpotlightRecommendationBanner";
import { DashboardNavRail } from "./DashboardNavRail";
import { DashboardTopBar, type HomeOption } from "./DashboardTopBar";
import { DashboardBottomNav } from "./DashboardBottomNav";
import { getMyHomes, createHome, updateHome } from "../../services/homeApi";
import { getRooms } from "../../services/roomApi";
import { getDevicesByHome, sendManualPowerCommand, homeDevicesKey } from "../../services/deviceApi";
import { getScenes } from "../../services/sceneApi";
import { getHomeEnergyAnalytics, energyAnalyticsKey } from "../../services/energyApi";
import { peekCache } from "../../services/queryCache";
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

function isDeviceOn(d: DeviceResponse): boolean {
  return (
    d.currentState?.power === 'ON' ||
    d.currentState?.power === true ||
    d.currentState?.power === 'true' ||
    d.currentState?.state === 'ON' ||
    d.currentState?.state === true ||
    d.currentState?.state === 'true'
  );
}

export const HomePage: React.FC<HomePageProps> = ({
  user,
  onLogout,
  onProfileUpdate,
}) => {
  // Hooks called unconditionally at top of component
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
  const [energyAnalytics, setEnergyAnalytics] = useState<EnergyAnalyticsResponse | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [activeTabSection, setActiveTabSection] = useState<'dashboard' | 'members'>('dashboard');

  const fetchHomes = useCallback(async () => {
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
  }, []);

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

  // Refresh counter to trigger dashboard reload
  const [dashboardVersion, setDashboardVersion] = useState(0);
  const reloadDashboard = useCallback(() => {
    setDashboardVersion((v) => v + 1);
  }, []);

  // Load home details, rooms, devices, scenes, energy asynchronously
  useEffect(() => {
    if (!userHome?.homeId) return;
    const homeId = userHome.homeId;
    let active = true;

    // Fast-path: immediately restore cached devices & energy analytics so switching back to Overview has zero flicker
    const cachedDevices = peekCache<DeviceResponse[]>(homeDevicesKey(homeId));
    if (cachedDevices) {
      setDevices(cachedDevices);
    }
    const cachedAnalytics = peekCache<EnergyAnalyticsResponse>(energyAnalyticsKey(homeId, '7D'));
    if (cachedAnalytics) {
      setEnergyAnalytics(cachedAnalytics);
      if (cachedAnalytics.summary) {
        setEnergySummary(cachedAnalytics.summary);
      }
    }

    Promise.allSettled([
      getRooms(homeId),
      getDevicesByHome(homeId),
      getScenes(homeId),
      getHomeEnergyAnalytics(homeId, '7D').catch(() => null),
    ])
      .then(([fetchedRooms, fetchedDevices, fetchedScenes, fetchedAnalytics]) => {
        if (!active) return;
        if (fetchedRooms.status === 'fulfilled') setRooms(fetchedRooms.value || []);
        if (fetchedDevices.status === 'fulfilled') setDevices(fetchedDevices.value || []);
        if (fetchedScenes.status === 'fulfilled') setScenes(fetchedScenes.value || []);
        if (fetchedAnalytics.status === 'fulfilled' && fetchedAnalytics.value) {
          setEnergyAnalytics(fetchedAnalytics.value);
          if (fetchedAnalytics.value.summary) {
            setEnergySummary(fetchedAnalytics.value.summary);
          }
        }
      })
      .catch((err) => {
        console.warn("Error loading dashboard data:", err);
      });

    return () => {
      active = false;
    };
  }, [userHome?.homeId, dashboardVersion]);

  // Deep links scroll and tab selection
  useEffect(() => {
    if (!userHome) return;
    if (location.hash === "#scenes-section") {
      navigate(`/homes/${encodeURIComponent(userHome.homeId)}/scenes`);
    } else if (location.hash === "#members-section") {
      queueMicrotask(() => {
        setActiveTabSection('members');
      });
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
      notify.success('Tạo nhà thành công', 'Bạn có thể mở Mô hình 3D để bắt đầu thiết kế sơ đồ.');
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
        queueMicrotask(() => {
          setOnboardingHomeName(userHome.homeName);
          setIsOnboardingModalOpen(true);
        });
      }
    }
  }, [userHome]);

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
      if (userHome) reloadDashboard();
    } catch (err: unknown) {
      notify.error(getErrorMessage(err, 'Lỗi khi tắt đèn.'));
    }
  };

  // Redirect admin platform role
  if (user?.platformRole === 'ADMIN') {
    return <Navigate to="/admin" replace />;
  }

  // Compute live aggregates from devices
  const onlineDevicesCount = devices.filter((d) => d.status === 'ONLINE').length;
  const activeLightsCount = devices.filter((d) => {
    const isLight = d.deviceType === 'LIGHT' || d.deviceType === 'LED_RGB';
    const isPowerOn = d.currentState?.power === 'ON' || d.currentState?.power === true;
    return isLight && isPowerOn;
  }).length;

  // Build breakdown map from 24H analytics
  const breakdownMap = new Map<string, DeviceEnergyBreakdown>();
  if (energyAnalytics?.breakdown) {
    for (const item of energyAnalytics.breakdown) {
      breakdownMap.set(item.deviceId, item);
    }
  }

  // Real active power watts (0 if no device on)
  const activePowerWatts = devices.reduce((sum, d) => {
    if (!isDeviceOn(d)) return sum;
    const savedLocalW =
      typeof window !== 'undefined' && d.id
        ? Number(window.localStorage.getItem(`hesta_wattage_${d.id}`)) || undefined
        : undefined;
    const rawWattage =
      savedLocalW ??
      d.currentState?.watts ??
      d.currentState?.powerWatts ??
      d.settings?.wattage ??
      breakdownMap.get(d.id)?.wattage ??
      (d.deviceType?.toUpperCase().includes('AC') ||
      d.deviceType?.toUpperCase().includes('AIR_CONDITIONER')
        ? 750
        : 40);
    return sum + Number(rawWattage || 0);
  }, 0);

  // Compute real average temperature & humidity
  const tempDevices = devices.filter((d) => d.currentState?.temperature != null);
  const humDevices = devices.filter((d) => d.currentState?.humidity != null);

  const sensorTempDevices = tempDevices.filter((d) =>
    d.deviceType?.toUpperCase().includes('SENSOR')
  );
  const effectiveTempDevices =
    sensorTempDevices.length > 0 ? sensorTempDevices : tempDevices;
  const avgTemp =
    effectiveTempDevices.length > 0
      ? effectiveTempDevices.reduce(
          (acc, s) => acc + Number(s.currentState.temperature || 0),
          0
        ) / effectiveTempDevices.length
      : null;

  const sensorHumDevices = humDevices.filter((d) =>
    d.deviceType?.toUpperCase().includes('SENSOR')
  );
  const effectiveHumDevices =
    sensorHumDevices.length > 0 ? sensorHumDevices : humDevices;
  const avgHum =
    effectiveHumDevices.length > 0
      ? effectiveHumDevices.reduce(
          (acc, s) => acc + Number(s.currentState.humidity || 0),
          0
        ) / effectiveHumDevices.length
      : null;

  return (
    <div className="app-shell">
      {/* 3 Pastel Meshes from Figma design */}
      <div className="mesh mesh-one" />
      <div className="mesh mesh-two" />
      <div className="mesh mesh-three" />

      {/* Modern Figma Floating Navigation Rail */}
      <DashboardNavRail
        homeId={userHome?.homeId}
        activeItem={activeTabSection === 'dashboard' ? 'overview' : 'members'}
        user={user}
        onOpenSettings={() => setIsProfileModalOpen(true)}
        onSelectOverview={() => {
          setActiveTabSection('dashboard');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onSelectMembers={() => {
          setActiveTabSection('members');
          setTimeout(() => {
            document.getElementById('members-section')?.scrollIntoView({ behavior: 'smooth' });
          }, 50);
        }}
        onOpenProfile={() => setIsProfileModalOpen(true)}
      />

      <main>
        {/* Figma Topbar with real data */}
        <DashboardTopBar
          user={user}
          currentHome={userHome}
          homesList={homesList}
          onSelectHome={(h) => setUserHome(h)}
          onOpenCreateHome={() => setIsCreateModalOpen(true)}
          onOpenRenameHome={(h) => handleOpenRename(h)}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          onLogout={onLogout}
          avgTemp={avgTemp}
          avgHum={avgHum}
          totalDevices={devices.length}
          onlineDevices={onlineDevicesCount}
          activePowerWatts={activePowerWatts}
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
              <span>Quay lại Màn hình tổng quan</span>
            </button>
            <span className="text-xs font-semibold text-secondary">
              Thành viên gia đình
            </span>
          </div>
        )}

        {/* ── Main Dashboard: Real Data Only ── */}
        {activeTabSection === 'dashboard' && (
          <div className="dashboard">
            <SpotlightRecommendationBanner
              homeId={userHome?.homeId}
              onApplied={() => {
                reloadDashboard();
              }}
            />

            <HomeHeroLiveCamera
              homeId={userHome?.homeId}
              totalDevices={devices.length}
              onlineDevices={onlineDevicesCount}
              activeLightsCount={activeLightsCount}
              avgTemperature={avgTemp ?? undefined}
              avgHumidity={avgHum ?? undefined}
              activePowerWatts={activePowerWatts}
              onTurnOffAllLights={handleTurnOffAllLights}
            />

            <HomeRoomsWidget
              homeId={userHome?.homeId}
              rooms={rooms}
              devices={devices}
              selectedRoomId={selectedRoomId}
              onSelectRoom={(roomId) => setSelectedRoomId(roomId)}
              onOpenAddRoom={() => setIsRoomModalOpen(true)}
            />

            <HomeQuickScenes
              homeId={userHome?.homeId}
              scenes={scenes}
              onTurnOffAllLights={handleTurnOffAllLights}
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
              onRefreshDevices={reloadDashboard}
              onDeviceUpdated={(updated) => {
                setDevices((prev) =>
                  prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d))
                );
              }}
              onDeviceDeleted={(deletedId) => {
                setDevices((prev) => prev.filter((d) => d.id !== deletedId));
              }}
            />

            <HomeEnergyWidget
              homeId={userHome?.homeId}
              energySummary={energySummary}
              energyAnalytics={energyAnalytics}
            />

            <HomeActivityWidget
              homeId={userHome?.homeId}
              devices={devices}
            />
          </div>
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

      {/* ── Functional Modals with Glass Polish ── */}
      {/* Room Management Modal */}
      {userHome && isRoomModalOpen && (
        <RoomManagementModal
          isOpen={isRoomModalOpen}
          onClose={() => setIsRoomModalOpen(false)}
          homeId={userHome.homeId}
          onRoomsChanged={reloadDashboard}
        />
      )}

      {/* Create Home Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/55 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-home-title"
            className="bg-[var(--solid)] border border-[var(--border)] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
          >
            <div className="p-6 border-b border-[var(--border)] flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
                  <Home className="w-6 h-6" />
                </div>
                <div>
                  <h3 id="create-home-title" className="text-lg font-bold text-[var(--text)] leading-snug">
                    Tạo Ngôi Nhà Mới
                  </h3>
                  <p className="text-xs text-[var(--secondary)]">
                    Khởi tạo không gian sống & kết nối thiết bị thông minh
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Đóng cửa sổ tạo nhà"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-xl text-[var(--secondary)] hover:bg-[var(--g1)] hover:text-[var(--text)] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateHome} className="p-6 space-y-5">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="new-home-name" className="text-xs font-bold uppercase tracking-wider text-[var(--secondary)]">
                    Tên ngôi nhà của bạn <span className="text-primary">*</span>
                  </label>
                  <span className="text-[11px] font-mono text-[var(--secondary)]">{newHomeName.length}/50</span>
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--tertiary)]">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <input
                    id="new-home-name"
                    type="text"
                    placeholder="VD: Căn hộ 1205, Biệt thự Ecopark, Nhà riêng…"
                    value={newHomeName}
                    onChange={(e) => setNewHomeName(e.target.value)}
                    className="w-full bg-[var(--g1)] border border-[var(--border)] rounded-xl pl-10 pr-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--tertiary)] focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    maxLength={50}
                    autoFocus
                    autoComplete="off"
                  />
                </div>

                <div className="mt-2.5">
                  <p className="text-[11px] text-[var(--secondary)] mb-1.5 font-medium">Gợi ý nhanh:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["Nhà riêng", "Căn hộ chung cư", "Biệt thự sân vườn", "Văn phòng làm việc"].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setNewHomeName(tag)}
                        className="text-[11px] px-2.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--g1)] hover:border-primary/50 hover:bg-primary/5 text-[var(--secondary)] hover:text-[var(--text)] transition-all cursor-pointer"
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
                  className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--g1)] transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:opacity-90 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/55 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-[var(--solid)] border border-[var(--border)] w-full max-w-sm rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="pb-4 border-b border-[var(--border)] flex justify-between items-center">
              <h3 className="text-base font-bold text-[var(--text)] flex items-center gap-2">
                <Pencil className="w-4 h-4 text-primary" />
                Đổi Tên Nhà
              </h3>
              <button
                type="button"
                onClick={() => setIsRenameModalOpen(false)}
                className="p-1 rounded-lg text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--g1)] cursor-pointer"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpdateHomeName} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--secondary)] mb-1.5">Tên ngôi nhà của bạn</label>
                <input
                  type="text"
                  value={renameHomeName}
                  onChange={(e) => setRenameHomeName(e.target.value)}
                  placeholder="VD: Nhà riêng, Căn hộ 1205…"
                  maxLength={50}
                  className="w-full bg-[var(--g1)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--tertiary)] focus:border-primary outline-none"
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setIsRenameModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-[var(--border)] text-[var(--secondary)] hover:bg-[var(--g1)] hover:text-[var(--text)] cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={renameLoading || !renameHomeName.trim()}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-primary text-white hover:opacity-90 shadow-xs disabled:opacity-50 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/55 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-[var(--solid)] border border-[var(--border)] w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--text)]">Chào mừng bạn đến với HESTA!</h3>
                <p className="text-xs text-[var(--secondary)]">
                  Hãy đặt tên cho ngôi nhà của bạn để dễ dàng nhận biết và quản lý.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveOnboardingName} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-[var(--secondary)] mb-1.5">Tên ngôi nhà của bạn</label>
                <input
                  type="text"
                  value={onboardingHomeName}
                  onChange={(e) => setOnboardingHomeName(e.target.value)}
                  placeholder="VD: Nhà riêng, Căn hộ 1205…"
                  maxLength={50}
                  className="w-full bg-[var(--g1)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--tertiary)] focus:border-primary outline-none"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={handleDismissOnboarding}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-[var(--border)] text-[var(--secondary)] hover:bg-[var(--g1)] hover:text-[var(--text)] transition-colors cursor-pointer"
                >
                  Để sau
                </button>
                <button
                  type="submit"
                  disabled={onboardingLoading || !onboardingHomeName.trim()}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-primary text-white hover:opacity-90 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
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
