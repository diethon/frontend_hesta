import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import type { UserResponse } from "../../types/auth";
import { ProfileModal } from "../profile/ProfileModal";
import { MemberManagement } from "./MemberManagement";
import { SceneManagement } from "./SceneManagement";
import { getMyHomes, createHome } from "../../services/homeApi";
import { currentHomeChanged, currentHomeCleared } from "../../store/homeSlice";
import { useAppDispatch } from "../../store/hooks";
import { getErrorMessage } from "../../utils/errors";
import {
  AdminIcon,
  AppSidebar,
  DeviceIcon,
  HomeIcon,
  PeopleIcon,
  SceneIcon, TwinIcon,
} from "../ui/AppSidebar";
import { NotificationBell } from "../notification/NotificationBell";
import { Link } from "react-router";
import { notify } from '../ui/notify';

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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [userHome, setUserHome] = useState<HomeSummary | null>(null);
  const [newHomeName, setNewHomeName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
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
          retainSelectedHome(homes || [], selectedHome),
        );
      })
      .catch((error: unknown) => {
        if (active) console.error("Failed to fetch homes", error);
      });
    return () => {
      active = false;
    };
  }, []);

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
      <AppSidebar
        activeItem="overview"
        contextLabel="Không gian sống"
        items={[
          {
            id: "overview",
            label: "Tổng quan",
            icon: <HomeIcon />,
            onClick: () => window.scrollTo({ top: 0, behavior: "smooth" }),
          },
          {
            id: "devices",
            label: "Thiết bị",
            icon: <DeviceIcon />,
            onClick: () => {
              if (userHome) navigate(`/home/${userHome.homeId}/devices`);
              else notify.info('Hãy tạo hoặc tham gia một ngôi nhà trước khi quản lý thiết bị.');
            },
          },
          {
            id: 'twin', label: 'Digital Twin', icon: <TwinIcon />, onClick: () => {
              if (userHome) navigate(`/home/${userHome.homeId}/digital-twin`);
              else notify.info('Hãy tạo hoặc tham gia một ngôi nhà trước khi mở Digital Twin.');
            },
          },
          {
            id: "scenes",
            label: "Kịch bản",
            icon: <SceneIcon />,
            onClick: () =>
              document
                .getElementById("scenes-section")
                ?.scrollIntoView({ behavior: "smooth" }),
          },
          {
            id: "members",
            label: "Thành viên",
            icon: <PeopleIcon />,
            onClick: () =>
              document
                .getElementById("members-section")
                ?.scrollIntoView({ behavior: "smooth" }),
          },
          ...(user.platformRole === "ADMIN"
            ? [
                {
                  id: "admin",
                  label: "Quản trị hệ thống",
                  icon: <AdminIcon />,
                  onClick: () => navigate("/admin"),
                },
              ]
            : []),
        ]}
      />
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

            <NotificationBell />

            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                aria-label="Mở menu tài khoản"
                aria-expanded={isDropdownOpen}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-line bg-primary shadow-soft transition-colors hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface"
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={`Ảnh đại diện của ${user.fullName}`}
                    width={40}
                    height={40}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-white font-bold text-sm">
                    {user.fullName.charAt(0).toUpperCase()}
                  </span>
                )}
              </button>

              {isDropdownOpen && (
                <div className="gentle-rise absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-line bg-white py-1 shadow-float">
                  <div className="px-4 py-2 border-b border-slate-800">
                    <p className="truncate text-sm font-medium text-text">
                      {user.fullName}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {user.email}
                    </p>
                  </div>

                  <div className="p-1">
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setIsProfileModalOpen(true);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2"
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
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      Hồ sơ & Bảo mật
                    </button>

                    <button className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2">
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

                  <div className="border-t border-slate-800 p-1">
                    <button
                      onClick={onLogout}
                      className="w-full text-left px-3 py-2 text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 rounded-lg transition-colors flex items-center gap-2"
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
                Bạn đã đăng nhập thành công vào hệ thống HESTA Smart Home
                local-first. Mã định danh duy nhất của bạn:{" "}
                <span className="font-mono text-cyan-400 text-xs">
                  {user.id}
                </span>
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
            <h3 className="text-base font-semibold text-white mb-1">Quản lý Thiết bị</h3>
            <p className="text-xs text-slate-400 leading-relaxed">Theo dõi và điều khiển các thiết bị thông minh (Đèn, Quạt, Cảm biến) trong nhà.</p>
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
              <h3 className="text-base font-semibold text-white mb-1">
                Kịch bản & Tự động hóa
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
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
              <h3 className="text-base font-semibold text-white mb-1">
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
            <div className="surface-card mt-8 border-dashed p-8 text-center">
              <div className="w-16 h-16 bg-slate-800 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  aria-hidden={true}
                  className="w-8 h-8"
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
              <h3 className="text-lg font-bold text-white mb-2">
                Bạn chưa tham gia Ngôi nhà nào
              </h3>
              <p className="text-sm text-slate-400 mb-6">
                Bạn cần có một Ngôi nhà để quản lý thiết bị và thành viên. Bạn
                có thể tự tạo mới hoặc tham gia bằng mã mời.
              </p>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-xl transition"
                >
                  + Tạo nhà mới
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Create Home Modal */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-text/30 p-4 backdrop-blur-sm">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-home-title"
              className="auth-surface w-full max-w-sm overflow-hidden overscroll-contain"
            >
              <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                <h3
                  id="create-home-title"
                  className="text-lg font-bold text-text"
                >
                  Tạo Nhà Mới
                </h3>
                <button
                  type="button"
                  aria-label="Đóng cửa sổ tạo nhà"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-lg p-1 text-icon hover:bg-sidebar-hover hover:text-text"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleCreateHome} className="p-6">
                <label
                  htmlFor="new-home-name"
                  className="block text-sm font-medium text-slate-300 mb-2"
                >
                  Tên ngôi nhà của bạn
                </label>
                <input
                  id="new-home-name"
                  type="text"
                  placeholder="VD: Nhà của tôi, Tổ ấm…"
                  value={newHomeName}
                  onChange={(e) => setNewHomeName(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none mb-6"
                  maxLength={50}
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={createLoading}
                  className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-medium transition-colors"
                >
                  {createLoading ? "Đang khởi tạo…" : "Xác nhận tạo mới"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

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
