import React, { useState, useEffect, useCallback } from 'react';
import { adminUpdateUser } from '../../services/adminUserApi';
import type { AdminUser, AdminUpdateUserPayload } from '../../types/adminUser';
import { notify } from '../ui/notify';
import { getErrorMessage } from '../../utils/errors';
import { X, Edit3, Shield, Mail, Phone, User, Loader2 } from 'lucide-react';

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
  const getInitialData = useCallback((): AdminUpdateUserPayload => {
    return {
      fullName: user?.fullName || '',
      phoneNumber: user?.phoneNumber || '',
      platformRole: user?.platformRole || 'USER',
    };
  }, [user]);

  const [formData, setFormData] = useState<AdminUpdateUserPayload>(getInitialData);
  const [loading, setLoading] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (user) {
      setFormData(getInitialData());
    }
  }, [user, getInitialData]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
      notify.success('Cập nhật thông tin người dùng thành công', user.email);
      onSuccess();
      onClose();
    } catch (err) {
      notify.error(getErrorMessage(err, 'Không thể cập nhật người dùng'), '');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-user-title"
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
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="edit-user-title" className="text-base font-bold text-text">
                Chỉnh sửa thông tin người dùng
              </h2>
              <p className="text-xs text-muted font-mono">ID: {user.id}</p>
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
            <label className="block text-xs font-medium text-muted mb-1">
              Địa chỉ email (Định danh không thể đổi)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="text"
                disabled
                value={user.email}
                className="w-full min-h-[44px] rounded-xl border border-line bg-sidebar/50 py-2.5 pl-10 pr-3.5 text-xs sm:text-sm text-muted cursor-not-allowed"
              />
            </div>
          </div>

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
              Số điện thoại
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
                  <div className="text-[11px] opacity-75">Quyền hạn User</div>
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
              <span>{loading ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
