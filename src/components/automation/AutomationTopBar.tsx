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
        <span className="eyebrow">
          {totalCount} QUY TẮC · {activeCount} ĐANG BẬT
        </span>
        <h2>Tự động hóa</h2>
      </div>
      <div className="top-actions">
        <VoiceAssistantButton />
        <NotificationBell />
        <div className="avatar">{userInitial}</div>
      </div>
    </header>
  );
};
