import React, { useState, useRef, useEffect } from 'react';
import type { UserResponse } from '../../types/auth';
import { UserAvatar } from '../ui/UserAvatar';
import { User as UserIcon, LogOut } from 'lucide-react';

interface AdminAvatarMenuProps {
  user: UserResponse;
  onOpenProfile: () => void;
  onLogout: () => void;
}

export const AdminAvatarMenu: React.FC<AdminAvatarMenuProps> = ({
  user,
  onOpenProfile,
  onLogout,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const userInitial = user?.fullName
    ? user.fullName.trim().split(' ').slice(-1)[0]?.charAt(0).toUpperCase() || 'A'
    : 'A';

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-label="Tài khoản quản trị"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="avatar small cursor-pointer overflow-hidden border border-line shadow-xs hover:border-primary transition-colors flex items-center justify-center"
        title={user.fullName || 'Tài khoản quản trị'}
      >
        {user.avatarUrl ? (
          <UserAvatar src={user.avatarUrl} name={user.fullName} size={36} />
        ) : (
          userInitial
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 z-50 w-52 rounded-2xl border border-line bg-surface p-1.5 shadow-float animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-3 py-2 border-b border-line/60 mb-1">
            <p className="text-xs font-semibold text-text truncate">{user.fullName}</p>
            <p className="text-[11px] text-muted truncate">{user.email}</p>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onOpenProfile();
            }}
            className="w-full text-left px-3 py-2 text-xs font-medium text-text hover:bg-surface-hover rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
          >
            <UserIcon className="w-3.5 h-3.5 text-muted" />
            <span>Hồ sơ &amp; bảo mật</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
            className="w-full text-left px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-500" />
            <span>Đăng xuất</span>
          </button>
        </div>
      )}
    </div>
  );
};
