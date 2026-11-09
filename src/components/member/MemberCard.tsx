import React, { useState, useRef, useEffect } from 'react';
import type { HomeMember } from '../../services/homeApi';
import { UserAvatar } from '../ui/UserAvatar';
import { Icon } from '../home/HomeIcons';

export function sanitizeMemberName(name: string): string {
  if (!name) return '';
  return name.replace(/\s*\(Owner\)\s*$/i, '').trim();
}

export function formatJoinDate(dateString: string): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '—';
  }
}

export interface MemberCardProps {
  member: HomeMember;
  isCurrentUser: boolean;
  canManage: boolean; // Current user is OWNER and target is not OWNER and not self
  onViewDetails: (member: HomeMember) => void;
  onChangeRole: (member: HomeMember) => void;
  onRequestRemove: (member: HomeMember) => void;
}

export const MemberCard: React.FC<MemberCardProps> = ({
  member,
  isCurrentUser,
  canManage,
  onViewDetails,
  onChangeRole,
  onRequestRemove,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const isOwner = member.role === 'OWNER';
  const displayName = sanitizeMemberName(member.fullName);
  const joinedDateFormatted = formatJoinDate(member.joinedAt);

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

  return (
    <article
      className="glass-g1 rounded-[20px] p-4 border border-[var(--border)] relative flex flex-col justify-between hover:border-[var(--accent)]/40 transition-all duration-200 cursor-pointer group shadow-sm hover:shadow-md"
      onClick={() => onViewDetails(member)}
      role="button"
      tabIndex={0}
      aria-label={`Xem chi tiết thành viên ${displayName}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if ((e.target as HTMLElement).closest('.card-menu')) return;
          e.preventDefault();
          onViewDetails(member);
        }
      }}
    >
      {/* ── Top Row: Avatar & Menu ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center shrink-0 border border-[var(--border)] bg-[var(--solid)]">
          <UserAvatar
            src={member.avatarUrl}
            name={displayName}
            size={48}
            loading="lazy"
            fallbackClassName="text-sm font-bold text-[var(--secondary)]"
          />
        </div>

        {canManage && (
          <div
            className="card-menu relative shrink-0"
            ref={menuRef}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              ref={triggerRef}
              type="button"
              className="icon-button w-9 h-9 rounded-full flex items-center justify-center text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--border)]/60 transition-colors cursor-pointer"
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
                className="absolute right-0 top-10 w-44 rounded-2xl glass-g2 border border-[var(--border)] shadow-xl p-1.5 z-30 animate-in fade-in zoom-in-95 duration-150"
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
        )}
      </div>

      {/* ── Middle: Name & Email ── */}
      <div className="mt-3 min-w-0">
        <div className="flex items-center gap-2">
          <strong className="text-sm font-semibold text-[var(--text)] truncate block">
            {displayName}
          </strong>
          {isCurrentUser && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--secondary)] border border-[var(--border)] shrink-0">
              Bạn
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--tertiary)] truncate mt-0.5" title={member.email}>
          {member.email}
        </p>
      </div>

      {/* ── Bottom Row: Role Chip & Join Date ── */}
      <div className="mt-4 pt-3 border-t border-[var(--border)]/70 flex items-center justify-between text-xs">
        {isOwner ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
            <Icon name="shield" size={12} className="text-[var(--accent)]" />
            Chủ nhà
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--muted)] text-[var(--secondary)] border border-[var(--border)]">
            Thành viên
          </span>
        )}
        <span className="text-[11px] text-[var(--tertiary)]">
          Tham gia {joinedDateFormatted}
        </span>
      </div>
    </article>
  );
};
