import React, { useState, useEffect } from 'react';
import { adminUpdateUser } from '../../services/adminUserApi';
import type { AdminUser, AdminUpdateUserPayload } from '../../types/adminUser';
import { notify } from '../ui/notify';
import { getErrorMessage } from '../../utils/errors';
import { X, Edit3, Shield, Mail, Phone, User } from 'lucide-react';

interface AdminEditUserModalProps {
  isOpen: boolean;
  user: AdminUser | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminEditUserModal: React.FC<AdminEditUserModalProps> = ({
  isOpen,
  user,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<AdminUpdateUserPayload>({
    fullName: '',
    phoneNumber: '',
    platformRole: 'USER',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.fullName || '',
        phoneNumber: user.phoneNumber || '',
        platformRole: user.platformRole || 'USER',
      });
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim()) {
      notify.error('Họ và tên không được để trống', '');
      return;
    }

    setLoading(true);
    try {
      await adminUpdateUser(user.id, formData);
      notify.success('Cập nhật thông tin người dùng thành công!', user.email);
      onSuccess();
      onClose();
    } catch (err) {
      notify.error(getErrorMessage(err, 'Không thể cập nhật người dùng'), '');
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
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text">Chỉnh Sửa Thông Tin Người Dùng</h3>
              <p className="text-xs text-muted">ID: {user.id}</p>
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
            <label className="block text-xs font-semibold text-muted mb-1.5">
              Địa chỉ Email (Định danh không thể đổi)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="text"
                disabled
                value={user.email}
                className="w-full rounded-xl border border-line bg-sidebar/50 py-2.5 pl-9 pr-3 text-sm text-muted cursor-not-allowed"
              />
            </div>
          </div>

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
              Số điện thoại
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
                  <div className="text-[11px] opacity-75">Quyền hạn User</div>
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
              {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
