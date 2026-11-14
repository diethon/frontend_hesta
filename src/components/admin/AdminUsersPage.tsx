import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import type { UserResponse } from '../../types/auth';
import type { AdminUser, AdminUserStats, RegistrationTrendPoint } from '../../types/adminUser';
import {
  getAdminUsers,
  getAdminUserStats,
  adminUpdateUserStatus,
  adminUnlockUser,
} from '../../services/adminUserApi';
import { DashboardNavRail } from '../home/DashboardNavRail';
import { DashboardBottomNav } from '../home/DashboardBottomNav';
import { NotificationBell } from '../notification/NotificationBell';
import { ProfileModal } from '../profile/ProfileModal';
import { UserAvatar } from '../ui/UserAvatar';
import { ConfirmModal } from '../ui/ConfirmModal';
import { AdminAvatarMenu } from './AdminAvatarMenu';
import { AdminCreateUserModal } from './AdminCreateUserModal';
import { AdminEditUserModal } from './AdminEditUserModal';
import { AdminResetPasswordModal } from './AdminResetPasswordModal';
import { AdminUserDetailModal } from './AdminUserDetailModal';
import {
  ROLE_OPTIONS,
  STATUS_OPTIONS,
  PROVIDER_OPTIONS,
  PAGE_SIZE_OPTIONS,
  formatDateTimeVi,
} from './adminUsersHelpers';
import { notify } from '../ui/notify';
import { getErrorMessage } from '../../utils/errors';
import {
  Search,
  RefreshCw,
  Plus,
  Eye,
  Edit,
  KeyRound,
  Lock,
  Unlock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  BarChart3,
  PieChart,
  Shield,
  Mail,
  Copy,
  Check,
  UserX,
  UserCheck,
  Users,
  X,
} from 'lucide-react';

interface AdminUsersPageProps {
  user: UserResponse;
  onLogout: () => void;
  onProfileUpdate: (user: UserResponse) => void;
}

