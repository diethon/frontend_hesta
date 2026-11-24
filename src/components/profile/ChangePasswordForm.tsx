import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { UserResponse } from '../../types/auth';
import { changePassword } from '../../services/userApi';
import { getErrorMessage } from '../../utils/errors';
import { notify } from '../ui/notify';

const inputClass =
  'w-full bg-white border border-[#cbd5e1] hover:border-[#94a3b8] rounded-xl px-4 py-2.5 pr-11 text-sm text-[#0f172a] placeholder:text-[#64748b] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 outline-none transition';

export const ChangePasswordForm: React.FC<{ user: UserResponse }> = ({ user }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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
        <p role="alert" aria-live="polite" className="bg-[#fff1f2] border border-[#f43f5e]/45 text-[#be123c] px-4 py-3 rounded-xl text-xs font-medium">{error}</p>
      )}
      {user.provider === 'GOOGLE' && (
        <p className="bg-[#eff6ff] border border-[#3b82f6]/40 p-4 rounded-xl text-xs text-[#1d4ed8] font-medium">
          Tài khoản của bạn được đăng nhập thông qua Google. Tính năng đổi mật khẩu có thể không khả dụng nếu bạn chưa từng đặt mật khẩu cục bộ.
        </p>
      )}
      <div>
        <label htmlFor="current-password" className="block text-xs font-bold text-[#0f172a] mb-1.5">Mật khẩu hiện tại <span className="text-[#e11d48]">*</span></label>
        <div className="relative">
          <input id="current-password" type={showCurrent ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="••••••••" required autoComplete="current-password" className={inputClass} />
          <button
            type="button"
            onClick={() => setShowCurrent((prev) => !prev)}
            aria-label={showCurrent ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#0f172a] cursor-pointer p-1"
          >
            {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="new-password" className="block text-xs font-bold text-[#0f172a] mb-1.5">Mật khẩu mới <span className="text-[#e11d48]">*</span></label>
          <div className="relative">
            <input id="new-password" type={showNew ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••" required autoComplete="new-password" className={inputClass} />
            <button
              type="button"
              onClick={() => setShowNew((prev) => !prev)}
              aria-label={showNew ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#0f172a] cursor-pointer p-1"
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="confirm-new-password" className="block text-xs font-bold text-[#0f172a] mb-1.5">Xác nhận mật khẩu mới <span className="text-[#e11d48]">*</span></label>
          <div className="relative">
            <input id="confirm-new-password" type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••" required autoComplete="new-password" className={inputClass} />
            <button
              type="button"
              onClick={() => setShowConfirm((prev) => !prev)}
              aria-label={showConfirm ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#0f172a] cursor-pointer p-1"
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
      <div className="pt-2 flex justify-end">
        <button type="submit" disabled={isSaving}
          className="w-full sm:w-auto sm:min-w-[180px] py-2.5 px-6 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-sm rounded-xl transition shadow-xs active:scale-[0.99] disabled:opacity-50 cursor-pointer">
          {isSaving ? 'Đang xử lý…' : 'Đổi mật khẩu'}
        </button>
      </div>
    </form>
  );
};
