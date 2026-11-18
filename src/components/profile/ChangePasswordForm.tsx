import React, { useState } from 'react';
import type { UserResponse } from '../../types/auth';
import { changePassword } from '../../services/userApi';
import { getErrorMessage } from '../../utils/errors';
import { notify } from '../ui/notify';

const inputClass = 'w-full bg-surface border border-line rounded-xl px-4 py-2.5 text-sm text-text placeholder-muted focus:border-primary outline-none transition';

export const ChangePasswordForm: React.FC<{ user: UserResponse }> = ({ user }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      setError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await changePassword({ currentPassword, newPassword });
      notify.success('Đổi mật khẩu thành công');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (caught: unknown) {
      notify.error(getErrorMessage(caught, 'Đổi mật khẩu thất bại. Vui lòng thử lại.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p role="alert" aria-live="polite" className="bg-error-soft border border-error text-text px-4 py-3 rounded-xl text-xs">{error}</p>
      )}
      {user.provider === 'GOOGLE' && (
        <p className="bg-primary/10 border border-primary/30 p-4 rounded-xl text-xs text-primary">
          Tài khoản của bạn được đăng nhập thông qua Google. Tính năng đổi mật khẩu có thể không khả dụng nếu bạn chưa từng đặt mật khẩu cục bộ.
        </p>
      )}
      <div>
        <label htmlFor="current-password" className="block text-xs font-medium text-text mb-1">Mật khẩu hiện tại <span className="text-error">*</span></label>
        <input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="••••••••" required autoComplete="current-password" className={inputClass} />
      </div>
      <div>
        <label htmlFor="new-password" className="block text-xs font-medium text-text mb-1">Mật khẩu mới <span className="text-error">*</span></label>
        <input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
          placeholder="••••••••" required autoComplete="new-password" className={inputClass} />
      </div>
      <div>
        <label htmlFor="confirm-new-password" className="block text-xs font-medium text-text mb-1">Xác nhận mật khẩu mới <span className="text-error">*</span></label>
        <input id="confirm-new-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••" required autoComplete="new-password" className={inputClass} />
      </div>
      <div className="pt-2">
        <button type="submit" disabled={isSaving}
          className="w-full py-2.5 px-4 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-xl transition shadow-xs active:scale-[0.98] disabled:opacity-50">
          {isSaving ? 'Đang xử lý…' : 'Đổi mật khẩu'}
        </button>
      </div>
    </form>
  );
};
