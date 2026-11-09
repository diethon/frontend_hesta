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
        <h2 className="text-xl font-bold text-[var(--text)] m-0 leading-tight">
          Thành viên <span className="sr-only">Quản lý thành viên trong nhà</span>
        </h2>
      </div>
      <div className="top-actions flex items-center gap-2">
        <VoiceAssistantButton />
        <NotificationBell />
        <div className="avatar w-9 h-9 rounded-full bg-[var(--solid)] border border-[var(--border)] flex items-center justify-center font-bold text-sm text-[var(--accent)] shrink-0">
          {userInitial}
        </div>
      </div>
    </header>
  );
};
