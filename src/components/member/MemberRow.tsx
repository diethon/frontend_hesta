import React, { useState, useRef, useEffect } from 'react';
import type { HomeMember } from '../../services/homeApi';
import { Icon } from '../home/HomeIcons';
import { sanitizeMemberName, formatJoinDate } from './MemberCard';

export interface MemberRowProps {
  member: HomeMember;
  isCurrentUser: boolean;
  canManage: boolean;
  onViewDetails: (member: HomeMember) => void;
  onChangeRole: (member: HomeMember) => void;
  onRequestRemove: (member: HomeMember) => void;
}

export const MemberRow: React.FC<MemberRowProps> = ({
  member,
  isCurrentUser,
  canManage,
  onViewDetails,
  onChangeRole,
  onRequestRemove,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const isOwner = member.role === 'OWNER';
  const displayName = sanitizeMemberName(member.fullName);
  const joinedDateFormatted = formatJoinDate(member.joinedAt);

  const initial = displayName
    ? displayName.trim().split(' ').slice(-1)[0]?.charAt(0).toUpperCase() || 'M'
    : 'M';

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Close menu on Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  const handleRowClick = () => {
    onViewDetails(member);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      // Don't trigger row action if target was inside the menu
      if ((e.target as HTMLElement).closest('.row-menu')) return;
      e.preventDefault();
      onViewDetails(member);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Xem chi tiết thành viên ${displayName}`}
      onClick={handleRowClick}
      onKeyDown={handleKeyDown}
      className="group relative flex items-center justify-between gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 min-h-[72px] hover:bg-[var(--muted)]/60 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-inset"
    >
      {/* ── Left: 44px Avatar ── */}
      <div
        className={`w-11 h-11 rounded-full overflow-hidden flex items-center justify-center shrink-0 border border-[var(--border)] bg-[var(--muted)] ${
          isOwner ? 'ring-2 ring-[var(--accent)]/30 ring-offset-1 ring-offset-[var(--solid)]' : ''
        }`}
      >
        {member.avatarUrl && !imgError ? (
          <img
            src={member.avatarUrl}
            alt={displayName}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-sm font-semibold text-[var(--text)] select-none">
            {initial}
          </span>
        )}
      </div>

      {/* ── Middle: Name & Email ── */}
      <div className="flex-1 min-w-0 pr-2">
        <div className="flex items-center gap-2">
          <strong className="text-sm font-semibold text-[var(--text)] truncate">
            {displayName}
          </strong>
          {isCurrentUser && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--secondary)] border border-[var(--border)] shrink-0">
              Bạn
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--secondary)] truncate mt-0.5" title={member.email}>
          {member.email}
        </p>
        {/* Mobile Join Date */}
        <span className="text-[11px] text-[var(--secondary)] sm:hidden mt-0.5 block">
          Tham gia {joinedDateFormatted}
        </span>
      </div>

      {/* ── Right: Role Chip, Desktop Join Date, Menu Button ── */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        {/* Desktop Join Date */}
        <span className="text-xs text-[var(--secondary)] hidden sm:inline-block shrink-0">
          Tham gia {joinedDateFormatted}
        </span>

        {/* Role Chip */}
        {isOwner ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/25 shrink-0">
            <Icon name="shield" size={12} className="text-[var(--accent)]" />
            Chủ nhà
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--muted)] text-[var(--secondary)] border border-[var(--border)] shrink-0">
            Thành viên
          </span>
        )}

        {/* "⋯" Action Menu (44px target) or Reserved Spacer */}
        {canManage ? (
          <div
            className="row-menu relative shrink-0"
            ref={menuRef}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              ref={triggerRef}
              type="button"
              className="w-11 h-11 rounded-full flex items-center justify-center text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--muted)] transition-colors cursor-pointer"
              aria-label={`Tùy chọn cho ${displayName}`}
              aria-haspopup="true"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Icon name="more" size={16} />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-11 w-44 rounded-2xl glass-g2 border border-[var(--border)] shadow-xl p-1.5 z-30 animate-in fade-in zoom-in-95 duration-150"
              >
                <button
                  type="button"
                  role="menuitem"
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[var(--text)] hover:bg-[var(--muted)] transition-colors text-left cursor-pointer"
                  onClick={() => {
                    setMenuOpen(false);
                    onViewDetails(member);
                  }}
                >
                  <Icon name="search" size={14} className="text-[var(--secondary)] shrink-0" />
                  <span>Xem chi tiết</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[var(--text)] hover:bg-[var(--muted)] transition-colors text-left cursor-pointer"
                  onClick={() => {
                    setMenuOpen(false);
                    onChangeRole(member);
                  }}
                >
                  <Icon name="shield" size={14} className="text-[var(--secondary)] shrink-0" />
                  <span>Đổi vai trò</span>
                </button>
                <div className="my-1 border-t border-[var(--border)]" />
                <button
                  type="button"
                  role="menuitem"
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-500/10 transition-colors text-left cursor-pointer"
                  onClick={() => {
                    setMenuOpen(false);
                    onRequestRemove(member);
                  }}
                >
                  <Icon name="trash" size={14} className="text-rose-600 shrink-0" />
                  <span>Xóa khỏi nhà</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="w-11 h-11 shrink-0" aria-hidden="true" />
        )}
      </div>
    </div>
  );
};
