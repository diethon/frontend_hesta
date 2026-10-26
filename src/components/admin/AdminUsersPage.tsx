import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import type { UserResponse } from '../../types/auth';
import type { AdminUser, AdminUserStats, RegistrationTrendPoint } from '../../types/adminUser';
import {
  getAdminUsers,
  getAdminUserStats,
  adminUpdateUserStatus,
  adminUnlockUser,
} from '../../services/adminUserApi';
import { AppSidebar, AdminIcon, PeopleIcon } from '../ui/AppSidebar';
import { ProfileModal } from '../profile/ProfileModal';
import { UserAvatar } from '../ui/UserAvatar';
import { AdminNavbar } from './AdminNavbar';
import { AdminCreateUserModal } from './AdminCreateUserModal';
import { AdminEditUserModal } from './AdminEditUserModal';
import { AdminResetPasswordModal } from './AdminResetPasswordModal';
import { AdminUserDetailModal } from './AdminUserDetailModal';
import { notify } from '../ui/notify';
import { getErrorMessage } from '../../utils/errors';
import {
  Activity,
  Users,
  UserCheck,
  UserX,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Eye,
  Edit,
  KeyRound,
  Lock,
  Unlock,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  BarChart3,
  PieChart,
  Shield,
  Mail,
  Copy,
  Check,
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

  // Hover state for registration chart
  const [hoveredTrend, setHoveredTrend] = useState<RegistrationTrendPoint | null>(null);

  // Modals
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPassModalOpen, setIsResetPassModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  // Confirmation state
  const [confirmAction, setConfirmAction] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    onConfirm: async () => {},
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const handleRefresh = () => {
    void fetchUsers();
    void fetchStats();
  };

  const handleCopyEmail = (email: string, id: string) => {
    navigator.clipboard.writeText(email);
    setCopiedId(id);
    notify.success('Đã sao chép email!', email);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Actions
  const handleToggleStatus = (targetUser: AdminUser, newStatus: 'ACTIVE' | 'LOCKED' | 'DISABLED') => {
    const actionLabel =
      newStatus === 'ACTIVE'
        ? 'Kích hoạt lại tài khoản'
        : newStatus === 'LOCKED'
        ? 'Tạm khóa tài khoản'
        : 'Vô hiệu hóa (Ban) tài khoản';

    setConfirmAction({
      isOpen: true,
      title: actionLabel,
      message: `Bạn có chắc chắn muốn chuyển tài khoản của "${targetUser.fullName}" (${targetUser.email}) sang trạng thái ${newStatus}?`,
      confirmText: actionLabel,
      onConfirm: async () => {
        try {
          await adminUpdateUserStatus(targetUser.id, newStatus);
          notify.success(`Đã cập nhật trạng thái tài khoản thành công!`, targetUser.email);
          setConfirmAction((prev) => ({ ...prev, isOpen: false }));
          if (selectedUser?.id === targetUser.id) {
            setSelectedUser((prev) => (prev ? { ...prev, status: newStatus } : null));
          }
          void fetchUsers();
          void fetchStats();
        } catch (err) {
          notify.error(getErrorMessage(err, 'Lỗi khi cập nhật trạng thái'), '');
        }
      },
    });
  };

  const handleUnlockUser = (targetUser: AdminUser) => {
    setConfirmAction({
      isOpen: true,
      title: 'Mở khóa tài khoản',
      message: `Mở khóa và đặt lại số lần đăng nhập sai về 0 cho "${targetUser.fullName}" (${targetUser.email})?`,
      confirmText: 'Mở khóa ngay',
      onConfirm: async () => {
        try {
          await adminUnlockUser(targetUser.id);
          notify.success('Đã mở khóa tài khoản thành công!', targetUser.email);
          setConfirmAction((prev) => ({ ...prev, isOpen: false }));
          if (selectedUser?.id === targetUser.id) {
            setSelectedUser((prev) =>
              prev ? { ...prev, status: 'ACTIVE', failedLoginAttempts: 0, lockedUntil: null } : null
            );
          }
          void fetchUsers();
          void fetchStats();
        } catch (err) {
          notify.error(getErrorMessage(err, 'Lỗi khi mở khóa tài khoản'), '');
        }
      },
    });
  };

  const maxTrendCount = Math.max(
    ...(stats?.registrationTrend?.map((t) => t.count) || [1]),
    1
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-text relative overflow-x-hidden">
      {/* Sidebar: NO "Nhà của tôi" */}
      <AppSidebar
        activeItem="users"
        contextLabel="Quản trị nền tảng"
        showSystemSummary={false}
        items={[
          { id: 'admin', label: 'Quản lý thiết bị & QR', icon: <AdminIcon />, onClick: () => navigate('/admin') },
          { id: 'users', label: 'Quản lý người dùng', icon: <PeopleIcon />, onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
          { id: 'diagnostics', label: 'Chẩn đoán hạ tầng IoT', icon: <Activity className="w-5 h-5 text-primary" />, onClick: () => navigate('/admin/diagnostics') },
        ]}
      />

      <div className="lg:pl-64">
        {/* Reusable Top Navbar */}
        <AdminNavbar
          title="Quản Trị Người Dùng Nền Tảng"
          subtitle="Quản lý định danh tài khoản, phân quyền bảo mật & trạng thái truy cập"
          icon={<Users className="w-6 h-6 text-primary" />}
          showBackButton={true}
          user={user}
          onLogout={onLogout}
          onOpenProfile={() => setIsProfileModalOpen(true)}
        />

        {/* Main Content Area */}
        <main id="main-content" className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
          {/* Welcome Banner */}
          <div className="surface-card relative overflow-hidden p-6 lg:p-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary mb-2">
                <Users className="w-3.5 h-3.5" />
                Hệ thống Quản Trị Người Dùng HESTA
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-text mb-1">
                Quản Lý Toàn Bộ Tài Khoản Người Dùng
              </h2>
              <p className="text-xs sm:text-sm text-muted max-w-2xl leading-relaxed">
                Theo dõi định danh, cấp phát vai trò, kiểm soát tài khoản khóa tạm thời do nhập sai mật khẩu và đảm bảo quyền riêng tư của khách hàng.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="shrink-0 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-soft hover:bg-primary-hover transition-all cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              <span>Thêm Người Dùng Mới</span>
            </button>
          </div>

          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* Card 1: Total Users */}
            <div className="surface-card group p-5 rounded-2xl transition hover:-translate-y-0.5 hover:border-primary border border-line">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  Tất cả
                </span>
              </div>
              <h3 className="text-2xl font-bold text-text mb-0.5">
                {statsLoading ? '...' : stats?.totalUsers ?? totalElements}
              </h3>
              <p className="text-xs text-muted">Tổng số người dùng</p>
            </div>

            {/* Card 2: Active Users */}
            <div className="surface-card group p-5 rounded-2xl transition hover:-translate-y-0.5 hover:border-emerald-500 border border-line">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <UserCheck className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
                  {stats && stats.totalUsers > 0
                    ? `${Math.round((stats.activeUsers / stats.totalUsers) * 100)}%`
                    : '100%'}
                </span>
              </div>
              <h3 className="text-2xl font-bold text-emerald-600 mb-0.5">
                {statsLoading ? '...' : stats?.activeUsers ?? 0}
              </h3>
              <p className="text-xs text-muted">Tài khoản đang hoạt động</p>
            </div>

            {/* Card 3: Locked / Disabled Users */}
            <div className="surface-card group p-5 rounded-2xl transition hover:-translate-y-0.5 hover:border-amber-500 border border-line">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Lock className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">
                  Cần lưu ý
                </span>
              </div>
              <h3 className="text-2xl font-bold text-amber-600 mb-0.5">
                {statsLoading ? '...' : (stats?.lockedUsers ?? 0) + (stats?.disabledUsers ?? 0)}
              </h3>
              <p className="text-xs text-muted">
                {stats?.lockedUsers ?? 0} tạm khóa • {stats?.disabledUsers ?? 0} vô hiệu
              </p>
            </div>

            {/* Card 4: Platform Admins */}
            <div className="surface-card group p-5 rounded-2xl transition hover:-translate-y-0.5 hover:border-indigo-500 border border-line">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-indigo-500/10 text-indigo-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600">
                  Governance
                </span>
              </div>
              <h3 className="text-2xl font-bold text-indigo-600 mb-0.5">
                {statsLoading ? '...' : stats?.adminUsers ?? 1}
              </h3>
              <p className="text-xs text-muted">Quản trị viên nền tảng</p>
            </div>
          </div>

          {/* Interactive Visual Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart 1: Registration Trend (2 cols) */}
            <div className="lg:col-span-2 surface-card p-5 sm:p-6 rounded-2xl space-y-4 border border-line shadow-soft">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-line pb-4">
                <div>
                  <h3 className="text-base font-bold text-text flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Tăng Trưởng Đăng Ký Người Dùng Mới (6 Tháng Gần Nhất)
                  </h3>
                  <p className="text-xs text-muted">Số lượng tài khoản mới tạo theo từng tháng</p>
                </div>

                {hoveredTrend ? (
                  <div className="text-xs px-3 py-1.5 rounded-lg bg-surface border border-line text-text flex items-center gap-2 shadow-xs">
                    <span>Tháng: <b>{hoveredTrend.label}</b></span>
                    <span>Tài khoản mới: <b className="text-primary">{hoveredTrend.count} người</b></span>
                  </div>
                ) : (
                  <div className="text-xs text-muted flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Dữ liệu thời gian thực</span>
                  </div>
                )}
              </div>

              {/* Bar chart */}
              <div className="h-48 w-full pt-4 flex items-end gap-3 sm:gap-6">
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
                          className={`w-full max-w-[40px] h-1.5 rounded-full transition-all duration-200 ${
                            isHovered ? 'bg-primary h-2' : 'bg-line/70'
                          }`}
                        />
                      ) : (
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full max-w-[40px] rounded-t-lg transition-all duration-200 ${
                            isHovered
                              ? 'bg-primary shadow-lg shadow-primary/30'
                              : 'bg-gradient-to-t from-primary/70 to-primary hover:from-primary hover:to-primary-hover'
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
            <div className="surface-card p-5 sm:p-6 rounded-2xl space-y-4 border border-line shadow-soft flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-text flex items-center gap-2 border-b border-line pb-4">
                  <PieChart className="w-5 h-5 text-amber-500" />
                  Cơ Cấu Tài Khoản &amp; Bảo Mật
                </h3>
                <p className="text-xs text-muted mt-2 mb-4">
                  Phân bố trạng thái và nguồn đăng nhập xác thực
                </p>

                {/* Progress 1: Status distribution */}
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-muted">Trạng thái Hoạt động</span>
                      <span className="text-emerald-600 font-bold">
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

                  {/* Progress 2: Auth Provider */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-muted">Đăng nhập Google OAuth</span>
                      <span className="text-blue-600 font-bold">
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
                        className="bg-blue-500 h-full rounded-full"
                      />
                    </div>
                  </div>

                  {/* Progress 3: Admins */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-muted">Quản trị viên nền tảng</span>
                      <span className="text-indigo-600 font-bold">
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
                        className="bg-indigo-500 h-full rounded-full"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-line text-[11px] text-muted flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-500" />
                <span>Tiêu chuẩn bảo vệ dữ liệu khách hàng HESTA</span>
              </div>
            </div>
          </div>

          {/* Search, Filter & Actions Toolbar */}
          <div className="surface-card p-4 sm:p-5 rounded-2xl border border-line shadow-soft space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1 max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  placeholder="Tìm kiếm theo họ tên, email, SĐT..."
                  className="w-full rounded-xl border border-line bg-sidebar py-2.5 pl-10 pr-4 text-xs sm:text-sm text-text placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Filters & Refresh */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Role filter */}
                <div className="flex items-center gap-1.5 text-xs">
                  <Filter className="w-3.5 h-3.5 text-muted hidden sm:inline" />
                  <select
                    value={roleFilter}
                    onChange={(e) => {
                      setRoleFilter(e.target.value);
                      setPage(0);
                    }}
                    className="rounded-xl border border-line bg-sidebar px-3 py-2 text-xs font-semibold text-text focus:outline-none focus:border-primary"
                  >
                    <option value="ALL">Mọi vai trò</option>
                    <option value="USER">Người dùng (USER)</option>
                    <option value="ADMIN">Quản trị viên (ADMIN)</option>
                  </select>
                </div>

                {/* Status filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(0);
                  }}
                  className="rounded-xl border border-line bg-sidebar px-3 py-2 text-xs font-semibold text-text focus:outline-none focus:border-primary"
                >
                  <option value="ALL">Mọi trạng thái</option>
                  <option value="ACTIVE">Hoạt động (ACTIVE)</option>
                  <option value="LOCKED">Bị tạm khóa (LOCKED)</option>
                  <option value="DISABLED">Vô hiệu hóa (DISABLED)</option>
                </select>

                {/* Provider filter */}
                <select
                  value={providerFilter}
                  onChange={(e) => {
                    setProviderFilter(e.target.value);
                    setPage(0);
                  }}
                  className="rounded-xl border border-line bg-sidebar px-3 py-2 text-xs font-semibold text-text focus:outline-none focus:border-primary"
                >
                  <option value="ALL">Mọi nguồn đăng nhập</option>
                  <option value="LOCAL">Email/Mật khẩu (LOCAL)</option>
                  <option value="GOOGLE">Google OAuth</option>
                </select>

                {/* Refresh button */}
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="inline-flex items-center justify-center p-2.5 rounded-xl border border-line bg-sidebar hover:bg-sidebar-hover text-muted hover:text-text transition-colors"
                  title="Làm mới dữ liệu"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* User Table Card */}
          <div className="surface-card rounded-2xl border border-line shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-line bg-sidebar/50 text-[11px] font-bold uppercase tracking-wider text-muted">
                    <th className="py-3.5 px-4 sm:px-6">Người dùng</th>
                    <th className="py-3.5 px-4">Thông tin liên hệ</th>
                    <th className="py-3.5 px-3">Vai trò</th>
                    <th className="py-3.5 px-3">Nguồn</th>
                    <th className="py-3.5 px-3">Trạng thái</th>
                    <th className="py-3.5 px-4">An ninh &amp; Lần đăng nhập sai</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-xs sm:text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted">
                        <div className="inline-flex items-center gap-2 text-sm font-semibold">
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
                          <p className="text-sm font-bold text-text">Không tìm thấy người dùng phù hợp</p>
                          <p className="text-xs text-muted">Hãy thử thay đổi từ khóa tìm kiếm hoặc bộ lọc.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    users.map((item) => (
                      <tr key={item.id} className="hover:bg-sidebar/40 transition-colors">
                        {/* User Identity */}
                        <td className="py-3.5 px-4 sm:px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-[38px] h-[38px] rounded-full overflow-hidden shrink-0 border border-line bg-sidebar flex items-center justify-center">
                              <UserAvatar
                                src={item.avatarUrl}
                                name={item.fullName}
                                size={38}
                                fallbackClassName="text-xs font-bold text-white bg-primary"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-text truncate">{item.fullName}</p>
                              <p className="text-[11px] text-muted font-mono truncate">
                                {new Date(item.createdAt).toLocaleDateString('vi-VN')}
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
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-muted hover:text-text transition shrink-0"
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
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                              item.platformRole === 'ADMIN'
                                ? 'border-amber-500/30 bg-amber-500/10 text-amber-600'
                                : 'border-info/30 bg-info-soft text-primary-hover'
                            }`}
                          >
                            {item.platformRole === 'ADMIN' ? (
                              <Shield className="w-3 h-3" />
                            ) : null}
                            {item.platformRole}
                          </span>
                        </td>

                        {/* Provider */}
                        <td className="py-3.5 px-3">
                          <span className="text-xs font-semibold text-muted">
                            {item.provider === 'GOOGLE' ? 'Google OAuth' : 'Local'}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3">
                          {item.status === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Hoạt động
                            </span>
                          ) : item.status === 'LOCKED' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                              <Lock className="w-3 h-3" />
                              Tạm khóa
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                              <UserX className="w-3 h-3" />
                              Vô hiệu
                            </span>
                          )}
                        </td>

                        {/* Security State */}
                        <td className="py-3.5 px-4 text-xs">
                          {item.failedLoginAttempts > 0 ? (
                            <span className="font-bold text-amber-600">
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
                              className="p-1.5 rounded-lg border border-line bg-surface hover:bg-sidebar text-muted hover:text-text transition-colors"
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
                              className="p-1.5 rounded-lg border border-line bg-surface hover:bg-sidebar text-muted hover:text-text transition-colors"
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
                              className="p-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 text-amber-600 transition-colors"
                              title="Đặt lại mật khẩu"
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>

                            {/* Unlock or Lock */}
                            {item.status === 'LOCKED' ? (
                              <button
                                type="button"
                                onClick={() => handleUnlockUser(item)}
                                className="p-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white shadow-soft transition-colors"
                                title="Mở khóa tài khoản ngay"
                              >
                                <Unlock className="w-4 h-4" />
                              </button>
                            ) : item.status === 'ACTIVE' ? (
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(item, 'LOCKED')}
                                className="p-1.5 rounded-lg border border-amber-500/20 bg-surface hover:bg-amber-500/10 text-amber-600 transition-colors"
                                title="Tạm khóa tài khoản"
                              >
                                <Lock className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(item, 'ACTIVE')}
                                className="p-1.5 rounded-lg border border-emerald-500/20 bg-surface hover:bg-emerald-500/10 text-emerald-600 transition-colors"
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-t border-line bg-sidebar/30">
              <div className="text-xs text-muted">
                Hiển thị <span className="font-bold text-text">{users.length}</span> trên tổng số{' '}
                <span className="font-bold text-text">{totalElements}</span> người dùng
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={size}
                  onChange={(e) => {
                    setSize(Number(e.target.value));
                    setPage(0);
                  }}
                  className="rounded-xl border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-text focus:outline-none"
                >
                  <option value={10}>10 / trang</option>
                  <option value={20}>20 / trang</option>
                  <option value={50}>50 / trang</option>
                </select>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(p - 1, 0))}
                    className="p-1.5 rounded-lg border border-line bg-surface text-muted hover:text-text disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs px-2 font-bold text-text">
                    Trang {totalPages === 0 ? 0 : page + 1} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page + 1 >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="p-1.5 rounded-lg border border-line bg-surface text-muted hover:text-text disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Confirmation Modal */}
      {confirmAction.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="surface-card w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-float">
            <h3 className="text-base font-bold text-text mb-2">{confirmAction.title}</h3>
            <p className="text-xs text-muted mb-5 leading-relaxed">{confirmAction.message}</p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmAction((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl border border-line bg-sidebar hover:bg-sidebar-hover text-xs font-semibold text-muted hover:text-text transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={confirmAction.onConfirm}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-soft transition"
              >
                {confirmAction.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
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
