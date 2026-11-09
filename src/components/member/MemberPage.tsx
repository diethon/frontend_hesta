import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useAppSelector } from '../../store/hooks';
import { getHomeMembers, updateMemberRole, removeMember, getMyHomes, type HomeMember } from '../../services/homeApi';
import { getErrorMessage } from '../../utils/errors';
import { notify } from '../ui/notify';
import { DashboardNavRail } from '../home/DashboardNavRail';
import { DashboardBottomNav } from '../home/DashboardBottomNav';
import { MemberTopBar } from './MemberTopBar';
import { MemberCard, sanitizeMemberName } from './MemberCard';
import { MemberPanel } from './MemberPanel';
import { InviteMemberModal } from './InviteMemberModal';
import { ConfirmModal } from '../ui/ConfirmModal';
import { Icon, IconButton } from '../home/HomeIcons';

export interface MemberPageProps {
  embeddedHomeId?: string;
  embeddedUserRole?: 'OWNER' | 'MEMBER';
}

export function MemberPage({ embeddedHomeId, embeddedUserRole }: MemberPageProps = {}) {
  const params = useParams<{ homeId?: string }>();
  const navigate = useNavigate();
  const authUser = useAppSelector((state) => state.auth.user);

  // Determine homeId and user role from props or URL
  const initialHomeId = embeddedHomeId || params.homeId || '';
  const [homeId, setHomeId] = useState<string>(initialHomeId);
  const [currentUserRole, setCurrentUserRole] = useState<'OWNER' | 'MEMBER'>(
    embeddedUserRole || 'MEMBER'
  );

  useEffect(() => {
    if (embeddedHomeId || params.homeId) {
      setHomeId(embeddedHomeId || params.homeId || '');
    } else if (!homeId) {
      void getMyHomes().then((homes) => {
        if (homes && homes.length > 0) {
          setHomeId(homes[0].homeId);
        }
      }).catch(() => {});
    }
  }, [embeddedHomeId, params.homeId, homeId]);

  const [members, setMembers] = useState<HomeMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'OWNER' | 'MEMBER'>('ALL');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  // Modals & Sheets
  const [selectedMember, setSelectedMember] = useState<HomeMember | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<HomeMember | null>(null);
  const [removingMember, setRemovingMember] = useState(false);

  const inviteButtonRef = useRef<HTMLButtonElement>(null);

  const loadMembers = useCallback(async () => {
    if (!homeId) return;
    setError(null);
    setLoading(true);
    try {
      const data = await getHomeMembers(homeId);
      setMembers(data);

      // Derive caller's own role from member list if not provided as prop
      if (!embeddedUserRole && authUser?.id) {
        const myMembership = data.find((m) => m.id === authUser.id);
        if (myMembership) {
          setCurrentUserRole(myMembership.role);
        }
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Lỗi khi tải danh sách thành viên'));
    } finally {
      setLoading(false);
    }
  }, [homeId, authUser?.id, embeddedUserRole]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  // Derived counts
  const totalCount = members.length;
  const ownerCount = useMemo(() => members.filter((m) => m.role === 'OWNER').length, [members]);
  const isOwnerViewer = currentUserRole === 'OWNER';

  // Sort: OWNER first, then by join date
  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      if (a.role === 'OWNER' && b.role !== 'OWNER') return -1;
      if (a.role !== 'OWNER' && b.role === 'OWNER') return 1;
      return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
    });
  }, [members]);

  // Filtered members by search query and role segmented control
  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortedMembers.filter((m) => {
      if (roleFilter === 'OWNER' && m.role !== 'OWNER') return false;
      if (roleFilter === 'MEMBER' && m.role !== 'MEMBER') return false;
      if (!q) return true;
      const name = sanitizeMemberName(m.fullName).toLowerCase();
      const email = (m.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [sortedMembers, roleFilter, query]);

  // Role update handler
  const handleUpdateRole = async (memberId: string, newRole: 'OWNER' | 'MEMBER') => {
    try {
      await updateMemberRole(homeId, memberId, newRole);
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
      if (selectedMember && selectedMember.id === memberId) {
        setSelectedMember((prev) => (prev ? { ...prev, role: newRole } : null));
      }
      notify.success('Đã cập nhật vai trò thành công');
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Không thể đổi vai trò · Thử lại');
      notify.error(msg);
      throw err;
    }
  };

  // Remove member handler
  const handleConfirmRemove = async () => {
    if (!memberToRemove) return;
    setRemovingMember(true);
    try {
      await removeMember(homeId, memberToRemove.id);
      setMembers((prev) => prev.filter((m) => m.id !== memberToRemove.id));
      if (selectedMember?.id === memberToRemove.id) {
        setPanelOpen(false);
        setSelectedMember(null);
      }
      setMemberToRemove(null);
      notify.success(`Đã xóa ${sanitizeMemberName(memberToRemove.fullName)} khỏi nhà`);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Không thể xóa thành viên');
      notify.error(msg);
    } finally {
      setRemovingMember(false);
    }
  };

  const userInitial = authUser?.fullName
    ? authUser.fullName.trim().split(' ').slice(-1)[0]?.charAt(0).toUpperCase() || 'U'
    : 'U';

  const isSoloOwner = !loading && members.length === 1 && members[0]?.role === 'OWNER';

  const isEmbedded = Boolean(embeddedHomeId);

  const content = (
    <main className={`flex-1 min-w-0 ${isEmbedded ? '' : 'pb-20 md:pb-8'}`}>
      {/* TopBar */}
      <MemberTopBar
        totalCount={totalCount}
        ownerCount={ownerCount}
        userInitial={userInitial}
      />

      {/* ── Action Row (One Line) ── */}
      <div className="scenes-actions flex items-center justify-between gap-3 mt-4 mb-3">
        {/* Left: Segmented control [Tất cả | Chủ nhà | Thành viên] */}
        <div className="scene-filter p-1 rounded-2xl bg-[var(--muted)] flex items-center gap-1">
          <button
            type="button"
            className={`py-1.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              roleFilter === 'ALL'
                ? 'bg-[var(--solid)] text-[var(--text)] shadow-xs'
                : 'text-[var(--tertiary)] hover:text-[var(--text)]'
            }`}
            onClick={() => setRoleFilter('ALL')}
          >
            Tất cả
          </button>
          <button
            type="button"
            className={`py-1.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              roleFilter === 'OWNER'
                ? 'bg-[var(--solid)] text-[var(--text)] shadow-xs'
                : 'text-[var(--tertiary)] hover:text-[var(--text)]'
            }`}
            onClick={() => setRoleFilter('OWNER')}
          >
            Chủ nhà
          </button>
          <button
            type="button"
            className={`py-1.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              roleFilter === 'MEMBER'
                ? 'bg-[var(--solid)] text-[var(--text)] shadow-xs'
                : 'text-[var(--tertiary)] hover:text-[var(--text)]'
            }`}
            onClick={() => setRoleFilter('MEMBER')}
          >
            Thành viên
          </button>
        </div>

        {/* Right: Inline Search (if > 8 members) + Primary Pill "+ Mời thành viên" (owners only) */}
        <div className="flex items-center gap-2">
          {members.length > 8 && (
            <div className="flex items-center gap-1.5">
              {searchOpen && (
                <input
                  type="text"
                  autoFocus
                  placeholder="Tìm tên hoặc email…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-48 sm:w-64 h-9 px-3 rounded-xl border border-[var(--border)] bg-[var(--solid)] text-xs text-[var(--text)] outline-none focus:ring-1 focus:ring-[var(--accent)] animate-in fade-in duration-150"
                />
              )}
              <IconButton
                icon="search"
                label="Tìm kiếm thành viên"
                onClick={() => setSearchOpen(!searchOpen)}
              />
            </div>
          )}

          {isOwnerViewer && (
            <button
              ref={inviteButtonRef}
              type="button"
              onClick={() => setInviteModalOpen(true)}
              className="h-9 px-4 rounded-xl text-xs font-semibold bg-[var(--accent)] text-white hover:opacity-90 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
            >
              <Icon name="plus" size={14} />
              <span>Mời thành viên</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Summary Chips (Neutral StatChips) ── */}
      <div className="flex items-center gap-2 mb-5">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[var(--muted)] text-[var(--secondary)] border border-[var(--border)]">
          <Icon name="users" size={13} className="text-[var(--tertiary)]" />
          <span>{totalCount} thành viên</span>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[var(--muted)] text-[var(--secondary)] border border-[var(--border)]">
          <Icon name="shield" size={13} className="text-[var(--tertiary)]" />
          <span>{ownerCount} chủ nhà</span>
        </div>
      </div>

      {/* ── Main Content Grid / States ── */}
      {loading ? (
        /* Loading Skeletons */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="glass-g1 rounded-[20px] p-4 border border-[var(--border)] h-44 animate-pulse flex flex-col justify-between"
            >
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-full bg-[var(--muted)]" />
                <div className="w-8 h-8 rounded-full bg-[var(--muted)]" />
              </div>
              <div className="space-y-2">
                <div className="w-2/3 h-4 rounded bg-[var(--muted)]" />
                <div className="w-1/2 h-3 rounded bg-[var(--muted)]" />
              </div>
              <div className="w-1/3 h-5 rounded-full bg-[var(--muted)]" />
            </div>
          ))}
        </div>
      ) : error ? (
        /* Error State */
        <div className="p-8 rounded-3xl glass-g1 border border-rose-500/20 text-center space-y-3">
          <p className="text-sm text-rose-600 font-medium">{error}</p>
          <button
            type="button"
            onClick={loadMembers}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--accent)] text-white hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center gap-1.5"
          >
            <Icon name="refresh" size={14} />
            <span>Thử lại</span>
          </button>
        </div>
      ) : filteredMembers.length === 0 ? (
        /* No Search Results */
        <div className="p-12 rounded-3xl glass-g1 border border-[var(--border)] text-center space-y-2">
          <p className="text-sm font-medium text-[var(--text)]">Không tìm thấy thành viên nào phù hợp</p>
          <p className="text-xs text-[var(--tertiary)]">Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc vai trò</p>
        </div>
      ) : (
        /* MemberCard Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredMembers.map((member) => {
            const isCurrentUser = member.id === authUser?.id;
            const isOwner = member.role === 'OWNER';
            const canManage = isOwnerViewer && !isOwner && !isCurrentUser;

            return (
              <MemberCard
                key={member.id}
                member={member}
                isCurrentUser={isCurrentUser}
                canManage={canManage}
                onViewDetails={(m) => {
                  setSelectedMember(m);
                  setPanelOpen(true);
                }}
                onChangeRole={(m) => {
                  setSelectedMember(m);
                  setPanelOpen(true);
                }}
                onRequestRemove={(m) => {
                  setMemberToRemove(m);
                }}
              />
            );
          })}

          {/* Empty Hint Card when only 1 owner exists and viewer is owner */}
          {isSoloOwner && isOwnerViewer && (
            <div
              className="glass-g1 rounded-[20px] p-5 border border-dashed border-[var(--border)] flex flex-col justify-between text-center items-center gap-4 hover:border-[var(--accent)]/50 transition-colors"
              role="region"
              aria-label="Gợi ý mời thành viên"
            >
              <div className="w-12 h-12 rounded-full bg-[var(--muted)] flex items-center justify-center text-[var(--accent)] shrink-0">
                <Icon name="plus" size={20} />
              </div>
              <div>
                <strong className="text-xs font-semibold text-[var(--text)] block">
                  Mời người thân để cùng điều khiển ngôi nhà
                </strong>
                <p className="text-[11px] text-[var(--tertiary)] mt-1">
                  Gửi liên kết hoặc email để các thành viên gia đình cùng tham gia
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInviteModalOpen(true)}
                className="py-2 px-4 rounded-xl text-xs font-semibold bg-[var(--accent)] text-white hover:opacity-90 transition-all cursor-pointer"
              >
                Mời thành viên
              </button>
            </div>
          )}
        </div>
      )}

      {/* Member Details Right Panel */}
      <MemberPanel
        member={selectedMember}
        isOpen={panelOpen}
        currentUserRole={currentUserRole}
        currentUserId={authUser?.id}
        onClose={() => {
          setPanelOpen(false);
          setSelectedMember(null);
        }}
        onUpdateRole={handleUpdateRole}
        onRemoveMember={(m) => {
          setMemberToRemove(m);
        }}
      />

      {/* Invite Member Dialog */}
      <InviteMemberModal
        isOpen={inviteModalOpen}
        homeId={homeId}
        existingMembers={members}
        onClose={() => setInviteModalOpen(false)}
        triggerButtonRef={inviteButtonRef}
      />

      {/* Removal Confirmation Dialog */}
      <ConfirmModal
        isOpen={Boolean(memberToRemove)}
        title={`Xóa ${memberToRemove ? sanitizeMemberName(memberToRemove.fullName) : ''} khỏi nhà?`}
        description="Họ sẽ mất quyền điều khiển thiết bị trong nhà này. Bạn có thể mời lại sau."
        confirmText="Xóa khỏi nhà"
        cancelText="Hủy bỏ"
        variant="danger"
        loading={removingMember}
        onConfirm={handleConfirmRemove}
        onCancel={() => setMemberToRemove(null)}
      />
    </main>
  );

  if (isEmbedded) {
    return content;
  }

  return (
    <div className="app-shell members-page">
      {/* 3 Pastel glowing background meshes */}
      <div className="mesh mesh-one" />
      <div className="mesh mesh-two" />
      <div className="mesh mesh-three" />

      {/* Unified NavRail sidebar */}
      <DashboardNavRail
        homeId={homeId}
        activeItem="members"
        user={authUser || undefined}
        onSelectOverview={() => navigate('/home')}
      />

      {content}

      {/* Mobile Bottom Navigation */}
      <DashboardBottomNav activeItem="members" />
    </div>
  );
}
