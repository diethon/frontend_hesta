import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import type { UserResponse } from '../../types/auth';
import type { DeviceCatalog, DeviceAdminStats } from '../../types/deviceCatalog';
import { getDeviceCatalogs, getDeviceAdminStats, deleteDeviceCatalog } from '../../services/deviceCatalogApi';
import { ProfileModal } from '../profile/ProfileModal';
import { AdminCatalogModal } from './AdminCatalogModal';
import { AdminBatchQrModal } from './AdminBatchQrModal';
import { AdminNavbar } from './AdminNavbar';
import { AdminIcon, AppSidebar, PeopleIcon } from '../ui/AppSidebar';
import { notify } from '../ui/notify';
import { getErrorMessage } from '../../utils/errors';
import {
  Activity,
  Layers,
  Cpu,
  Search,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Clock,
  CheckCircle2,
  Tag,
  Zap,
} from 'lucide-react';

interface AdminDashboardProps {
  user: UserResponse;
  onLogout: () => void;
  onProfileUpdate: (user: UserResponse) => void;
}

const DEVICE_TYPE_OPTIONS = [
  { value: 'ALL', label: 'Tất Cả Loại Thiết Bị' },
  { value: 'LED_RGB', label: 'Đèn LED RGB' },
  { value: 'LIGHT', label: 'Công Tắc / Đèn Relay' },
  { value: 'SMART_PLUG', label: 'Ổ Cắm Đo Điện' },
  { value: 'FAN', label: 'Quạt Thông Minh' },
  { value: 'WATER_PUMP', label: 'Máy Bơm Nước' },
  { value: 'GATE_MOTOR', label: 'Motor Cổng Tự Động' },
  { value: 'AC_REMOTE', label: 'Điều Khiển Điều Hòa' },
  { value: 'TEMP_HUMID_SENSOR', label: 'Cảm Biến Nhiệt Ẩm' },
  { value: 'MOTION_SENSOR', label: 'Cảm Biến Chuyển Động' },
  { value: 'SMOKE_SENSOR', label: 'Cảm Biến Báo Khói' },
  { value: 'CAMERA_AI', label: 'Camera AI' },
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout, onProfileUpdate }) => {
  const navigate = useNavigate();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Catalog & QR states
  const [catalogs, setCatalogs] = useState<DeviceCatalog[]>([]);
  const [stats, setStats] = useState<DeviceAdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');

  // Modals
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [editingCatalog, setEditingCatalog] = useState<DeviceCatalog | null>(null);
  const [isBatchQrModalOpen, setIsBatchQrModalOpen] = useState(false);
  const [selectedCatalogForQr, setSelectedCatalogForQr] = useState<DeviceCatalog | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
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
      notify.error(getErrorMessage(err, 'Không thể tải danh mục thiết bị'), '');
    } finally {
      setLoading(false);
    }
  }, [searchKeyword, selectedType]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDeleteCatalog = async (catalog: DeviceCatalog) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa mẫu sản phẩm "${catalog.name}" (${catalog.modelCode}) không?`)) {
      return;
    }
    try {
      await deleteDeviceCatalog(catalog.id);
      notify.success('Đã xóa mẫu sản phẩm thành công', '');
      loadData();
    } catch (err) {
      notify.error(getErrorMessage(err, 'Không thể xóa mẫu sản phẩm'), '');
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-text relative overflow-x-hidden">
      <AppSidebar
        activeItem="admin"
        contextLabel="Quản trị nền tảng"
        showSystemSummary={false}
        items={[
          { id: 'admin', label: 'Quản lý thiết bị & QR', icon: <AdminIcon />, onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
          { id: 'users', label: 'Quản lý người dùng', icon: <PeopleIcon />, onClick: () => navigate('/admin/users') },
          { id: 'diagnostics', label: 'Chẩn đoán hạ tầng IoT', icon: <Activity className="w-5 h-5 text-primary" />, onClick: () => navigate('/admin/diagnostics') },
        ]}
      />
      <div className="lg:pl-64">
        {/* Reusable Top Navbar */}
        <AdminNavbar
          title="HESTA Admin Center"
          subtitle="Quản lý danh mục thiết bị & cấp phát mã QR"
          icon={
            <svg aria-hidden={true} className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          }
          showBackButton={false}
          user={user}
          onLogout={onLogout}
          onOpenProfile={() => setIsProfileModalOpen(true)}
        />

        {/* Main Content */}
        <main id="main-content" className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
          {/* Header Banner */}
          <div className="surface-card relative overflow-hidden p-6 lg:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 border border-line">
            <div>
              <div className="absolute left-0 top-0 bottom-0 w-1/3 bg-amber-500/10 blur-3xl pointer-events-none" />
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 mb-3">
                <Tag className="w-3.5 h-3.5" />
                Hệ Thống Quản Lý Sản Phẩm &amp; Xuất Xưởng
              </div>
              <h2 className="text-2xl font-black text-text sm:text-3xl">Danh Mục Thiết Bị &amp; Cấp Mã QR</h2>
              <p className="text-sm text-muted max-w-2xl mt-1 leading-relaxed">
                Định nghĩa mẫu thiết bị, cấp phát tem QR với số sê-ri tự tăng liên tiếp và theo dõi trạng thái thiết bị 
                từ lúc sản xuất (<span className="text-amber-500 font-semibold">UNCLAIMED</span>) đến khi người dùng quét vào nhà (<span className="text-emerald-500 font-semibold">CLAIMED</span>).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                onClick={loadData}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-2xl border border-line bg-surface hover:bg-surface-hover px-4 py-3 text-sm font-semibold text-text shadow-soft transition-all cursor-pointer"
                title="Làm mới dữ liệu"
              >
                <RefreshCw className={`w-4 h-4 text-muted ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Làm mới</span>
              </button>
              <button
                onClick={handleOpenCreateCatalog}
                className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-sm font-bold text-slate-900 shadow-float hover:bg-amber-400 transition-all cursor-pointer"
              >
                <Plus className="w-5 h-5" />
                <span>Thêm Dòng Sản Phẩm Mới</span>
              </button>
            </div>
          </div>

          {/* 4 Focused Device Metric Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* Card 1: Total Catalogs */}
            <div className="surface-card group p-5 border border-line rounded-3xl transition hover:-translate-y-0.5 hover:border-amber-500/50">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Layers className="w-6 h-6" />
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-amber-500/10 text-amber-600">
                  Danh mục SKU
                </span>
              </div>
              <h3 className="text-3xl font-black text-text mb-0.5">
                {loading ? '...' : stats?.totalCatalogs ?? 0}
              </h3>
              <p className="text-xs text-muted">Dòng sản phẩm phần cứng</p>
            </div>

            {/* Card 2: Total Generated Devices */}
            <div className="surface-card group p-5 border border-line rounded-3xl transition hover:-translate-y-0.5 hover:border-blue-500/50">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Cpu className="w-6 h-6" />
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-blue-500/10 text-blue-600">
                  Tổng thiết bị
                </span>
              </div>
              <h3 className="text-3xl font-black text-text mb-0.5">
                {loading ? '...' : stats?.totalDevices ?? 0}
              </h3>
              <p className="text-xs text-muted">Thiết bị đã sinh tem QR</p>
            </div>

            {/* Card 3: Unclaimed Devices */}
            <div className="surface-card group p-5 border border-line rounded-3xl transition hover:-translate-y-0.5 hover:border-rose-500/50">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Clock className="w-6 h-6" />
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-rose-500/10 text-rose-600">
                  Chờ quét
                </span>
              </div>
              <h3 className="text-3xl font-black text-text mb-0.5">
                {loading ? '...' : stats?.unclaimedDevices ?? 0}
              </h3>
              <p className="text-xs text-muted">QR xuất xưởng đang chờ kích hoạt</p>
            </div>

            {/* Card 4: Claimed Devices */}
            <div className="surface-card group p-5 border border-line rounded-3xl transition hover:-translate-y-0.5 hover:border-emerald-500/50">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-emerald-500/10 text-emerald-600">
                  Đang hoạt động
                </span>
              </div>
              <h3 className="text-3xl font-black text-text mb-0.5">
                {loading ? '...' : stats?.claimedDevices ?? 0}
              </h3>
              <p className="text-xs text-muted">Thiết bị đã ghép nối vào nhà</p>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="surface-card p-4 rounded-3xl border border-line flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Tìm kiếm theo tên mẫu thiết bị, mã model (VD: HESTA-RGB-01)..."
                className="w-full rounded-2xl border border-line bg-surface pl-10 pr-4 py-2.5 text-sm text-text focus:border-primary focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="rounded-2xl border border-line bg-surface px-4 py-2.5 text-sm text-text focus:border-primary focus:outline-none cursor-pointer"
              >
                {DEVICE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Catalog Grid */}
          {loading && catalogs.length === 0 ? (
            <div className="p-16 text-center text-muted surface-card rounded-3xl border border-line">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-amber-500 mb-3" />
              <p className="text-sm font-semibold">Đang tải danh mục thiết bị HESTA...</p>
            </div>
          ) : catalogs.length === 0 ? (
            <div className="p-16 text-center text-muted surface-card rounded-3xl border border-line space-y-4">
              <Layers className="w-12 h-12 mx-auto text-muted/50" />
              <div>
                <p className="text-base font-bold text-text">Không tìm thấy dòng sản phẩm nào</p>
                <p className="text-xs text-muted mt-1">
                  Hãy thử thay đổi bộ lọc tìm kiếm hoặc bấm nút bên dưới để tạo mẫu sản phẩm mới.
                </p>
              </div>
              <button
                onClick={handleOpenCreateCatalog}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-slate-900 hover:bg-amber-400 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Mẫu Đầu Tiên</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {catalogs.map((catalog) => {
                const total = catalog.totalDeviceCount || 0;
                const claimed = catalog.claimedCount || 0;
                const unclaimed = catalog.unclaimedCount || 0;
                const claimedPercent = total > 0 ? Math.round((claimed / total) * 100) : 0;

                return (
                  <div
                    key={catalog.id}
                    className="surface-card group rounded-3xl border border-line p-5 flex flex-col justify-between transition-all hover:border-amber-500/50 hover:shadow-soft"
                  >
                    <div>
                      {/* Product Image & Badges */}
                      <div className="relative mb-4 h-48 w-full overflow-hidden rounded-2xl border border-line bg-slate-50 dark:bg-slate-900/40 p-2 flex items-center justify-center">
                        {catalog.imageUrl ? (
                          <img
                            src={catalog.imageUrl}
                            alt={catalog.name}
                            className="max-h-full max-w-full object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-muted">
                            <Layers className="w-12 h-12" />
                          </div>
                        )}
                        <div className="absolute top-2.5 left-2.5 z-10">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-mono font-bold bg-slate-950 text-amber-400 border border-slate-800 shadow-md">
                            {catalog.modelCode}
                          </span>
                        </div>
                        <div className="absolute top-2.5 right-2.5 z-10">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-500 text-slate-950 shadow-md">
                            {catalog.deviceType}
                          </span>
                        </div>
                      </div>

                      {/* Title & Info */}
                      <h3 className="text-base font-bold text-text group-hover:text-primary transition-colors line-clamp-1">
                        {catalog.name}
                      </h3>
                      <p className="text-xs font-mono text-muted mt-0.5">
                        Prefix: <span className="text-amber-500 font-bold">{catalog.serialPrefix}</span>xxxx
                      </p>
                      <p className="text-xs text-muted mt-2 line-clamp-2 leading-relaxed">
                        {catalog.description || 'Chưa có thông tin mô tả kỹ thuật cho mẫu sản phẩm này.'}
                      </p>

                      {/* Progress / Output Stats */}
                      <div className="mt-4 pt-3 border-t border-line space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted">Sản lượng đã tạo:</span>
                          <span className="font-bold text-text">{total} chiếc</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                          <div
                            style={{ width: `${claimedPercent}%` }}
                            className="bg-emerald-500 h-full"
                            title={`Đã kích hoạt: ${claimed}`}
                          />
                          <div
                            style={{ width: `${100 - claimedPercent}%` }}
                            className="bg-amber-500/80 h-full"
                            title={`Chờ kích hoạt: ${unclaimed}`}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted">
                          <span className="text-amber-600 font-medium">Chờ quét: {unclaimed}</span>
                          <span className="text-emerald-600 font-medium">Đang dùng: {claimed} ({claimedPercent}%)</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="mt-5 pt-3 border-t border-line flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditCatalog(catalog)}
                          className="p-2 rounded-xl text-muted hover:text-text hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Sửa thông tin mẫu"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCatalog(catalog)}
                          className="p-2 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                          title="Xóa mẫu"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <button
                        onClick={() => handleOpenGenerateQr(catalog)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-900 shadow-soft hover:bg-amber-400 transition-all cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>Tạo Mã QR</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
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

      {/* Catalog Modal (Add & Edit) */}
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
    </div>
  );
};
