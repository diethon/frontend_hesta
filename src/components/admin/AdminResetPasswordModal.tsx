import React, { useState } from 'react';
import { adminResetPassword } from '../../services/adminUserApi';
import type { AdminUser } from '../../types/adminUser';
import { notify } from '../ui/notify';
import { getErrorMessage } from '../../utils/errors';
import { X, KeyRound, Eye, EyeOff, Lock, ShieldAlert, Loader2, RefreshCw } from 'lucide-react';

interface AdminResetPasswordModalProps {
  isOpen: boolean;
  user: AdminUser | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminResetPasswordModal: React.FC<AdminResetPasswordModalProps> = ({
  isOpen,
  user,
  onClose,
  onSuccess,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen || !user) return null;

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let pass = '';
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pass);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) {
      notify.error('Vui lòng nhập mật khẩu mới', '');
      return;
    }
    if (newPassword.length < 8) {
      notify.error('Mật khẩu phải có ít nhất 8 ký tự', '');
      return;
    }

    setLoading(true);
    try {
      await adminResetPassword(user.id, newPassword);
      notify.success('Đặt lại mật khẩu thành công', `Người dùng: ${user.email}`);
      onSuccess();
      onClose();
    } catch (err) {
      notify.error(getErrorMessage(err, 'Không thể đặt lại mật khẩu'), '');
    } finally {
      setLoading(false);
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
        className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-2xl text-text animate-in zoom-in-95 duration-200 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-text truncate">Đặt lại mật khẩu người dùng</h3>
              <p className="text-xs text-muted truncate max-w-[240px]">
                {user.fullName} · {user.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            className="rounded-xl p-2 text-muted hover:bg-surface-hover hover:text-text transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice banner */}
        <div className="rounded-2xl border border-line bg-sidebar/60 p-3.5 flex items-start gap-3">
          <ShieldAlert className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted leading-relaxed">
            Hành động này sẽ ghi đè mật khẩu hiện tại. Hãy gửi mật khẩu mới cho người dùng một cách an toàn.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-text">
                Mật khẩu mới <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={generateRandomPassword}
                className="text-xs font-semibold text-primary hover:text-primary-hover inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Tạo ngẫu nhiên</span>
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Ít nhất 8 ký tự"
                className="w-full min-h-[44px] rounded-2xl border border-line bg-surface/90 py-2.5 pl-10 pr-10 text-xs sm:text-sm text-text placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted hover:text-text cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="min-h-[44px] px-5 rounded-full border border-line bg-surface hover:bg-surface-hover text-xs font-semibold text-text transition-colors disabled:opacity-50 cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="min-h-[44px] px-5 rounded-full bg-primary hover:bg-primary-hover text-white text-xs font-semibold inline-flex items-center gap-2 shadow-xs transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{loading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
