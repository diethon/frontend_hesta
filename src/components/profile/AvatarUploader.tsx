import React, { useRef, useState } from 'react';
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
    <>
      <button
        type="button"
        aria-label="Thay đổi ảnh đại diện"
        disabled={isUploading}
        style={{ width: size, height: size }}
        className="relative shrink-0 rounded-full bg-primary flex items-center justify-center text-white font-bold shadow-lg shadow-primary/20 cursor-pointer group overflow-hidden"
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <UserAvatar src={user.avatarUrl} name={user.fullName} size={size} fallbackClassName="text-3xl font-bold text-white" />
        <div className="absolute inset-0 bg-text/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <svg aria-hidden={true} className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        {isUploading && (
          <div className="absolute inset-0 bg-text/70 flex items-center justify-center">
            <svg aria-hidden={true} className="animate-spin w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        )}
      </button>
      <input type="file" accept="image/*" hidden ref={fileInputRef} onChange={handleChange} />
    </>
  );
};
