import React, { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import type { UserResponse } from "../../types/auth";
import { ProfileModal } from "../profile/ProfileModal";
import { MemberManagement } from "./MemberManagement";
import { SceneManagement } from "./SceneManagement";
import { getMyHomes, createHome, updateHome } from "../../services/homeApi";
import { Pencil, Sparkles, X, Plus, Home, Building2, RotateCw, Crown } from "lucide-react";
import { currentHomeChanged, currentHomeCleared } from "../../store/homeSlice";
import { useAppDispatch } from "../../store/hooks";
import { getErrorMessage } from "../../utils/errors";
import { HomeSidebar } from "../ui/HomeSidebar";
import { NotificationBell } from "../notification/NotificationBell";
import { VoiceAssistantButton } from "../ui/VoiceAssistant";
import { Link } from "react-router";
import { notify } from '../ui/notify';
import { UserAvatar } from '../ui/UserAvatar';

interface HomePageProps {
  user: UserResponse;
  onLogout: () => void;
  onProfileUpdate: (user: UserResponse) => void;
}

function retainSelectedHome(
  homes: HomeSummary[],
  selectedHome: HomeSummary | null,
) {
  if (homes.length === 0) return null;
  if (!selectedHome) return homes[0];
  return homes.find((home) => home.homeId === selectedHome.homeId) ?? homes[0];
}

interface HomeSummary {
  homeId: string;
  homeName: string;
  role: "OWNER" | "MEMBER";
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
  const [userHome, setUserHome] = useState<HomeSummary | null>(null);
  const [newHomeName, setNewHomeName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameHomeName, setRenameHomeName] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [onboardingHomeName, setOnboardingHomeName] = useState("");
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [homesList, setHomesList] = useState<HomeSummary[]>([]);
  const navigate = useNavigate();
  const fetchHomes = async () => {
    try {
      const homes = (await getMyHomes()) as HomeSummary[];
      setHomesList(homes || []);
      if (homes && homes.length > 0) {
        // Only set userHome if it hasn't been set, or if the current one is no longer in the list
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

  useEffect(() => {
    if (!userHome || (location.hash !== "#scenes-section" && location.hash !== "#members-section")) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
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

  useEffect(() => {
    if (window.location.hash === "#members-section") {
      const timer = setTimeout(() => {
        document.getElementById("members-section")?.scrollIntoView({ behavior: "smooth" });
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [userHome?.homeId]);

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

  // First-time owner onboarding: prompt to name home if it still has the default "Nhà của..." name
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
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="app-shell relative overflow-x-hidden">
      <HomeSidebar activeItem="overview" homeId={userHome?.homeId} />
      <div className="lg:pl-64">
        {/* Top Navbar */}
        <nav className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-line bg-white/90 px-4 py-3 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-soft">
              <svg
                aria-hidden={true}
                className="w-6 h-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold tracking-tight text-text sm:text-lg">
                HESTA Smart Home
              </h1>
              <p className="hidden text-xs text-muted sm:block">
                Mọi điều quan trọng trong một nơi
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <span
              className={`hidden sm:inline-block px-2.5 py-1 text-xs font-semibold rounded-full border ${
                user.platformRole === "ADMIN"
                  ? "border-warning bg-warning-soft text-text"
                  : "border-info bg-info-soft text-primary-hover"
              }`}
            >
              {user.platformRole}
            </span>

            <VoiceAssistantButton />
            <NotificationBell />

            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                aria-label="Mở menu tài khoản"
                aria-expanded={isDropdownOpen}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-line bg-primary shadow-soft transition-colors hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface"
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
                    <p className="truncate text-sm font-medium text-text">
                      {user.fullName}
                    </p>
                    <p className="text-xs text-muted truncate">
                      {user.email}
                    </p>
                  </div>

                  <div className="p-1">
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setIsProfileModalOpen(true);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-text hover:bg-sidebar-hover hover:text-primary-hover rounded-xl transition-colors flex items-center gap-2"
                    >
                      <svg
                        aria-hidden={true}
                        className="w-4 h-4 text-icon"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      Hồ sơ & Bảo mật
                    </button>

                    <button className="w-full text-left px-3 py-2 text-sm text-text hover:bg-sidebar-hover hover:text-primary-hover rounded-xl transition-colors flex items-center gap-2">
                      <svg
                        aria-hidden={true}
                        className="w-4 h-4 text-icon"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      Cài đặt
                    </button>
                  </div>

                  <div className="border-t border-line p-1">
                    <button
                      onClick={onLogout}
                      className="w-full text-left px-3 py-2 text-sm text-error hover:bg-error-soft rounded-xl transition-colors flex items-center gap-2"
                    >
                      <svg
                        aria-hidden={true}
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                      Đăng xuất
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* Main Content Dashboard */}
        <main
          id="main-content"
          className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8"
        >
          {/* Welcome Banner */}
          <div className="surface-card relative flex flex-col items-start justify-between gap-6 overflow-hidden p-6 md:flex-row md:items-center lg:p-8">
            <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-cyan-500/5 blur-2xl pointer-events-none" />
            <div className="relative z-10">
              <p className="mb-2 text-sm font-semibold text-primary-hover">
                Chào mừng bạn trở lại
              </p>
              <h2 className="mb-2 text-2xl font-bold text-text sm:text-3xl">
                Xin chào, {user.fullName}
              </h2>
              <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
                Chào mừng bạn quay trở lại. Hãy cùng quản lý không gian sống thông minh, an toàn và tiện nghi của gia đình bạn.
              </p>
            </div>
            {homesList.length > 0 && (
              <div className="relative z-10 w-full md:w-auto">
                <label
                  htmlFor="home-selector"
                  className="block text-xs font-medium text-slate-400 mb-1"
                >
                  Đang xem thông tin của nhà:
                </label>
                <div className="flex items-center gap-2">
                  <select
                    id="home-selector"
                    value={userHome?.homeId || ""}
                    onChange={(e) => {
                      const selected = homesList.find(
                        (h) => h.homeId === e.target.value,
                      );
                      if (selected) setUserHome(selected);
                    }}
                    className="w-full rounded-xl border border-line bg-sidebar px-4 py-2.5 text-sm text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 md:w-64"
                  >
                    {homesList.map((h) => (
                      <option key={h.homeId} value={h.homeId}>
                        {h.homeName} (
                        {h.role === "OWNER" ? "Chủ nhà" : "Thành viên"})
                      </option>
                    ))}
                  </select>
                  {userHome?.role === "OWNER" && (
                    <button
                      type="button"
                      onClick={() => handleOpenRename(userHome)}
                      className="p-2.5 rounded-xl border border-line bg-sidebar hover:bg-sidebar-hover text-icon hover:text-primary transition-colors shrink-0 cursor-pointer"
                      title="Đổi tên nhà"
                      aria-label="Đổi tên nhà"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-xs transition-all shrink-0 cursor-pointer shadow-xs"
                    title="Tạo thêm nhà mới"
                    aria-label="Tạo thêm nhà mới"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm nhà</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          <div
            onClick={() => {
              if (userHome) {
                navigate(`/home/${userHome.homeId}/devices`);
              } else {
                notify.info('Hãy tạo hoặc tham gia một ngôi nhà trước khi quản lý thiết bị.');
              }
            }}
            className="surface-card group cursor-pointer p-6 transition hover:-translate-y-0.5 hover:border-primary md:col-span-3"
          >
            <div className="w-12 h-12 bg-cyan-500/10 text-cyan-400 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg aria-hidden={true} className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-text mb-1">Quản lý Thiết bị</h3>
            <p className="text-xs text-muted leading-relaxed">Theo dõi và điều khiển các thiết bị thông minh (Đèn, Quạt, Cảm biến) trong nhà.</p>
          </div>

            <div className="surface-card group p-6 transition hover:-translate-y-0.5 hover:border-primary md:col-span-3">
              <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg
                  aria-hidden={true}
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <h3 className="text-base font-bold text-text mb-1">
                Kịch bản & Tự động hóa
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                Kích hoạt các ngữ cảnh thông minh (Về nhà, Đi ngủ, Cảnh báo an
                ninh).
              </p>
              {userHome && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to={`/homes/${userHome.homeId}/scenes`}
                    className="rounded-xl bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary-hover"
                  >
                    Scene
                  </Link>
                  <Link
                    to={`/homes/${userHome.homeId}/automation-rules`}
                    className="rounded-xl bg-sidebar px-3 py-2 text-xs font-medium text-text hover:bg-sidebar-hover"
                  >
                    Automation
                  </Link>
                  <Link
                    to={`/homes/${userHome.homeId}/recommendations`}
                    className="rounded-xl bg-success-soft px-3 py-2 text-xs font-medium text-text hover:bg-sidebar-hover"
                  >
                    Gợi ý AI
                  </Link>
                </div>
              )}
            </div>

            <div className="surface-card group p-6 transition hover:-translate-y-0.5 hover:border-mint md:col-span-6 lg:flex lg:items-center lg:gap-5">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-success-soft text-mint-hover transition-transform group-hover:scale-105">
                <svg
                  aria-hidden={true}
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <h3 className="text-base font-bold text-text mb-1">
                Hồ sơ & Phân quyền
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Thông tin cá nhân, cài đặt nhiệt độ/độ sáng ưu tiên và phân
                quyền gia đình.
              </p>
            </div>
          </div>

          {userHome ? (
            <div className="mt-8 space-y-6">
              <section id="scenes-section" className="scroll-mt-24">
                <SceneManagement
                  key={userHome.homeId}
                  homeId={userHome.homeId}
                  currentUserRole={userHome.role}
                />
              </section>
              <section id="members-section" className="scroll-mt-24">
                <MemberManagement
                  homeId={userHome.homeId}
                  currentUserRole={userHome.role}
                />
              </section>
            </div>
          ) : (
            <div className="surface-card mt-8 border-dashed border-2 border-primary/20 p-10 text-center rounded-3xl bg-gradient-to-b from-surface via-surface to-primary/5 max-w-lg mx-auto shadow-sm">
              <div className="w-16 h-16 bg-primary/10 text-primary border border-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs">
                <Home className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-text mb-2">
                Bạn chưa tham gia Ngôi nhà nào
              </h3>
              <p className="text-xs text-muted mb-6 leading-relaxed">
                Bạn cần có một Ngôi nhà để kết nối thiết bị IoT, bố trí sơ đồ Digital Twin và chia sẻ quyền điều khiển. Bạn có thể tự tạo nhà mới hoặc nhập mã mời để tham gia.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl transition-all shadow-md hover:shadow-lg cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tạo nhà mới ngay</span>
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Create Home Modal */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-home-title"
              className="surface-card w-full max-w-md rounded-3xl shadow-2xl border border-line overflow-hidden bg-gradient-to-b from-surface via-surface to-primary/5 animate-in zoom-in-95 duration-200"
            >
              {/* Header */}
              <div className="p-6 border-b border-line flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
                    <Home className="w-6 h-6" />
                  </div>
                  <div>
                    <h3
                      id="create-home-title"
                      className="text-lg font-bold text-text leading-snug"
                    >
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

              {/* Form Body */}
              <form onSubmit={handleCreateHome} className="p-6 space-y-5">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label
                      htmlFor="new-home-name"
                      className="text-xs font-bold uppercase tracking-wider text-muted"
                    >
                      Tên ngôi nhà của bạn <span className="text-primary">*</span>
                    </label>
                    <span className="text-[11px] font-mono text-muted">
                      {newHomeName.length}/50
                    </span>
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

                  {/* Quick suggestion tags */}
                  <div className="mt-2.5">
                    <p className="text-[11px] text-muted mb-1.5 font-medium">Gợi ý nhanh:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        "Nhà riêng",
                        "Căn hộ chung cư",
                        "Biệt thự sân vườn",
                        "Văn phòng làm việc",
                        "Nhà nghỉ dưỡng",
                      ].map((tag) => (
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

                {/* Owner Privileges Note */}
                <div className="rounded-2xl bg-surface/80 border border-line p-3.5 space-y-2 text-xs text-muted">
                  <div className="flex items-center gap-2 text-text font-semibold">
                    <Crown className="w-4 h-4 text-amber-400" />
                    <span>Quyền hạn tự động của bạn:</span>
                  </div>
                  <ul className="space-y-1.5 pl-6 list-disc text-[11px] leading-relaxed">
                    <li>Bạn sẽ tự động là <strong className="text-text">Chủ nhà (OWNER)</strong> với toàn quyền cao nhất.</li>
                    <li>Toàn quyền thiết kế sơ đồ mặt bằng Digital Twin 2D/3D và thêm phòng.</li>
                    <li>Tự do tạo mã mời, phê duyệt thành viên và phân quyền điều khiển.</li>
                  </ul>
                </div>

                {/* Actions */}
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
      </div>

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
                  <label className="block text-xs font-bold text-muted mb-1.5">
                    Tên ngôi nhà của bạn
                  </label>
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

        {/* First-time Onboarding Modal (Đặt tên nhà lần đầu) */}
        {isOnboardingModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="surface-card w-full max-w-md rounded-2xl shadow-2xl border border-line p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text">
                    Chào mừng bạn đến với HESTA!
                  </h3>
                  <p className="text-xs text-muted">
                    Hãy đặt tên cho ngôi nhà của bạn để dễ dàng nhận biết và quản lý.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveOnboardingName} className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-muted mb-1.5">
                    Tên ngôi nhà của bạn
                  </label>
                  <input
                    type="text"
                    value={onboardingHomeName}
                    onChange={(e) => setOnboardingHomeName(e.target.value)}
                    placeholder="VD: Nhà riêng, Căn hộ 1205, Biệt thự…"
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
