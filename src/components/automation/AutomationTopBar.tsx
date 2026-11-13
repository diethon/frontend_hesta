import React from 'react';
import { VoiceAssistantButton } from '../ui/VoiceAssistant';
import { NotificationBell } from '../notification/NotificationBell';

export interface AutomationTopBarProps {
  caption: string;
  title: React.ReactNode;
  subtitle?: string;
  userInitial?: string;
}

/** Page header shared by the Scene, Automation and Recommendation pages. */
export const AutomationTopBar: React.FC<AutomationTopBarProps> = ({
  caption,
  title,
  subtitle,
  userInitial = 'U',
}) => {
  return (
    <header className="topbar scenes-topbar">
      <div>
        <span className="st-eyebrow">{caption}</span>
        <h2>{title}</h2>
        {subtitle && <p className="st-subtitle">{subtitle}</p>}
      </div>
      <div className="top-actions">
        <VoiceAssistantButton />
        <NotificationBell />
        <div className="avatar">{userInitial}</div>
      </div>
    </header>
  );
};
