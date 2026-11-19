import React from 'react';
import { VoiceAssistantButton } from '../ui/VoiceAssistant';
import { NotificationBell } from '../notification/NotificationBell';
import { IconButton } from '../home/HomeIcons';

export interface AutomationTopBarProps {
  caption: string;
  title: React.ReactNode;
  subtitle?: string;
  userInitial?: string;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchOpen?: boolean;
  onSearchToggle?: () => void;
  searchPlaceholder?: string;
}

/** Page header shared by the Scene, Automation, Recommendation and Device pages. */
export const AutomationTopBar: React.FC<AutomationTopBarProps> = ({
  caption,
  title,
  subtitle,
  userInitial = 'U',
  searchQuery = '',
  onSearchChange,
  searchOpen = false,
  onSearchToggle,
  searchPlaceholder = 'Tìm kiếm',
}) => {
  return (
    <header className="topbar scenes-topbar">
      <div>
        <span className="st-eyebrow">{caption}</span>
        <h2>{title}</h2>
        {subtitle && <p className="st-subtitle">{subtitle}</p>}
      </div>
      <div className="top-actions">
        {onSearchChange && (
          <>
            {searchOpen && (
              <input
                autoFocus
                className="inline-search"
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
              />
            )}
            <IconButton
              icon="search"
              label={searchOpen ? 'Đóng tìm kiếm' : 'Tìm kiếm'}
              onClick={onSearchToggle}
            />
          </>
        )}
        <VoiceAssistantButton />
        <NotificationBell />
        <div className="avatar">{userInitial}</div>
      </div>
    </header>
  );
};
