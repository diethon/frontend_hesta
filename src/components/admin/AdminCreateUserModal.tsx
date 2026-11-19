import React, { useState } from 'react';
import { adminCreateUser } from '../../services/adminUserApi';
import type { AdminCreateUserPayload } from '../../types/adminUser';
import { notify } from '../ui/notify';
import { getErrorMessage } from '../../utils/errors';
import { X, UserPlus, Eye, EyeOff, Shield, Mail, Phone, Lock, User, Loader2 } from 'lucide-react';

interface AdminCreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminCreateUserModal: React.FC<AdminCreateUserModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<AdminCreateUserPayload>({
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    platformRole: 'USER',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let pass = '';
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData((prev) => ({ ...prev, password: pass }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.email.trim() || !formData.password.trim()) {
      notify.error('Vui lòng điền đầy đủ các thông tin bắt buộc', '');
      return;
    }
    if (formData.password.length < 8) {
      notify.error('Mật khẩu phải có ít nhất 8 ký tự', '');
      return;
    }

    setLoading(true);
    try {
      await adminCreateUser(formData);
      notify.success('Tạo tài khoản người dùng thành công', `Email: ${formData.email}`);
      onSuccess();
      onClose();
    } catch (err) {
      notify.error(getErrorMessage(err, 'Không thể tạo tài khoản người dùng'), '');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-user-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="surface-card w-full max-w-lg rounded-3xl border border-line bg-surface p-6 sm:p-7 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sidebar text-primary">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 id="create-user-title" className="text-base font-bold text-text">
                Tạo tài khoản người dùng mới
              </h2>
              <p className="text-xs text-muted">Cấp quyền truy cập hệ sinh thái HESTA cho người dùng</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-full p-2 text-muted hover:bg-sidebar hover:text-text transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text mb-1">
              Họ và tên <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="Ví dụ: Nguyễn Văn An"
                className="w-full min-h-[44px] rounded-xl border border-line bg-sidebar/30 py-2.5 pl-10 pr-3.5 text-xs sm:text-sm text-text placeholder:text-muted/60 focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text mb-1">
              Địa chỉ email <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Ví dụ: user@hesta.vn"
                className="w-full min-h-[44px] rounded-xl border border-line bg-sidebar/30 py-2.5 pl-10 pr-3.5 text-xs sm:text-sm text-text placeholder:text-muted/60 focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text mb-1">
              Số điện thoại <span className="text-xs text-muted font-normal">(Tùy chọn)</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
                <Phone className="w-4 h-4" />
              </div>
              <input
                type="tel"
                value={formData.phoneNumber || ''}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                placeholder="Ví dụ: 0912345678"
                className="w-full min-h-[44px] rounded-xl border border-line bg-sidebar/30 py-2.5 pl-10 pr-3.5 text-xs sm:text-sm text-text placeholder:text-muted/60 focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-text">
                Mật khẩu khởi tạo <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={generateRandomPassword}
                className="text-xs font-semibold text-primary hover:text-primary-hover transition cursor-pointer"
              >
                Tạo mật khẩu ngẫu nhiên
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
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Ít nhất 8 ký tự"
                className="w-full min-h-[44px] rounded-xl border border-line bg-sidebar/30 py-2.5 pl-10 pr-10 text-xs sm:text-sm text-text placeholder:text-muted/60 focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted hover:text-text cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text mb-1">
              Vai trò hệ thống (Platform role)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, platformRole: 'USER' })}
                className={`flex items-center gap-2.5 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  formData.platformRole === 'USER'
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-line bg-sidebar/30 text-muted hover:text-text'
                }`}
              >
                <User className="w-4 h-4 shrink-0" />
                <div>
                  <div className="text-xs font-semibold">Người dùng thông thường</div>
                  <div className="text-[11px] opacity-75">Sử dụng Smart Home</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, platformRole: 'ADMIN' })}
                className={`flex items-center gap-2.5 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  formData.platformRole === 'ADMIN'
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-line bg-sidebar/30 text-muted hover:text-text'
                }`}
              >
                <Shield className="w-4 h-4 shrink-0" />
                <div>
                  <div className="text-xs font-semibold">Quản trị viên nền tảng</div>
                  <div className="text-[11px] opacity-75">Quyền Admin hệ thống</div>
                </div>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-line mt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-line bg-surface hover:bg-surface-hover text-xs font-semibold text-muted hover:text-text transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-40"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />}
              <span>{loading ? 'Đang tạo...' : 'Xác nhận tạo tài khoản'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
