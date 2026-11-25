import React, { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import type { UserResponse } from '../../types/auth';
import { uploadAvatar } from '../../services/userApi';
import { getErrorMessage } from '../../utils/errors';
import { notify } from '../ui/notify';
import { UserAvatar } from '../ui/UserAvatar';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export const AvatarUploader: React.FC<{
  user: UserResponse;
  onProfileUpdate: (updatedUser: UserResponse) => void;
  size?: number;
}> = ({ user, onProfileUpdate, size = 80 }) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      notify.error('Vui lòng chọn một file hình ảnh hợp lệ.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      notify.error('Dung lượng ảnh không được vượt quá 5MB.');
      return;
    }
    setIsUploading(true);
    try {
      const response = await uploadAvatar(file);
      if (response.result) {
        onProfileUpdate(response.result);
        notify.success('Cập nhật ảnh đại diện thành công');
      }
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, 'Tải ảnh thất bại. Vui lòng thử lại.'));
    } finally {
      setIsUploading(false);
      // Reset so the same file can be selected again.
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        aria-label="Thay đổi ảnh đại diện"
        disabled={isUploading}
        style={{ width: size, height: size }}
        className="relative shrink-0 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] ring-4 ring-[#eff6ff] border border-[#3b82f6]/40 flex items-center justify-center text-white font-bold shadow-md cursor-pointer group overflow-hidden"
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <UserAvatar src={user.avatarUrl} name={user.fullName} size={size} fallbackClassName="text-3xl font-bold text-white" />
        <div className="absolute inset-0 bg-[#0f172a]/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <Camera aria-hidden={true} className="w-6 h-6 text-white" />
        </div>
        {isUploading && (
          <div className="absolute inset-0 bg-[#0f172a]/70 flex items-center justify-center">
            <svg aria-hidden={true} className="animate-spin w-6 h-6 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        )}
      </button>
      <span
        aria-hidden={true}
        className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full border border-[#cbd5e1] bg-white text-[#0f172a] shadow-sm"
      >
        <Camera className="h-3.5 w-3.5 text-[#2563eb]" />
      </span>
      <input type="file" accept="image/*" hidden ref={fileInputRef} onChange={handleChange} />
    </div>
  );
};
