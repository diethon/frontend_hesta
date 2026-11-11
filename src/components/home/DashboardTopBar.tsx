import React, { useState, useRef, useEffect } from 'react';
import { Icon, IconButton } from './HomeIcons';
import type { UserResponse } from '../../types/auth';
import { VoiceAssistantButton } from '../ui/VoiceAssistant';
import { NotificationBell } from '../notification/NotificationBell';
import { Sparkles, X, Pencil, Plus, Home } from 'lucide-react';

export interface HomeOption {
  homeId: string;
  homeName: string;
  role: 'OWNER' | 'MEMBER';
}

interface DashboardTopBarProps {
  user: UserResponse;
  currentHome: HomeOption | null;
  homesList: HomeOption[];
  onSelectHome: (home: HomeOption) => void;
  onOpenCreateHome: () => void;
  onOpenRenameHome: (home: HomeOption) => void;
  onOpenProfile: () => void;
  onLogout: () => void;
  onSearchClick?: () => void;
}

export const DashboardTopBar: React.FC<DashboardTopBarProps> = ({
  user,
  currentHome,
  homesList,
  onSelectHome,
  onOpenCreateHome,
  onOpenRenameHome,
  onOpenProfile,
  onLogout,
  onSearchClick,
}) => {
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const [isHomeMenuOpen, setIsHomeMenuOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);
  const homeRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setIsAvatarMenuOpen(false);
      }
      if (homeRef.current && !homeRef.current.contains(e.target as Node)) {
        setIsHomeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format date: e.g. "THỨ BA, 18 THÁNG 6"
  const now = new Date();
  const dateFormatted = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
    .format(now)
    .toUpperCase();

  const hour = now.getHours();
  const greeting =
    hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';

  const userFirstName = user.fullName
    ? user.fullName.trim().split(' ').slice(-1)[0]
    : 'Minh';

  const userInitial = userFirstName.charAt(0).toUpperCase() || 'M';

  const handleMicClick = () => {
    const hiddenMic = document.getElementById('voice-assistant-btn');
    if (hiddenMic) {
      hiddenMic.click();
    }
  };

  const handleSearchClick = () => {
    if (onSearchClick) {
      onSearchClick();
    } else {
      const searchInput = document.querySelector<HTMLInputElement>('input[type="search"]');
      if (searchInput) searchInput.focus();
    }
  };

  return (
    <header className="topbar">
      {/* Hidden native voice trigger to preserve voice engine pipeline */}
      <div className="sr-only">
        <VoiceAssistantButton />
      </div>

      <div className="topbar-greeting">
        <span className="eyebrow">{dateFormatted}</span>
        <div className="flex items-center gap-3">
          <h2>
            {greeting}, {userFirstName}
          </h2>

          {/* Quick Home Switcher Pill */}
          {homesList.length > 0 && (
            <div className="relative inline-block" ref={homeRef}>
              <button
                type="button"
                onClick={() => setIsHomeMenuOpen(!isHomeMenuOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/70 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 backdrop-blur-md text-[11px] font-semibold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-white transition-all cursor-pointer"
                title="Đổi không gian ngôi nhà"
              >
                <Home className="w-3 h-3 text-primary" />
                <span className="max-w-[120px] truncate">{currentHome?.homeName || 'Chọn nhà'}</span>
                <Icon name="chevronDown" size={12} />
              </button>

              {isHomeMenuOpen && (
                <div className="absolute left-0 mt-1.5 w-60 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                      Danh sách ngôi nhà
                    </span>
                  </div>

                  <div className="max-h-48 overflow-y-auto p-1">
                    {homesList.map((h) => (
                      <div
                        key={h.homeId}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer ${
                          currentHome?.homeId === h.homeId
                            ? 'bg-primary/10 text-primary font-bold'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                        onClick={() => {
                          onSelectHome(h);
                          setIsHomeMenuOpen(false);
                        }}
                      >
                        <span className="truncate">{h.homeName}</span>
                        {h.role === 'OWNER' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsHomeMenuOpen(false);
                              onOpenRenameHome(h);
                            }}
                            className="p-1 hover:text-primary"
                            title="Đổi tên nhà"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsHomeMenuOpen(false);
                        onOpenCreateHome();
                      }}
                      className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-primary font-semibold hover:bg-primary/5 rounded-xl transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm ngôi nhà mới</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="top-actions">
        <IconButton icon="search" label="Tìm kiếm" onClick={handleSearchClick} />
        <IconButton icon="mic" label="Điều khiển giọng nói" onClick={handleMicClick} />

        {/* Real Notification Bell with integrated dropdown */}
        <div className="relative">
          <NotificationBell />
        </div>

        {/* User Profile Avatar with Menu */}
        <div className="relative" ref={avatarRef}>
          <button
            type="button"
            className="avatar"
            aria-label="Tài khoản cá nhân"
            title={user.fullName || 'Tài khoản'}
            onClick={() => setIsAvatarMenuOpen(!isAvatarMenuOpen)}
          >
            {userInitial}
          </button>

          {isAvatarMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                  {user.fullName}
                </p>
                <p className="truncate text-xs text-muted">{user.email}</p>
              </div>

              <div className="p-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsAvatarMenuOpen(false);
                    onOpenProfile();
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span>Hồ sơ & Bảo mật</span>
                </button>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsAvatarMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
