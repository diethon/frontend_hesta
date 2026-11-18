import React from 'react';
import { VoiceAssistantButton } from '../ui/VoiceAssistant';
import { NotificationBell } from '../notification/NotificationBell';

export interface MemberTopBarProps {
  totalCount: number;
  ownerCount: number;
  userInitial?: string;
}

export const MemberTopBar: React.FC<MemberTopBarProps> = ({
  totalCount,
  ownerCount,
  userInitial = 'U',
}) => {
  return (
    <header className="topbar scenes-topbar">
      <div>
        <span className="text-xs text-[var(--secondary)] font-normal block mb-0.5">
          {totalCount} thành viên · {ownerCount} chủ nhà
        </span>
        <h2>
          Thành viên <span className="sr-only">Quản lý thành viên trong nhà</span>
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