export const AdminUsersPage: React.FC<AdminUsersPageProps> = ({
  user,
  onLogout,
  onProfileUpdate,
}) => {
  const navigate = useNavigate();

  // State: List & Filters
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminUserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [providerFilter, setProviderFilter] = useState('ALL');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  // Dropdown states
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [providerDropdownOpen, setProviderDropdownOpen] = useState(false);
  const [sizeDropdownOpen, setSizeDropdownOpen] = useState(false);

  const filterToolbarRef = useRef<HTMLDivElement>(null);
  const sizeDropdownRef = useRef<HTMLDivElement>(null);

  // Hover state for registration chart
  const [hoveredTrend, setHoveredTrend] = useState<RegistrationTrendPoint | null>(null);

  // Modals
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPassModalOpen, setIsResetPassModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  // Confirm Modal state
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText: string;
    variant: 'danger' | 'warning' | 'primary';
    loading: boolean;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    description: '',
    confirmText: 'Xác nhận',
    variant: 'primary',
    loading: false,
    onConfirm: async () => {},
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (filterToolbarRef.current && !filterToolbarRef.current.contains(target)) {
        setRoleDropdownOpen(false);
        setStatusDropdownOpen(false);
        setProviderDropdownOpen(false);
      }
      if (sizeDropdownRef.current && !sizeDropdownRef.current.contains(target)) {
        setSizeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getAdminUsers({
        search: search.trim() || undefined,
        role: roleFilter,
        status: statusFilter,
        provider: providerFilter,
        page,
        size,
        sortBy: 'createdAt',
        direction: 'desc',
      });
      setUsers(res.content);
      setTotalPages(res.totalPages);
      setTotalElements(res.totalElements);
    } catch (err) {
      notify.error(getErrorMessage(err, 'Không thể tải danh sách người dùng'), '');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter, providerFilter, page, size]);

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await getAdminUserStats();
      setStats(res);
    } catch (err) {
      console.error('Failed to fetch user stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleRefresh = () => {
    void fetchUsers();
    void fetchStats();
  };

  const handleCopyEmail = (email: string, id: string) => {
    void navigator.clipboard.writeText(email);
    setCopiedId(id);
    notify.success('Đã sao chép email', email);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Actions
  const handleToggleStatus = (targetUser: AdminUser, newStatus: 'ACTIVE' | 'LOCKED' | 'DISABLED') => {
    const actionLabel =
      newStatus === 'ACTIVE'
        ? 'Kích hoạt lại tài khoản'
        : newStatus === 'LOCKED'
        ? 'Tạm khóa tài khoản'
        : 'Vô hiệu hóa tài khoản';

    const variant: 'primary' | 'warning' | 'danger' =
      newStatus === 'ACTIVE' ? 'primary' : newStatus === 'LOCKED' ? 'warning' : 'danger';

    setConfirmModalState({
      isOpen: true,
      title: actionLabel,
      description: `Bạn có chắc chắn muốn chuyển tài khoản của "${targetUser.fullName}" (${targetUser.email}) sang trạng thái ${newStatus}?`,
      confirmText: actionLabel,
      variant,
      loading: false,
      onConfirm: async () => {
        try {
          setConfirmModalState((prev) => ({ ...prev, loading: true }));
          await adminUpdateUserStatus(targetUser.id, newStatus);
          notify.success(`Đã cập nhật trạng thái tài khoản thành công`, targetUser.email);
          setConfirmModalState((prev) => ({ ...prev, isOpen: false, loading: false }));
          if (selectedUser?.id === targetUser.id) {
            setSelectedUser((prev) => (prev ? { ...prev, status: newStatus } : null));
          }
          void fetchUsers();
          void fetchStats();
        } catch (err) {
          setConfirmModalState((prev) => ({ ...prev, loading: false }));
          notify.error(getErrorMessage(err, 'Lỗi khi cập nhật trạng thái'), '');
        }
      },
    });
  };

  const handleUnlockUser = (targetUser: AdminUser) => {
    setConfirmModalState({
      isOpen: true,
      title: 'Mở khóa tài khoản',
      description: `Mở khóa và đặt lại số lần đăng nhập sai về 0 cho "${targetUser.fullName}" (${targetUser.email})?`,
      confirmText: 'Mở khóa ngay',
      variant: 'primary',
      loading: false,
      onConfirm: async () => {
        try {
          setConfirmModalState((prev) => ({ ...prev, loading: true }));
          await adminUnlockUser(targetUser.id);
          notify.success('Đã mở khóa tài khoản thành công', targetUser.email);
          setConfirmModalState((prev) => ({ ...prev, isOpen: false, loading: false }));
          if (selectedUser?.id === targetUser.id) {
            setSelectedUser((prev) =>
              prev ? { ...prev, status: 'ACTIVE', failedLoginAttempts: 0, lockedUntil: null } : null
            );
          }
          void fetchUsers();
          void fetchStats();
        } catch (err) {
          setConfirmModalState((prev) => ({ ...prev, loading: false }));
          notify.error(getErrorMessage(err, 'Lỗi khi mở khóa tài khoản'), '');
        }
      },
    });
  };

  const maxTrendCount = Math.max(
    ...(stats?.registrationTrend?.map((t) => t.count) || [1]),
    1
  );

  const currentRoleLabel =
    ROLE_OPTIONS.find((opt) => opt.value === roleFilter)?.label || 'Mọi vai trò';
  const currentStatusLabel =
    STATUS_OPTIONS.find((opt) => opt.value === statusFilter)?.label || 'Mọi trạng thái';
  const currentProviderLabel =
    PROVIDER_OPTIONS.find((opt) => opt.value === providerFilter)?.label || 'Mọi nguồn đăng nhập';

  // Navigation items for Admin shell
  const adminNavRailItems = [
    {
      id: 'admin',
      icon: 'grid' as const,
      label: 'Quản lý thiết bị & QR',
      onClick: () => navigate('/admin'),
      active: false,
    },
    {
      id: 'users',
      icon: 'users' as const,
      label: 'Quản lý người dùng',
      onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
      active: true,
    },
    {
      id: 'diagnostics',
      icon: 'activity' as const,
      label: 'Chẩn đoán hạ tầng IoT',
      onClick: () => navigate('/admin/diagnostics'),
      active: false,
    },
  ];

  const adminBottomNavItems = [
    {
      id: 'admin',
      icon: 'grid' as const,
      label: 'Thiết bị & QR',
      onClick: () => navigate('/admin'),
      active: false,
    },
    {
      id: 'users',
      icon: 'users' as const,
      label: 'Người dùng',
      onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
      active: true,
    },
    {
      id: 'diagnostics',
      icon: 'activity' as const,
      label: 'Hạ tầng',
      onClick: () => navigate('/admin/diagnostics'),
      active: false,
    },
  ];

  return (
    <div className="app-shell admin-users-page min-h-screen bg-app text-text relative">
      {/* Unified HESTA ambient background meshes */}
      <div className="mesh mesh-one pointer-events-none" />
      <div className="mesh mesh-two pointer-events-none" />
      <div className="mesh mesh-three pointer-events-none" />

      {/* Shared NavRail with 3 admin destinations */}
      <DashboardNavRail
        activeItem="users"
        items={adminNavRailItems}
        user={user}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        hideSettings
        brandTitle="HESTA Admin Center"
      />

      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 pb-24 lg:pb-12">
        <span className="sr-only">HESTA Admin Center</span>

        {/* TopBar */}
        <header className="flex items-center justify-between gap-4 py-2 border-b border-line/60">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text truncate">
              Quản lý người dùng
            </h1>
            <p className="text-xs text-muted mt-0.5 truncate">
              {stats?.totalUsers ?? totalElements} tài khoản · {stats?.activeUsers ?? 0} đang hoạt động
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-line bg-surface/80 text-muted">
              Quản trị viên
            </span>

            <NotificationBell />

            <AdminAvatarMenu
              user={user}
              onOpenProfile={() => setIsProfileModalOpen(true)}
              onLogout={onLogout}
            />
          </div>
        </header>

        {/* Neutral single-line explanation */}
        <p className="text-xs text-muted leading-relaxed">
          Theo dõi định danh, cấp phát vai trò, kiểm soát tài khoản và đảm bảo an toàn truy cập nền tảng HESTA.
        </p>

        {/* Action Row */}
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
          <div className="flex-1 flex flex-col md:flex-row items-stretch md:items-center gap-2.5" ref={filterToolbarRef}>
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Tìm kiếm theo họ tên, email, số điện thoại..."
                className="w-full min-h-[44px] rounded-2xl border border-line bg-surface/90 pl-10 pr-9 py-2.5 text-xs sm:text-sm text-text placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setPage(0);
                  }}
                  aria-label="Xóa từ khóa tìm kiếm"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted hover:text-text cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Custom Role Picker Dropdown */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  setRoleDropdownOpen((prev) => !prev);
                  setStatusDropdownOpen(false);
                  setProviderDropdownOpen(false);
                }}
                aria-expanded={roleDropdownOpen}
                aria-label="Lọc theo vai trò"
                className="w-full md:w-auto min-h-[44px] px-3.5 py-2.5 rounded-2xl border border-line bg-surface/90 hover:bg-surface-hover text-xs sm:text-sm font-medium text-text flex items-center justify-between gap-2.5 cursor-pointer focus:border-primary focus:outline-none transition-colors"
              >
                <span className="truncate max-w-[150px]">{currentRoleLabel}</span>
                <ChevronDown className={`w-4 h-4 text-muted transition-transform ${roleDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {roleDropdownOpen && (
                <div
                  role="listbox"
                  className="custom-scrollbar absolute left-0 top-full mt-1.5 z-40 w-56 rounded-2xl border border-line bg-surface p-1 shadow-float animate-in fade-in zoom-in-95 duration-150"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={roleFilter === opt.value}
                      onClick={() => {
                        setRoleFilter(opt.value);
                        setPage(0);
                        setRoleDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                        roleFilter === opt.value
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-text hover:bg-surface-hover'
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {roleFilter === opt.value && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Status Picker Dropdown */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  setStatusDropdownOpen((prev) => !prev);
                  setRoleDropdownOpen(false);
                  setProviderDropdownOpen(false);
                }}
                aria-expanded={statusDropdownOpen}
                aria-label="Lọc theo trạng thái"
                className="w-full md:w-auto min-h-[44px] px-3.5 py-2.5 rounded-2xl border border-line bg-surface/90 hover:bg-surface-hover text-xs sm:text-sm font-medium text-text flex items-center justify-between gap-2.5 cursor-pointer focus:border-primary focus:outline-none transition-colors"
              >
                <span className="truncate max-w-[150px]">{currentStatusLabel}</span>
                <ChevronDown className={`w-4 h-4 text-muted transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {statusDropdownOpen && (
                <div
                  role="listbox"
                  className="custom-scrollbar absolute left-0 top-full mt-1.5 z-40 w-56 rounded-2xl border border-line bg-surface p-1 shadow-float animate-in fade-in zoom-in-95 duration-150"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={statusFilter === opt.value}
                      onClick={() => {
                        setStatusFilter(opt.value);
                        setPage(0);
                        setStatusDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                        statusFilter === opt.value
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-text hover:bg-surface-hover'
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {statusFilter === opt.value && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Provider Picker Dropdown */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  setProviderDropdownOpen((prev) => !prev);
                  setRoleDropdownOpen(false);
                  setStatusDropdownOpen(false);
                }}
                aria-expanded={providerDropdownOpen}
                aria-label="Lọc theo nguồn đăng nhập"
                className="w-full md:w-auto min-h-[44px] px-3.5 py-2.5 rounded-2xl border border-line bg-surface/90 hover:bg-surface-hover text-xs sm:text-sm font-medium text-text flex items-center justify-between gap-2.5 cursor-pointer focus:border-primary focus:outline-none transition-colors"
              >
                <span className="truncate max-w-[150px]">{currentProviderLabel}</span>
                <ChevronDown className={`w-4 h-4 text-muted transition-transform ${providerDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {providerDropdownOpen && (
                <div
                  role="listbox"
                  className="custom-scrollbar absolute left-0 top-full mt-1.5 z-40 w-56 rounded-2xl border border-line bg-surface p-1 shadow-float animate-in fade-in zoom-in-95 duration-150"
                >
                  {PROVIDER_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={providerFilter === opt.value}
                      onClick={() => {
                        setProviderFilter(opt.value);
                        setPage(0);
                        setProviderDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                        providerFilter === opt.value
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-text hover:bg-surface-hover'
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {providerFilter === opt.value && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons: Làm mới & Thêm người dùng */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="min-h-[44px] px-4 rounded-2xl border border-line bg-surface/90 hover:bg-surface-hover text-xs sm:text-sm font-semibold text-text shadow-2xs hover:border-primary/50 transition-colors inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
              title="Làm mới danh sách"
            >
              <RefreshCw className={`w-4 h-4 text-muted ${loading ? 'animate-spin text-primary' : ''}`} />
              <span className="hidden sm:inline">Làm mới</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="min-h-[44px] px-5 rounded-full bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm người dùng</span>
            </button>
          </div>
        </div>

        {/* Summary Row: 4 Neutral StatChips */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl border border-line bg-surface/80 text-xs sm:text-sm shadow-2xs">
            <Users className="w-3.5 h-3.5 text-muted" />
            <span className="text-muted font-normal">Tổng số người dùng:</span>
            <span className="font-semibold text-text">{statsLoading ? '...' : stats?.totalUsers ?? totalElements}</span>
          </div>
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl border border-line bg-surface/80 text-xs sm:text-sm shadow-2xs">
            <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-muted font-normal">Đang hoạt động:</span>
            <span className="font-semibold text-text">{statsLoading ? '...' : stats?.activeUsers ?? 0}</span>
          </div>
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl border border-line bg-surface/80 text-xs sm:text-sm shadow-2xs">
            <Lock className="w-3.5 h-3.5 text-muted" />
            <span className="text-muted font-normal">Cần lưu ý:</span>
            <span className="font-semibold text-text">
              {statsLoading ? '...' : (stats?.lockedUsers ?? 0) + (stats?.disabledUsers ?? 0)}
            </span>
          </div>
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl border border-line bg-surface/80 text-xs sm:text-sm shadow-2xs">
            <Shield className="w-3.5 h-3.5 text-primary" />
            <span className="text-muted font-normal">Quản trị viên:</span>
            <span className="font-semibold text-text">{statsLoading ? '...' : stats?.adminUsers ?? 1}</span>
          </div>
        </div>

        {/* Interactive Visual Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Chart 1: Registration Trend (2 cols) */}
          <div className="lg:col-span-2 rounded-3xl p-5 sm:p-6 space-y-4 border border-line bg-surface shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-line/60 pb-4">
              <div>
                <h3 className="text-sm font-bold text-text flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <span>Tăng trưởng đăng ký người dùng mới (6 tháng gần nhất)</span>
                </h3>
                <p className="text-xs text-muted mt-0.5">Số lượng tài khoản mới tạo theo từng tháng</p>
              </div>

              {hoveredTrend ? (
                <div className="text-xs px-3 py-1.5 rounded-xl bg-sidebar/80 border border-line text-text flex items-center gap-2">
                  <span>Tháng: <b>{hoveredTrend.label}</b></span>
                  <span>Mới: <b className="text-primary">{hoveredTrend.count} người</b></span>
                </div>
              ) : (
                <div className="text-xs text-muted flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Dữ liệu thời gian thực</span>
                </div>
              )}
            </div>

            {/* Bar chart */}
            <div className="h-44 w-full pt-4 flex items-end gap-3 sm:gap-6">
              {(stats?.registrationTrend || []).map((point, idx) => {
                const isZero = point.count === 0;
                const heightPercent = isZero ? 0 : Math.max((point.count / maxTrendCount) * 100, 10);
                const isHovered = hoveredTrend?.label === point.label;
                return (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
                    onMouseEnter={() => setHoveredTrend(point)}
                    onMouseLeave={() => setHoveredTrend(null)}
                  >
                    {isZero ? (
                      <div
                        className={`w-full max-w-[36px] h-1.5 rounded-full transition-all duration-200 ${
                          isHovered ? 'bg-primary h-2' : 'bg-line/70'
                        }`}
                      />
                    ) : (
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full max-w-[36px] rounded-t-xl transition-all duration-200 ${
                          isHovered
                            ? 'bg-primary shadow-md shadow-primary/30'
                            : 'bg-primary/80 hover:bg-primary'
                        }`}
                      />
                    )}
                    <span className="text-[11px] text-muted mt-2 font-mono text-center">
                      {point.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chart 2: User Segments & Auth Structure (1 col) */}
          <div className="rounded-3xl p-5 sm:p-6 space-y-4 border border-line bg-surface shadow-xs flex flex-col justify-between">
            <div>
              <div className="border-b border-line/60 pb-4">
                <h3 className="text-sm font-bold text-text flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-primary" />
                  <span>Cơ cấu tài khoản &amp; bảo mật</span>
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Phân bố trạng thái và nguồn đăng nhập xác thực
                </p>
              </div>

              {/* Progress bars */}
              <div className="space-y-4 mt-4">
                <div>
                  <div className="flex justify-between text-xs font-medium mb-1.5">
                    <span className="text-muted">Trạng thái hoạt động</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      {stats?.activeUsers ?? 0} / {stats?.totalUsers ?? 0}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-sidebar overflow-hidden flex">
                    <div
                      style={{
                        width: `${
                          stats && stats.totalUsers > 0
                            ? (stats.activeUsers / stats.totalUsers) * 100
                            : 100
                        }%`,
                      }}
                      className="bg-emerald-500 h-full rounded-full"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium mb-1.5">
                    <span className="text-muted">Đăng nhập Google OAuth</span>
                    <span className="text-primary font-semibold">
                      {stats?.googleUsers ?? 0} / {stats?.totalUsers ?? 0}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-sidebar overflow-hidden flex">
                    <div
                      style={{
                        width: `${
                          stats && stats.totalUsers > 0
                            ? (stats.googleUsers / stats.totalUsers) * 100
                            : 0
                        }%`,
                      }}
                      className="bg-primary h-full rounded-full"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium mb-1.5">
                    <span className="text-muted">Quản trị viên nền tảng</span>
                    <span className="text-text font-semibold">
                      {stats?.adminUsers ?? 0} admin
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-sidebar overflow-hidden flex">
                    <div
                      style={{
                        width: `${
                          stats && stats.totalUsers > 0
                            ? Math.max((stats.adminUsers / stats.totalUsers) * 100, 5)
                            : 5
                        }%`,
                      }}
                      className="bg-primary/50 h-full rounded-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-line/60 text-xs text-muted flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-primary" />
              <span>Tiêu chuẩn bảo vệ dữ liệu khách hàng HESTA</span>
            </div>
          </div>
        </div>

        {/* User Table Card */}
        <div className="rounded-3xl border border-line bg-surface shadow-xs overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line bg-sidebar/50 text-xs font-semibold text-muted">
                  <th className="py-3.5 px-4 sm:px-6">Người dùng</th>
                  <th className="py-3.5 px-4">Thông tin liên hệ</th>
                  <th className="py-3.5 px-3">Vai trò</th>
                  <th className="py-3.5 px-3">Nguồn</th>
                  <th className="py-3.5 px-3">Trạng thái</th>
                  <th className="py-3.5 px-4">Bảo mật &amp; đăng nhập sai</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-xs sm:text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted">
                      <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium">
                        <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                        <span>Đang tải danh sách người dùng...</span>
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <UserX className="w-8 h-8 text-muted/50" />
                        <p className="text-sm font-semibold text-text">Không tìm thấy người dùng phù hợp</p>
                        <p className="text-xs text-muted">Hãy thử thay đổi từ khóa tìm kiếm hoặc bộ lọc.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  users.map((item) => (
                    <tr key={item.id} className="hover:bg-surface-hover/60 transition-colors">
                      {/* User Identity */}
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-[38px] h-[38px] rounded-xl overflow-hidden shrink-0 border border-line bg-sidebar flex items-center justify-center">
                            <UserAvatar
                              src={item.avatarUrl}
                              name={item.fullName}
                              size={38}
                              fallbackClassName="text-xs font-bold text-white bg-primary"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-text truncate">{item.fullName}</p>
                            <p className="text-[11px] text-muted font-mono truncate">
                              {formatDateTimeVi(item.createdAt)}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="py-3.5 px-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 group">
                            <Mail className="w-3.5 h-3.5 text-muted shrink-0" />
                            <span className="font-medium text-text truncate max-w-[180px]">{item.email}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyEmail(item.email, item.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-text rounded-md hover:bg-sidebar transition-opacity shrink-0 cursor-pointer"
                              title="Sao chép email"
                            >
                              {copiedId === item.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                          {item.phoneNumber && (
                            <p className="text-[11px] text-muted mt-0.5">{item.phoneNumber}</p>
                          )}
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            item.platformRole === 'ADMIN'
                              ? 'border-primary/30 bg-primary/10 text-primary'
                              : 'border-line bg-surface text-muted'
                          }`}
                        >
                          {item.platformRole === 'ADMIN' && <Shield className="w-3 h-3 text-primary" />}
                          <span>{item.platformRole === 'ADMIN' ? 'Quản trị viên' : 'Người dùng'}</span>
                        </span>
                      </td>

                      {/* Provider */}
                      <td className="py-3.5 px-3">
                        <span className="text-xs font-medium text-muted">
                          {item.provider === 'GOOGLE' ? 'Google OAuth' : 'Mật khẩu'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3">
                        {item.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            <span>Hoạt động</span>
                          </span>
                        ) : item.status === 'LOCKED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            <Lock className="w-3 h-3 text-rose-500" />
                            <span>Tạm khóa</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            <UserX className="w-3 h-3 text-rose-500" />
                            <span>Vô hiệu</span>
                          </span>
                        )}
                      </td>

                      {/* Security State */}
                      <td className="py-3.5 px-4 text-xs">
                        {item.failedLoginAttempts > 0 ? (
                          <span className="font-semibold text-rose-500">
                            {item.failedLoginAttempts}/5 lần sai
                          </span>
                        ) : (
                          <span className="text-muted">Bình thường</span>
                        )}
                        {item.lockedUntil && (
                          <div className="text-[11px] text-rose-500 font-mono">
                            Khóa đến {new Date(item.lockedUntil).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 sm:px-6 text-right">
                        <div className="inline-flex items-center gap-1">
                          {/* View detail */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUser(item);
                              setIsDetailModalOpen(true);
                            }}
                            className="p-2 rounded-xl border border-line bg-surface hover:bg-surface-hover text-muted hover:text-text transition-colors cursor-pointer"
                            title="Xem chi tiết tài khoản"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUser(item);
                              setIsEditModalOpen(true);
                            }}
                            className="p-2 rounded-xl border border-line bg-surface hover:bg-surface-hover text-muted hover:text-text transition-colors cursor-pointer"
                            title="Chỉnh sửa thông tin"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          {/* Reset password */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUser(item);
                              setIsResetPassModalOpen(true);
                            }}
                            className="p-2 rounded-xl border border-line bg-surface hover:bg-surface-hover text-muted hover:text-primary transition-colors cursor-pointer"
                            title="Đặt lại mật khẩu"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          {/* Unlock or Lock */}
                          {item.status === 'LOCKED' ? (
                            <button
                              type="button"
                              onClick={() => handleUnlockUser(item)}
                              className="p-2 rounded-xl bg-primary hover:bg-primary-hover text-white shadow-xs transition-colors cursor-pointer"
                              title="Mở khóa tài khoản ngay"
                            >
                              <Unlock className="w-4 h-4" />
                            </button>
                          ) : item.status === 'ACTIVE' ? (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(item, 'LOCKED')}
                              className="p-2 rounded-xl border border-line bg-surface hover:bg-surface-hover text-muted hover:text-text transition-colors cursor-pointer"
                              title="Tạm khóa tài khoản"
                            >
                              <Lock className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(item, 'ACTIVE')}
                              className="p-2 rounded-xl border border-emerald-500/20 bg-surface hover:bg-emerald-500/10 text-emerald-600 transition-colors cursor-pointer"
                              title="Kích hoạt lại tài khoản"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-t border-line/60 bg-sidebar/30">
            <div className="text-xs text-muted">
              Hiển thị <span className="font-semibold text-text">{users.length}</span> trên tổng số{' '}
              <span className="font-semibold text-text">{totalElements}</span> người dùng
            </div>

            <div className="flex items-center gap-3">
              {/* Page size picker */}
              <div className="relative" ref={sizeDropdownRef}>
                <button
                  type="button"
                  onClick={() => setSizeDropdownOpen((prev) => !prev)}
                  className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-medium text-text flex items-center gap-1.5 cursor-pointer hover:bg-surface-hover"
                >
                  <span>{size} / trang</span>
                  <ChevronDown className="w-3 h-3 text-muted" />
                </button>

                {sizeDropdownOpen && (
                  <div className="absolute right-0 bottom-full mb-1 z-40 w-28 rounded-xl border border-line bg-surface p-1 shadow-float">
                    {PAGE_SIZE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setSize(opt.value);
                          setPage(0);
                          setSizeDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                          size === opt.value
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'text-text hover:bg-surface-hover'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Page buttons */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(p - 1, 0))}
                  aria-label="Trang trước"
                  className="p-1.5 rounded-xl border border-line bg-surface text-muted hover:text-text disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs px-2 font-medium text-text">
                  Trang {totalPages === 0 ? 0 : page + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Trang tiếp"
                  className="p-1.5 rounded-xl border border-line bg-surface text-muted hover:text-text disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <DashboardBottomNav activeItem="users" items={adminBottomNavItems} />

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModalState.isOpen}
        title={confirmModalState.title}
        description={confirmModalState.description}
        confirmText={confirmModalState.confirmText}
        variant={confirmModalState.variant}
        loading={confirmModalState.loading}
        onConfirm={confirmModalState.onConfirm}
        onCancel={() => setConfirmModalState((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Dialog Modals */}
      <AdminCreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          void fetchUsers();
          void fetchStats();
        }}
      />

      <AdminEditUserModal
        isOpen={isEditModalOpen}
        user={selectedUser}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedUser(null);
        }}
        onSuccess={() => {
          void fetchUsers();
          void fetchStats();
        }}
      />

      <AdminResetPasswordModal
        isOpen={isResetPassModalOpen}
        user={selectedUser}
        onClose={() => {
          setIsResetPassModalOpen(false);
          setSelectedUser(null);
        }}
        onSuccess={() => {
          void fetchUsers();
        }}
      />

      <AdminUserDetailModal
        isOpen={isDetailModalOpen}
        user={selectedUser}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedUser(null);
        }}
        onEdit={(target) => {
          setIsDetailModalOpen(false);
          setSelectedUser(target);
          setIsEditModalOpen(true);
        }}
        onResetPassword={(target) => {
          setIsDetailModalOpen(false);
          setSelectedUser(target);
          setIsResetPassModalOpen(true);
        }}
        onToggleStatus={(target, newStatus) => {
          handleToggleStatus(target, newStatus);
        }}
        onUnlock={(target) => {
          handleUnlockUser(target);
        }}
      />

      {isProfileModalOpen && (
        <ProfileModal
          isOpen
          onClose={() => setIsProfileModalOpen(false)}
          user={user}
          onProfileUpdate={onProfileUpdate}
        />
      )}
    </div>
  );
};
