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
} from 'lucide-react';
import { notify } from '../ui/notify';

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
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    notify.success(`Đã sao chép ${field}!`, '');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Chưa có dữ liệu';
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? dateStr
      : d.toLocaleString('vi-VN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
  };

  const getStatusBadge = () => {
    switch (user.status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Đang hoạt động (ACTIVE)
          </span>
        );
      case 'LOCKED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
            <Lock className="w-3.5 h-3.5 text-amber-500" />
            Tạm khóa bảo vệ (LOCKED)
          </span>
        );
      case 'DISABLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            Vô hiệu hóa (DISABLED)
          </span>
        );
      default:
        return <span className="text-xs font-semibold text-muted">{user.status}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div
        className="surface-card w-full max-w-2xl rounded-2xl border border-line bg-surface p-6 shadow-float transition-all max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border border-line bg-sidebar flex items-center justify-center">
              <UserAvatar
                src={user.avatarUrl}
                name={user.fullName}
                size={48}
                fallbackClassName="text-base font-bold text-white bg-primary"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-text">{user.fullName}</h3>
                <span
                  className={`px-2 py-0.5 text-[11px] font-bold rounded-full border ${
                    user.platformRole === 'ADMIN'
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-600'
                      : 'border-info/30 bg-info-soft text-primary-hover'
                  }`}
                >
                  {user.platformRole}
                </span>
              </div>
              <p className="text-xs text-muted font-mono">{user.id}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-sidebar-hover hover:text-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content sections */}
        <div className="space-y-5">
          {/* Status & Privacy Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border border-line bg-sidebar/50">
            <div>
              <div className="text-xs text-muted mb-1 font-semibold uppercase tracking-wider">
                Trạng thái tài khoản
              </div>
              {getStatusBadge()}
            </div>
            <div className="text-xs text-muted text-right sm:max-w-xs">
              <span className="font-semibold text-text">Bảo vệ quyền riêng tư:</span> Quản trị viên chỉ quản lý tài khoản định danh, không thể xem mật khẩu hoặc dữ liệu phòng riêng tư.
            </div>
          </div>

          {/* Grid details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Email */}
            <div className="p-3.5 rounded-xl border border-line bg-surface flex items-center justify-between group">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">Email định danh</p>
                  <p className="text-sm font-bold text-text truncate">{user.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(user.email, 'Email')}
                className="p-1.5 text-muted hover:text-text rounded-md hover:bg-sidebar transition shrink-0"
                title="Sao chép email"
              >
                {copiedField === 'Email' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* Phone */}
            <div className="p-3.5 rounded-xl border border-line bg-surface flex items-center justify-between group">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0">
                  <Phone className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">Số điện thoại</p>
                  <p className="text-sm font-bold text-text truncate">
                    {user.phoneNumber || <span className="text-muted font-normal italic">Chưa liên kết</span>}
                  </p>
                </div>
              </div>
              {user.phoneNumber && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(user.phoneNumber!, 'Số điện thoại')}
                  className="p-1.5 text-muted hover:text-text rounded-md hover:bg-sidebar transition shrink-0"
                  title="Sao chép số điện thoại"
                >
                  {copiedField === 'Số điện thoại' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              )}
            </div>

            {/* Auth Provider */}
            <div className="p-3.5 rounded-xl border border-line bg-surface flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 shrink-0">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">Nguồn đăng nhập</p>
                <p className="text-sm font-bold text-text">
                  {user.provider === 'GOOGLE' ? 'Google OAuth 2.0' : 'Mật khẩu nội bộ (LOCAL)'}
                </p>
              </div>
            </div>

            {/* Homes count */}
            <div className="p-3.5 rounded-xl border border-line bg-surface flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 shrink-0">
                <Home className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">Ngôi nhà tham gia</p>
                <p className="text-sm font-bold text-text">{user.homeCount} không gian nhà</p>
              </div>
            </div>
          </div>

          {/* Security & Access Logs */}
          <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
            <h4 className="text-xs font-bold text-text uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Thông tin Bảo Mật &amp; Phiên Đăng Nhập
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-sidebar">
                <span className="text-muted flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" /> Số lần đăng nhập sai:
                </span>
                <span className={`font-bold ${user.failedLoginAttempts > 0 ? 'text-amber-500' : 'text-text'}`}>
                  {user.failedLoginAttempts} / 5 lần
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-sidebar">
                <span className="text-muted flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Hoạt động gần nhất:
                </span>
                <span className="font-semibold text-text">{formatDate(user.lastActiveAt)}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-sidebar">
                <span className="text-muted flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Ngày tạo tài khoản:
                </span>
                <span className="font-semibold text-text">{formatDate(user.createdAt)}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-sidebar">
                <span className="text-muted flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Cập nhật lần cuối:
                </span>
                <span className="font-semibold text-text">{formatDate(user.updatedAt)}</span>
              </div>
            </div>

            {user.lockedUntil && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between">
                <span>Khóa đến: <b>{formatDate(user.lockedUntil)}</b></span>
                <button
                  type="button"
                  onClick={() => onUnlock(user)}
                  className="px-2.5 py-1 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition"
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
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line bg-sidebar hover:bg-sidebar-hover text-xs font-semibold text-text transition"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Sửa thông tin
              </button>

              <button
                type="button"
                onClick={() => onResetPassword(user)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-semibold text-amber-600 transition"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Đặt lại mật khẩu
              </button>
            </div>

            <div className="flex items-center gap-2">
              {user.status === 'LOCKED' ? (
                <button
                  type="button"
                  onClick={() => onUnlock(user)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-soft transition"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  Mở khóa tài khoản
                </button>
              ) : user.status === 'ACTIVE' ? (
                <button
                  type="button"
                  onClick={() => onToggleStatus(user, 'LOCKED')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-semibold text-amber-600 transition"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Tạm khóa tài khoản
                </button>
              ) : null}

              {user.status === 'DISABLED' ? (
                <button
                  type="button"
                  onClick={() => onToggleStatus(user, 'ACTIVE')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-soft transition"
                >
                  Kích hoạt lại
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onToggleStatus(user, 'DISABLED')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-xs font-semibold text-rose-600 transition"
                >
                  Vô hiệu hóa (Ban)
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
