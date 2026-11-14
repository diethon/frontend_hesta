import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import type { UserResponse } from '../../types/auth';
import type { DeviceCatalog, DeviceAdminStats } from '../../types/deviceCatalog';
import { getDeviceCatalogs, getDeviceAdminStats, deleteDeviceCatalog } from '../../services/deviceCatalogApi';
import { ProfileModal } from '../profile/ProfileModal';
import { AdminCatalogModal } from './AdminCatalogModal';
import { AdminBatchQrModal } from './AdminBatchQrModal';
import { ProductCard } from './ProductCard';
import { DashboardNavRail } from '../home/DashboardNavRail';
import { DashboardBottomNav } from '../home/DashboardBottomNav';
import { NotificationBell } from '../notification/NotificationBell';
import { UserAvatar } from '../ui/UserAvatar';
import { ConfirmModal } from '../ui/ConfirmModal';
import { notify } from '../ui/notify';
import { getErrorMessage } from '../../utils/errors';
import {
  Search,
  Plus,
  RefreshCw,
  ChevronDown,
  X,
  Layers,
  AlertCircle,
  LogOut,
  User as UserIcon,
} from 'lucide-react';

interface AdminDashboardProps {
  user: UserResponse;
  onLogout: () => void;
  onProfileUpdate: (user: UserResponse) => void;
}

