import React, { useState, useEffect } from 'react';
import type { HomeMember } from '../../services/homeApi';
import { UserAvatar } from '../ui/UserAvatar';
import { Icon } from '../home/HomeIcons';
import { sanitizeMemberName, formatJoinDate } from './MemberCard';
import { ConfirmModal } from '../ui/ConfirmModal';

export interface MemberPanelProps {
  member: HomeMember | null;
  isOpen: boolean;
  currentUserRole: 'OWNER' | 'MEMBER';
  currentUserId?: string;
  onClose: () => void;
  onUpdateRole: (memberId: string, newRole: 'OWNER' | 'MEMBER') => Promise<void>;
  onRemoveMember: (member: HomeMember) => void;
}

export const MemberPanel: React.FC<MemberPanelProps> = ({
  member,
  isOpen,
  currentUserRole,
  currentUserId,
  onClose,
  onUpdateRole,
  onRemoveMember,
}) => {
  const [selectedRole, setSelectedRole] = useState<'OWNER' | 'MEMBER'>('MEMBER');
  const [savingRole, setSavingRole] = useState(false);
  const [showPromoteConfirm, setShowPromoteConfirm] = useState(false);

  useEffect(() => {
    if (member) {
      setSelectedRole(member.role);
    }
  }, [member]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !member) return null;

  const displayName = sanitizeMemberName(member.fullName);
  const isTargetOwner = member.role === 'OWNER';
  const isSelf = member.id === currentUserId;
  const isOwnerViewer = currentUserRole === 'OWNER';
  const canEditRole = isOwnerViewer && !isTargetOwner && !isSelf;
  const canRemove = isOwnerViewer && !isTargetOwner && !isSelf;
  const hasRoleChanged = selectedRole !== member.role;

  const handleSaveRoleClick = () => {
    if (!hasRoleChanged) return;
    if (selectedRole === 'OWNER') {
      setShowPromoteConfirm(true);
    } else {
      executeRoleChange('MEMBER');
    }
  };

  const executeRoleChange = async (newRole: 'OWNER' | 'MEMBER') => {
    try {
      setSavingRole(true);
      await onUpdateRole(member.id, newRole);
    } finally {
      setSavingRole(false);
      setShowPromoteConfirm(false);
    }
  };

  return (
    <>
      <div className="scene-panel-backdrop active" onClick={onClose} />

      <aside
        className="scene-panel glass-g2 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-panel-title"
        style={{ width: '480px' }}
      >
        <div className="sheet-handle" />

        {/* ── Sticky Header ── */}
        <header className="scene-panel-header shrink-0 flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <button
              type="button"
              onClick={onClose}
              className="icon-button w-8 h-8 rounded-full hover:bg-[var(--border)] flex items-center justify-center text-[var(--secondary)] cursor-pointer"
              aria-label="Đóng bảng thông tin"
            >
              <Icon name="x" size={16} />
            </button>

            <div className="min-w-0">
              <h3 id="member-panel-title" className="text-sm font-bold text-[var(--text)] truncate">
                Chi tiết thành viên
              </h3>
              <p className="text-[11px] text-[var(--tertiary)]">
                {isTargetOwner ? 'Chủ nhà' : 'Thành viên gia đình'}
              </p>
            </div>
          </div>
        </header>

        {/* ── Scrollable Body ── */}
        <div className="scene-panel-scroll flex-1 overflow-y-auto p-5 space-y-6">
          {/* Member Identity Card */}
          <div className="flex items-center gap-4 p-4 rounded-2xl glass-g1 border border-[var(--border)]">
            <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center shrink-0 border border-[var(--border)] bg-[var(--solid)]">
              <UserAvatar
                src={member.avatarUrl}
                name={displayName}
                size={56}
                loading="lazy"
                fallbackClassName="text-base font-bold text-[var(--secondary)]"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <strong className="text-base font-bold text-[var(--text)] truncate block">
                  {displayName}
                </strong>
                {isSelf && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--secondary)] border border-[var(--border)] shrink-0">
                    Bạn
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--tertiary)] truncate mt-0.5">
                {member.email}
              </p>
              <div className="mt-2">
                {isTargetOwner ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
                    <Icon name="shield" size={12} className="text-[var(--accent)]" />
                    Chủ nhà
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--muted)] text-[var(--secondary)] border border-[var(--border)]">
                    Thành viên
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Section: Vai trò */}
          <section className="space-y-3">
            <h4 className="text-xs font-bold text-[var(--secondary)] uppercase tracking-wider">
              Vai trò
            </h4>

            {canEditRole ? (
              <div className="space-y-3">
                {/* Option 1: Chủ nhà */}
                <label
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    selectedRole === 'OWNER'
                      ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                      : 'border-[var(--border)] hover:bg-[var(--muted)]/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value="OWNER"
                    checked={selectedRole === 'OWNER'}
                    onChange={() => setSelectedRole('OWNER')}
                    className="mt-1 accent-[var(--accent)]"
                  />
                  <div className="min-w-0">
                    <strong className="text-xs font-semibold text-[var(--text)] block">
                      Chủ nhà
                    </strong>
                    <p className="text-[11px] text-[var(--tertiary)] leading-relaxed mt-0.5">
                      Toàn quyền quản trị ngôi nhà, thiết bị, kịch bản, tự động hóa và quản lý thành viên.
                    </p>
                  </div>
                </label>

                {/* Option 2: Thành viên */}
                <label
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    selectedRole === 'MEMBER'
                      ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                      : 'border-[var(--border)] hover:bg-[var(--muted)]/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value="MEMBER"
                    checked={selectedRole === 'MEMBER'}
                    onChange={() => setSelectedRole('MEMBER')}
                    className="mt-1 accent-[var(--accent)]"
                  />
                  <div className="min-w-0">
                    <strong className="text-xs font-semibold text-[var(--text)] block">
                      Thành viên
                    </strong>
                    <p className="text-[11px] text-[var(--tertiary)] leading-relaxed mt-0.5">
                      Điều khiển thiết bị, kích hoạt kịch bản và xem thông tin không gian sống.
                    </p>
                  </div>
                </label>

                <div className="pt-1">
                  <button
                    type="button"
                    disabled={!hasRoleChanged || savingRole}
                    onClick={handleSaveRoleClick}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {savingRole ? 'Đang lưu…' : 'Lưu vai trò'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl glass-g1 border border-[var(--border)] space-y-1">
                <div className="flex items-center gap-2">
                  <strong className="text-xs font-semibold text-[var(--text)]">
                    {isTargetOwner ? 'Chủ nhà' : 'Thành viên'}
                  </strong>
                </div>
                <p className="text-[11px] text-[var(--tertiary)]">
                  {isTargetOwner
                    ? 'Không thể thay đổi vai trò của chủ nhà'
                    : !isOwnerViewer
                    ? 'Bạn không có quyền thay đổi vai trò thành viên'
                    : 'Không thể thay đổi vai trò của chính mình'}
                </p>
              </div>
            )}
          </section>

          {/* Section: Thông tin */}
          <section className="space-y-3">
            <h4 className="text-xs font-bold text-[var(--secondary)] uppercase tracking-wider">
              Thông tin
            </h4>
            <div className="rounded-2xl glass-g1 border border-[var(--border)] divide-y divide-[var(--border)]/60 text-xs">
              <div className="flex justify-between items-center p-3.5">
                <span className="text-[var(--tertiary)]">Email</span>
                <span className="font-medium text-[var(--text)] truncate max-w-[240px]">
                  {member.email || '—'}
                </span>
              </div>
              <div className="flex justify-between items-center p-3.5">
                <span className="text-[var(--tertiary)]">Ngày gia nhập</span>
                <span className="font-medium text-[var(--text)]">
                  {formatJoinDate(member.joinedAt)}
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* ── Footer ── */}
        {canRemove && (
          <footer className="p-4 border-t border-[var(--border)] flex justify-end shrink-0 bg-[var(--solid)]/50">
            <button
              type="button"
              onClick={() => onRemoveMember(member)}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 py-2 px-3.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Icon name="trash" size={14} className="text-rose-600" />
              <span>Xóa khỏi nhà</span>
            </button>
          </footer>
        )}
      </aside>

      {/* Confirmation Modal when promoting to OWNER */}
      <ConfirmModal
        isOpen={showPromoteConfirm}
        title={`Cấp quyền Chủ nhà cho ${displayName}?`}
        description="Họ sẽ có toàn quyền như bạn, bao gồm quản lý thiết bị, kịch bản và xóa thành viên."
        confirmText="Cấp quyền Chủ nhà"
        cancelText="Hủy bỏ"
        variant="warning"
        loading={savingRole}
        onConfirm={() => executeRoleChange('OWNER')}
        onCancel={() => setShowPromoteConfirm(false)}
      />
    </>
  );
};
