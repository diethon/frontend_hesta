import React, { useState } from 'react';
import type { UserResponse } from '../../types/auth';
import { AvatarUploader } from './AvatarUploader';
import { ProfileInfoForm } from './ProfileInfoForm';
import { ChangePasswordForm } from './ChangePasswordForm';
import { NotificationPreferencesTab } from './NotificationPreferencesTab';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserResponse;
  onProfileUpdate: (updatedUser: UserResponse) => void;
}

type Tab = 'info' | 'security' | 'notifications';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'info', label: 'Thông tin cơ bản' },
  { id: 'security', label: 'Bảo mật' },
  { id: 'notifications', label: 'Thông báo' },
];

/** Admin pages keep this modal; home users get the full /profile page. */
export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, user, onProfileUpdate }) => {
  const [activeTab, setActiveTab] = useState<Tab>('info');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
        className="auth-surface gentle-rise flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden overscroll-contain shadow-float"
      >
        <div className="flex items-center justify-between p-6 border-b border-line">
          <h2 id="profile-modal-title" className="text-lg font-bold text-text">Hồ sơ cá nhân</h2>
          <button
            type="button"
            aria-label="Đóng hồ sơ cá nhân"
            onClick={onClose}
            className="text-muted hover:text-text hover:bg-sidebar-hover p-1 rounded-lg transition-colors"
          >
            <svg aria-hidden={true} className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex border-b border-line">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-4 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-text hover:bg-sidebar-hover/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar">
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center mb-2">
                <AvatarUploader user={user} onProfileUpdate={onProfileUpdate} />
                <p className="mt-3 text-xs text-muted">Nhấn vào để thay đổi ảnh</p>
              </div>
              <ProfileInfoForm user={user} onProfileUpdate={onProfileUpdate} />
            </div>
          )}
          {activeTab === 'security' && <ChangePasswordForm user={user} />}
          {activeTab === 'notifications' && <NotificationPreferencesTab />}
        </div>
      </div>
    </div>
  );
};