const DEVICE_TYPE_OPTIONS = [
  { value: 'ALL', label: 'Tất cả loại thiết bị' },
  { value: 'LED_RGB', label: 'Đèn LED RGB' },
  { value: 'LIGHT', label: 'Công tắc / Đèn relay' },
  { value: 'SMART_PLUG', label: 'Ổ cắm đo điện' },
  { value: 'FAN', label: 'Quạt thông minh' },
  { value: 'WATER_PUMP', label: 'Máy bơm nước' },
  { value: 'GATE_MOTOR', label: 'Motor cổng tự động' },
  { value: 'AC_REMOTE', label: 'Điều khiển điều hòa' },
  { value: 'TEMP_HUMID_SENSOR', label: 'Cảm biến nhiệt ẩm' },
  { value: 'MOTION_SENSOR', label: 'Cảm biến chuyển động' },
  { value: 'SMOKE_SENSOR', label: 'Cảm biến báo khói' },
  { value: 'CAMERA_AI', label: 'Camera AI' },
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout, onProfileUpdate }) => {
  const navigate = useNavigate();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);

  // Catalog & QR states
  const [catalogs, setCatalogs] = useState<DeviceCatalog[]>([]);
  const [stats, setStats] = useState<DeviceAdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const typeDropdownRef = useRef<HTMLDivElement>(null);

  // Modals
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [editingCatalog, setEditingCatalog] = useState<DeviceCatalog | null>(null);
  const [isBatchQrModalOpen, setIsBatchQrModalOpen] = useState(false);
  const [selectedCatalogForQr, setSelectedCatalogForQr] = useState<DeviceCatalog | null>(null);
  const [deletingCatalog, setDeletingCatalog] = useState<DeviceCatalog | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target as Node)) {
        setTypeDropdownOpen(false);
      }
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setIsAvatarMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const typeParam = selectedType === 'ALL' ? undefined : selectedType;
      const [catalogsData, statsData] = await Promise.all([
        getDeviceCatalogs({ keyword: searchKeyword || undefined, deviceType: typeParam }),
        getDeviceAdminStats(),
      ]);
      setCatalogs(catalogsData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load device catalog data:', err);
      const msg = getErrorMessage(err, 'Không thể tải danh mục thiết bị');
      setError(msg);
      notify.error(msg, '');
    } finally {
      setLoading(false);
    }
  }, [searchKeyword, selectedType]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleConfirmDelete = async () => {
    if (!deletingCatalog) return;
    setDeleteLoading(true);
    try {
      await deleteDeviceCatalog(deletingCatalog.id);
      notify.success(`Đã xóa dòng sản phẩm "${deletingCatalog.name}" thành công`, '');
      setDeletingCatalog(null);
      void loadData();
    } catch (err) {
      notify.error(getErrorMessage(err, 'Không thể xóa mẫu sản phẩm'), '');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleOpenGenerateQr = (cat: DeviceCatalog) => {
    setSelectedCatalogForQr(cat);
    setIsBatchQrModalOpen(true);
  };

  const handleOpenEditCatalog = (cat: DeviceCatalog) => {
    setEditingCatalog(cat);
    setIsCatalogModalOpen(true);
  };

  const handleOpenCreateCatalog = () => {
    setEditingCatalog(null);
    setIsCatalogModalOpen(true);
  };

  const handleResetFilters = () => {
    setSearchKeyword('');
    setSelectedType('ALL');
  };

  const currentTypeLabel =
    DEVICE_TYPE_OPTIONS.find((opt) => opt.value === selectedType)?.label || 'Tất cả loại thiết bị';

  const userInitial = user?.fullName
    ? user.fullName.trim().split(' ').slice(-1)[0]?.charAt(0).toUpperCase() || 'A'
    : 'A';

  // Navigation items for Admin shell
  const adminNavRailItems = [
    {
      id: 'admin',
      icon: 'grid' as const,
      label: 'Quản lý thiết bị & QR',
      onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
      active: true,
    },
    {
      id: 'users',
      icon: 'users' as const,
      label: 'Quản lý người dùng',
      onClick: () => navigate('/admin/users'),
      active: false,
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
      onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
      active: true,
    },
    {
      id: 'users',
      icon: 'users' as const,
      label: 'Người dùng',
      onClick: () => navigate('/admin/users'),
      active: false,
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
    <div className="app-shell admin-dashboard-page min-h-screen bg-app text-text relative">
      {/* Unified HESTA glowing ambient background meshes */}
      <div className="mesh mesh-one pointer-events-none" />
      <div className="mesh mesh-two pointer-events-none" />
      <div className="mesh mesh-three pointer-events-none" />

      {/* Shared NavRail with 3 admin destinations */}
      <DashboardNavRail
        activeItem="admin"
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
              Thiết bị &amp; mã QR
            </h1>
            <p className="text-xs text-muted mt-0.5 truncate">
              {catalogs.length} dòng sản phẩm · {stats?.totalDevices ?? 0} thiết bị đã cấp
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-line bg-surface/80 text-muted">
              Quản trị viên
            </span>

            <NotificationBell />

            {/* Avatar Menu Dropdown */}
            <div className="relative" ref={avatarMenuRef}>
              <button
                type="button"
                aria-label="Tài khoản quản trị"
                aria-expanded={isAvatarMenuOpen}
                onClick={() => setIsAvatarMenuOpen((prev) => !prev)}
                className="avatar small flex items-center justify-center cursor-pointer overflow-hidden border border-line shadow-xs hover:border-primary transition-colors"
                title={user.fullName || 'Tài khoản quản trị'}
              >
                {user.avatarUrl ? (
                  <UserAvatar src={user.avatarUrl} name={user.fullName} size={36} />
                ) : (
                  <span className="font-semibold text-xs text-text">{userInitial}</span>
                )}
              </button>

              {isAvatarMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 z-40 w-52 rounded-2xl border border-line bg-surface p-1 shadow-float animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="px-3 py-2 border-b border-line mb-1">
                    <p className="text-xs font-semibold text-text truncate">{user.fullName}</p>
                    <p className="text-[11px] text-muted truncate">{user.email}</p>
                  </div>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsAvatarMenuOpen(false);
                      setIsProfileModalOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-text hover:bg-surface-hover rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-muted" />
                    <span>Hồ sơ &amp; bảo mật</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsAvatarMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-500" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Neutral single-line explanation */}
        <p className="text-xs text-muted leading-relaxed">
          Định nghĩa mẫu thiết bị phần cứng, cấp phát tem QR liên tiếp và theo dõi trạng thái thiết bị xuất xưởng.
        </p>

        {/* Action Row */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Tìm theo tên mẫu hoặc mã model, ví dụ HESTA-RGB-01..."
                className="w-full min-h-[44px] rounded-2xl border border-line bg-surface/90 pl-10 pr-9 py-2.5 text-xs sm:text-sm text-text placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
              {searchKeyword && (
                <button
                  type="button"
                  onClick={() => setSearchKeyword('')}
                  aria-label="Xóa từ khóa tìm kiếm"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted hover:text-text cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Custom Device Type Picker Dropdown */}
            <div className="relative shrink-0" ref={typeDropdownRef}>
              <button
                type="button"
                onClick={() => setTypeDropdownOpen((prev) => !prev)}
                aria-expanded={typeDropdownOpen}
                aria-label="Lọc theo loại thiết bị"
                className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-2xl border border-line bg-surface/90 hover:bg-surface-hover text-xs sm:text-sm font-medium text-text flex items-center justify-between sm:justify-start gap-2.5 cursor-pointer focus:border-primary focus:outline-none transition-colors"
              >
                <span className="truncate max-w-[200px]">{currentTypeLabel}</span>
                <ChevronDown className={`w-4 h-4 text-muted transition-transform ${typeDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {typeDropdownOpen && (
                <div
                  role="listbox"
                  className="custom-scrollbar absolute left-0 sm:right-0 sm:left-auto top-full mt-1.5 z-40 w-64 max-h-64 overflow-y-auto rounded-2xl border border-line bg-surface p-1 shadow-float animate-in fade-in zoom-in-95 duration-150"
                >
                  {DEVICE_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={selectedType === opt.value}
                      onClick={() => {
                        setSelectedType(opt.value);
                        setTypeDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                        selectedType === opt.value
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-text hover:bg-surface-hover'
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {selectedType === opt.value && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons: Làm mới & Thêm dòng sản phẩm */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="min-h-[44px] px-4 rounded-2xl border border-line bg-surface/90 hover:bg-surface-hover text-xs sm:text-sm font-semibold text-text shadow-2xs hover:border-primary/50 transition-colors inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
              title="Làm mới danh sách"
            >
              <RefreshCw className={`w-4 h-4 text-muted ${loading ? 'animate-spin text-primary' : ''}`} />
              <span className="hidden sm:inline">Làm mới</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCreateCatalog}
              className="min-h-[44px] px-5 rounded-full bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm dòng sản phẩm</span>
            </button>
          </div>
        </div>

        {/* Summary Row: 4 Neutral StatChips */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl border border-line bg-surface/80 text-xs sm:text-sm shadow-2xs">
            <span className="text-muted font-normal">Dòng sản phẩm:</span>
            <span className="font-semibold text-text">{stats?.totalCatalogs ?? catalogs.length}</span>
          </div>
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl border border-line bg-surface/80 text-xs sm:text-sm shadow-2xs">
            <span className="text-muted font-normal">Thiết bị đã sinh tem QR:</span>
            <span className="font-semibold text-text">{stats?.totalDevices ?? 0}</span>
          </div>
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl border border-line bg-surface/80 text-xs sm:text-sm shadow-2xs">
            <span className="text-muted font-normal">Chờ kích hoạt:</span>
            <span className="font-semibold text-text">{stats?.unclaimedDevices ?? 0}</span>
          </div>
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl border border-line bg-surface/80 text-xs sm:text-sm shadow-2xs">
            <span className="text-muted font-normal">Đã ghép vào nhà:</span>
            <span className="font-semibold text-text">{stats?.claimedDevices ?? 0}</span>
          </div>
        </div>

        {/* Error Alert State */}
        {error && (
          <div
            role="alert"
            className="p-4 rounded-2xl border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 flex items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={loadData}
              className="font-semibold hover:underline cursor-pointer"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Product Cards Grid & Loading / Empty States */}
        {loading && catalogs.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="surface-card rounded-[20px] p-4 border border-line bg-surface/60 animate-pulse space-y-4"
              >
                <div className="aspect-[16/10] w-full rounded-2xl bg-sidebar" />
                <div className="space-y-2">
                  <div className="h-4 w-3/4 rounded-md bg-sidebar" />
                  <div className="h-3 w-1/2 rounded-md bg-sidebar" />
                  <div className="h-3 w-full rounded-md bg-sidebar" />
                </div>
                <div className="pt-3 border-t border-line flex justify-between items-center">
                  <div className="h-8 w-8 rounded-xl bg-sidebar" />
                  <div className="h-8 w-24 rounded-xl bg-sidebar" />
                </div>
              </div>
            ))}
          </div>
        ) : catalogs.length === 0 ? (
          <div className="surface-card glass-g1 p-12 text-center rounded-[20px] border border-line space-y-4 max-w-xl mx-auto my-6">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-sidebar flex items-center justify-center text-muted">
              <Layers className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-text">
                {searchKeyword || selectedType !== 'ALL'
                  ? 'Không tìm thấy dòng sản phẩm phù hợp'
                  : 'Chưa có dòng sản phẩm nào'}
              </h2>
              <p className="text-xs text-muted">
                {searchKeyword || selectedType !== 'ALL'
                  ? 'Hãy thử thay đổi hoặc xóa bộ lọc tìm kiếm để xem danh mục.'
                  : 'Bắt đầu bằng cách thêm dòng sản phẩm đầu tiên vào danh mục phần cứng HESTA.'}
              </p>
            </div>
            <div className="pt-2">
              {searchKeyword || selectedType !== 'ALL' ? (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface hover:bg-surface-hover px-4 py-2 text-xs font-semibold text-text shadow-2xs transition-colors cursor-pointer"
                >
                  Xóa bộ lọc
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenCreateCatalog}
                  className="inline-flex items-center gap-2 rounded-full bg-primary hover:bg-primary-hover px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm dòng sản phẩm</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {catalogs.map((catalog) => (
              <ProductCard
                key={catalog.id}
                catalog={catalog}
                onEdit={handleOpenEditCatalog}
                onDelete={(cat) => setDeletingCatalog(cat)}
                onGenerateQr={handleOpenGenerateQr}
              />
            ))}
          </div>
        )}
      </main>

      {/* Shared Mobile BottomNav with 3 admin destinations */}
      <DashboardBottomNav
        activeItem="admin"
        items={adminBottomNavItems}
      />

      {/* Profile Modal */}
      {isProfileModalOpen && (
        <ProfileModal
          isOpen
          onClose={() => setIsProfileModalOpen(false)}
          user={user}
          onProfileUpdate={onProfileUpdate}
        />
      )}

      {/* Product Catalog Modal (Add & Edit) */}
      <AdminCatalogModal
        isOpen={isCatalogModalOpen}
        onClose={() => setIsCatalogModalOpen(false)}
        onSuccess={loadData}
        editingCatalog={editingCatalog}
      />

      {/* Batch QR Generation Modal */}
      <AdminBatchQrModal
        isOpen={isBatchQrModalOpen}
        onClose={() => setIsBatchQrModalOpen(false)}
        onSuccess={loadData}
        catalog={selectedCatalogForQr}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deletingCatalog}
        title="Xóa dòng sản phẩm"
        description={`Bạn có chắc chắn muốn xóa dòng sản phẩm "${deletingCatalog?.name}" (${deletingCatalog?.modelCode}) không? Thao tác này không thể hoàn tác.`}
        confirmText="Xóa dòng sản phẩm"
        cancelText="Hủy bỏ"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingCatalog(null)}
      />
    </div>
  );
};
