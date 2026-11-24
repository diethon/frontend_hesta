import React, { useState } from 'react';
import type { UserResponse } from '../../types/auth';
import { updateProfile } from '../../services/userApi';
import { getErrorMessage } from '../../utils/errors';
import { notify } from '../ui/notify';

export const ProfileInfoForm: React.FC<{
  user: UserResponse;
  onProfileUpdate: (updatedUser: UserResponse) => void;
}> = ({ user, onProfileUpdate }) => {
  const [fullName, setFullName] = useState(user.fullName);
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Họ và tên không được để trống.');
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const response = await updateProfile({ fullName, phoneNumber });
      if (response.result) {
        onProfileUpdate(response.result);
        notify.success('Cập nhật thông tin thành công');
      }
    } catch (caught: unknown) {
      notify.error(getErrorMessage(caught, 'Cập nhật thất bại. Vui lòng thử lại.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p role="alert" className="bg-error-soft border border-error text-text px-4 py-3 rounded-xl text-xs">{error}</p>
      )}
      <div>
        <label htmlFor="profile-email" className="block text-xs font-medium text-text mb-1">Email (Không thể thay đổi)</label>
        <input id="profile-email" type="email" value={user.email} disabled
          className="w-full bg-sidebar border border-line rounded-xl px-4 py-2.5 text-sm text-muted cursor-not-allowed" />
      </div>
      <div>
        <label htmlFor="profile-name" className="block text-xs font-medium text-text mb-1">Họ và tên <span className="text-error">*</span></label>
        <input id="profile-name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name"
          className="w-full bg-surface border border-line rounded-xl px-4 py-2.5 text-sm text-text focus:border-primary outline-none transition" />
      </div>
      <div>
        <label htmlFor="profile-phone" className="block text-xs font-medium text-text mb-1">Số điện thoại</label>
        <input id="profile-phone" type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="Nhập số điện thoại…" autoComplete="tel"
          className="w-full bg-surface border border-line rounded-xl px-4 py-2.5 text-sm text-text placeholder-muted focus:border-primary outline-none transition" />
      </div>
      <div className="pt-2">
        <button type="submit" disabled={isSaving}
          className="w-full py-2.5 px-4 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-xl transition shadow-xs active:scale-[0.98] disabled:opacity-50">
          {isSaving ? 'Đang lưu…' : 'Lưu thay đổi'}
        </button>
      </div>
    </form>
  );
};
