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
        <p role="alert" className="bg-[#fff1f2] border border-[#f43f5e]/45 text-[#be123c] px-4 py-3 rounded-xl text-xs font-medium">{error}</p>
      )}
      <div>
        <label htmlFor="profile-email" className="block text-xs font-bold text-[#0f172a] mb-1.5">Email (Không thể thay đổi)</label>
        <input id="profile-email" type="email" value={user.email} disabled
          className="w-full bg-[#f1f5f9] border border-[#cbd5e1] rounded-xl px-4 py-2.5 text-sm text-[#475569] font-medium cursor-not-allowed" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="profile-name" className="block text-xs font-bold text-[#0f172a] mb-1.5">Họ và tên <span className="text-[#e11d48]">*</span></label>
          <input id="profile-name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name"
            className="w-full bg-white border border-[#cbd5e1] hover:border-[#94a3b8] rounded-xl px-4 py-2.5 text-sm text-[#0f172a] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 outline-none transition" />
        </div>
        <div>
          <label htmlFor="profile-phone" className="block text-xs font-bold text-[#0f172a] mb-1.5">Số điện thoại</label>
          <input id="profile-phone" type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="Nhập số điện thoại…" autoComplete="tel"
            className="w-full bg-white border border-[#cbd5e1] hover:border-[#94a3b8] rounded-xl px-4 py-2.5 text-sm text-[#0f172a] placeholder:text-[#64748b] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 outline-none transition" />
        </div>
      </div>
      <div className="pt-2 flex justify-end">
        <button type="submit" disabled={isSaving}
          className="w-full sm:w-auto sm:min-w-[180px] py-2.5 px-6 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-sm rounded-xl transition shadow-xs active:scale-[0.99] disabled:opacity-50 cursor-pointer">
          {isSaving ? 'Đang lưu…' : 'Lưu thay đổi'}
        </button>
      </div>
    </form>
  );
};
