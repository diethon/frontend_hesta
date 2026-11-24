import type { ReactNode } from 'react';
import { VoiceAssistantButton } from './VoiceAssistant';
import { NotificationBell } from '../notification/NotificationBell';
import './pageHero.css';

/** Large page header with a soft room photo on the right (Security, Profile). */
export function PageHero({ eyebrow, title, subtitle, userInitial }: {
  eyebrow: string;
  title: string;
  subtitle: string;
  userInitial: string;
}) {
  return (
    <header className="page-hero">
      <div>
        <span className="page-hero-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="top-actions">
        <VoiceAssistantButton />
        <NotificationBell />
        <div className="avatar">{userInitial}</div>
      </div>
    </header>
  );
}

/** Section heading with the accent bar used under a PageHero. */
export function SectionTitle({ children, id }: { children: ReactNode; id?: string }) {
  return <h2 id={id} className="page-section-title">{children}</h2>;
}
