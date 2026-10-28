import React, { useState } from 'react';
import { adminCreateUser } from '../../services/adminUserApi';
import type { AdminCreateUserPayload } from '../../types/adminUser';
import { notify } from '../ui/notify';
import { getErrorMessage } from '../../utils/errors';
import { X, UserPlus, Eye, EyeOff, Shield, Mail, Phone, Lock, User } from 'lucide-react';

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
      notify.success('Tạo tài khoản người dùng thành công!', `Email: ${formData.email}`);
      onSuccess();
      onClose();
    } catch (err) {
      notify.error(getErrorMessage(err, 'Không thể tạo tài khoản người dùng'), '');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div
        className="surface-card w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-float transition-all"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-line pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text">Tạo Tài Khoản Người Dùng Mới</h3>
              <p className="text-xs text-muted">Cấp quyền truy cập hệ sinh thái HESTA cho người dùng</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted hover:bg-sidebar-hover hover:text-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text mb-1.5">
              Họ và tên <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="VD: Nguyễn Văn An"
                className="w-full rounded-xl border border-line bg-sidebar py-2.5 pl-9 pr-3 text-sm text-text placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1.5">
              Địa chỉ Email <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="VD: user@hesta.vn"
                className="w-full rounded-xl border border-line bg-sidebar py-2.5 pl-9 pr-3 text-sm text-text placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1.5">
              Số điện thoại <span className="text-xs text-muted font-normal">(Tùy chọn)</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                <Phone className="w-4 h-4" />
              </div>
              <input
                type="tel"
                value={formData.phoneNumber || ''}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                placeholder="VD: 0912345678"
                className="w-full rounded-xl border border-line bg-sidebar py-2.5 pl-9 pr-3 text-sm text-text placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-text">
                Mật khẩu khởi tạo <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={generateRandomPassword}
                className="text-xs font-semibold text-primary hover:text-primary-hover transition"
              >
                Tạo mật khẩu ngẫu nhiên
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Ít nhất 8 ký tự"
                className="w-full rounded-xl border border-line bg-sidebar py-2.5 pl-9 pr-10 text-sm text-text placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted hover:text-text"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1.5">
              Vai trò hệ thống (Platform Role)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, platformRole: 'USER' })}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                  formData.platformRole === 'USER'
                    ? 'border-primary bg-primary/10 text-primary font-bold'
                    : 'border-line bg-sidebar text-muted hover:text-text'
                }`}
              >
                <User className="w-4 h-4 shrink-0" />
                <div>
                  <div className="text-xs font-bold">Người dùng thông thường</div>
                  <div className="text-[11px] opacity-75">Sử dụng Smart Home</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, platformRole: 'ADMIN' })}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                  formData.platformRole === 'ADMIN'
                    ? 'border-amber-500 bg-amber-500/10 text-amber-600 font-bold'
                    : 'border-line bg-sidebar text-muted hover:text-text'
                }`}
              >
                <Shield className="w-4 h-4 shrink-0" />
                <div>
                  <div className="text-xs font-bold">Quản trị viên nền tảng</div>
                  <div className="text-[11px] opacity-75">Quyền Admin hệ thống</div>
                </div>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-line mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-line bg-surface px-4 py-2.5 text-xs font-semibold text-muted hover:bg-sidebar hover:text-text transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow-soft hover:bg-primary-hover transition-all disabled:opacity-50"
            >
              {loading ? 'Đang tạo...' : 'Xác nhận tạo tài khoản'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
