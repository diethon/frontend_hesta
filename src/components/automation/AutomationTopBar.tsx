import React from 'react';
import { VoiceAssistantButton } from '../ui/VoiceAssistant';
import { NotificationBell } from '../notification/NotificationBell';

export interface AutomationTopBarProps {
  totalCount: number;
  activeCount: number;
  userInitial?: string;
}

export const AutomationTopBar: React.FC<AutomationTopBarProps> = ({
  totalCount,
  activeCount,
  userInitial = 'U',
}) => {
  return (
    <header className="topbar scenes-topbar">
      <div>
        <span className="text-xs text-[var(--secondary)] font-normal block mb-0.5">
          {totalCount} quy tắc · {activeCount} đang bật
        </span>
        <h2>
          Tự động hóa <span className="sr-only">Quy tắc tự động</span>
        </h2>
      </div>
      <div className="top-actions">
        <VoiceAssistantButton />
        <NotificationBell />
        <div className="avatar">{userInitial}</div>
      </div>
    </header>
  );
};
