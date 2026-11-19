import React from 'react';
import type { AdminUser } from '../../types/adminUser';
import { UserAvatar } from '../ui/UserAvatar';
import {
  X,
  Mail,
  Phone,
  Calendar,
  Clock,
  Home,
  Lock,
  Unlock,
  AlertTriangle,
  KeyRound,
  Edit3,
  Copy,
  Check,
  ShieldAlert,
  ShieldCheck,
  Globe,
  Shield,
} from 'lucide-react';
import { notify } from '../ui/notify';
import { formatDateTimeFullVi } from './adminUsersHelpers';

interface AdminUserDetailModalProps {
  isOpen: boolean;
  user: AdminUser | null;
  onClose: () => void;
  onEdit: (user: AdminUser) => void;
  onResetPassword: (user: AdminUser) => void;
  onToggleStatus: (user: AdminUser, newStatus: 'ACTIVE' | 'LOCKED' | 'DISABLED') => void;
  onUnlock: (user: AdminUser) => void;
}

export const AdminUserDetailModal: React.FC<AdminUserDetailModalProps> = ({
  isOpen,
  user,
  onClose,
  onEdit,
  onResetPassword,
  onToggleStatus,
  onUnlock,
}) => {
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  if (!isOpen || !user) return null;

  const copyToClipboard = (text: string, field: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedField(field);
    notify.success(`Đã sao chép ${field}`, '');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getStatusBadge = () => {
    switch (user.status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Đang hoạt động
          </span>
        );
      case 'LOCKED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <Lock className="w-3.5 h-3.5 text-rose-500" />
            Tạm khóa bảo vệ
          </span>
        );
      case 'DISABLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            Vô hiệu hóa
          </span>
        );
      default:
        return <span className="text-xs font-semibold text-muted">{user.status}</span>;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-3xl border border-line bg-surface p-6 shadow-2xl text-text transition-all max-h-[90vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-200 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line/60 pb-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl overflow-hidden shrink-0 border border-line bg-sidebar flex items-center justify-center">
              <UserAvatar
                src={user.avatarUrl}
                name={user.fullName}
                size={48}
                fallbackClassName="text-base font-bold text-white bg-primary"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-text truncate">{user.fullName}</h3>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                    user.platformRole === 'ADMIN'
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-line bg-surface text-muted'
                  }`}
                >
                  {user.platformRole === 'ADMIN' && <Shield className="w-3 h-3 text-primary" />}
                  <span>{user.platformRole === 'ADMIN' ? 'Quản trị viên' : 'Người dùng'}</span>
                </span>
              </div>
              <p className="text-xs text-muted font-mono truncate">{user.id}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng chi tiết"
            className="rounded-xl p-2 text-muted hover:bg-surface-hover hover:text-text transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content sections */}
        <div className="space-y-4">
          {/* Status & Privacy Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-2xl border border-line bg-sidebar/50">
            <div>
              <div className="text-xs text-muted mb-1.5 font-medium">
                Trạng thái tài khoản
              </div>
              {getStatusBadge()}
            </div>
            <div className="text-xs text-muted text-left sm:text-right sm:max-w-xs leading-relaxed">
              <span className="font-semibold text-text">Bảo vệ quyền riêng tư:</span> Quản trị viên chỉ quản lý tài khoản định danh, không thể xem mật khẩu hoặc dữ liệu cá nhân.
            </div>
          </div>

          {/* Grid details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Email */}
            <div className="p-3.5 rounded-2xl border border-line bg-surface flex items-center justify-between group">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted">Email định danh</p>
                  <p className="text-xs sm:text-sm font-semibold text-text truncate">{user.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(user.email, 'Email')}
                className="p-2 text-muted hover:text-text rounded-xl hover:bg-sidebar transition-colors shrink-0 cursor-pointer"
                title="Sao chép email"
              >
                {copiedField === 'Email' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* Phone */}
            <div className="p-3.5 rounded-2xl border border-line bg-surface flex items-center justify-between group">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                  <Phone className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted">Số điện thoại</p>
                  <p className="text-xs sm:text-sm font-semibold text-text truncate">
                    {user.phoneNumber || <span className="text-muted font-normal italic">Chưa liên kết</span>}
                  </p>
                </div>
              </div>
              {user.phoneNumber && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(user.phoneNumber!, 'Số điện thoại')}
                  className="p-2 text-muted hover:text-text rounded-xl hover:bg-sidebar transition-colors shrink-0 cursor-pointer"
                  title="Sao chép số điện thoại"
                >
                  {copiedField === 'Số điện thoại' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              )}
            </div>

            {/* Auth Provider */}
            <div className="p-3.5 rounded-2xl border border-line bg-surface flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-muted">Nguồn đăng nhập</p>
                <p className="text-xs sm:text-sm font-semibold text-text">
                  {user.provider === 'GOOGLE' ? 'Google OAuth 2.0' : 'Mật khẩu nội bộ (Email)'}
                </p>
              </div>
            </div>

            {/* Homes count */}
            <div className="p-3.5 rounded-2xl border border-line bg-surface flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                <Home className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-muted">Ngôi nhà tham gia</p>
                <p className="text-xs sm:text-sm font-semibold text-text">{user.homeCount} không gian nhà</p>
              </div>
            </div>
          </div>

          {/* Security & Access Logs */}
          <div className="rounded-2xl border border-line bg-surface p-4 space-y-3">
            <h4 className="text-xs font-bold text-text flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span>Thông tin bảo mật &amp; phiên đăng nhập</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-sidebar/60">
                <span className="text-muted flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" /> Số lần đăng nhập sai:
                </span>
                <span className={`font-semibold ${user.failedLoginAttempts > 0 ? 'text-rose-500' : 'text-text'}`}>
                  {user.failedLoginAttempts} / 5 lần
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-sidebar/60">
                <span className="text-muted flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Hoạt động gần nhất:
                </span>
                <span className="font-semibold text-text">{formatDateTimeFullVi(user.lastActiveAt)}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-sidebar/60">
                <span className="text-muted flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Ngày tạo tài khoản:
                </span>
                <span className="font-semibold text-text">{formatDateTimeFullVi(user.createdAt)}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-sidebar/60">
                <span className="text-muted flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Cập nhật lần cuối:
                </span>
                <span className="font-semibold text-text">{formatDateTimeFullVi(user.updatedAt)}</span>
              </div>
            </div>

            {user.lockedUntil && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between gap-3">
                <span>Khóa bảo vệ đến: <b>{formatDateTimeFullVi(user.lockedUntil)}</b></span>
                <button
                  type="button"
                  onClick={() => onUnlock(user)}
                  className="px-3 py-1.5 rounded-full bg-primary hover:bg-primary-hover text-white font-semibold transition-colors cursor-pointer"
                >
                  Mở khóa ngay
                </button>
              </div>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-line">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onEdit(user)}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-4 rounded-full border border-line bg-surface hover:bg-surface-hover text-xs font-semibold text-text transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Sửa thông tin</span>
              </button>

              <button
                type="button"
                onClick={() => onResetPassword(user)}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-4 rounded-full border border-line bg-surface hover:bg-surface-hover text-xs font-semibold text-text transition-colors cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5 text-primary" />
                <span>Đặt lại mật khẩu</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {user.status === 'LOCKED' ? (
                <button
                  type="button"
                  onClick={() => onUnlock(user)}
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-4 rounded-full bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Mở khóa tài khoản</span>
                </button>
              ) : user.status === 'ACTIVE' ? (
                <button
                  type="button"
                  onClick={() => onToggleStatus(user, 'LOCKED')}
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-4 rounded-full border border-line bg-surface hover:bg-surface-hover text-xs font-semibold text-muted hover:text-text transition-colors cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Tạm khóa tài khoản</span>
                </button>
              ) : null}

              {user.status === 'DISABLED' ? (
                <button
                  type="button"
                  onClick={() => onToggleStatus(user, 'ACTIVE')}
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-4 rounded-full bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <span>Kích hoạt lại</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onToggleStatus(user, 'DISABLED')}
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-4 rounded-full border border-rose-500/20 bg-surface hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs font-semibold text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                >
                  <span>Vô hiệu hóa</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
