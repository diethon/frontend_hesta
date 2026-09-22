import React, { useState, useEffect } from 'react';
import { getHomeMembers, updateMemberRole, removeMember, generateInvitation } from '../../services/homeApi';
import type { HomeMember, InvitationResponse } from '../../services/homeApi';
import { getErrorMessage } from '../../utils/errors';
import { notify } from '../ui/notify';

interface MemberManagementProps {
  homeId: string;
  currentUserRole: 'OWNER' | 'MEMBER';
}

export const MemberManagement: React.FC<MemberManagementProps> = ({ homeId, currentUserRole }) => {
  const [members, setMembers] = useState<HomeMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitation, setInvitation] = useState<InvitationResponse | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const data = await getHomeMembers(homeId);
      setMembers(data);
    } catch {
      setError('Lỗi khi lấy danh sách thành viên');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    getHomeMembers(homeId).then((data) => {
      if (active) setMembers(data);
    }).catch(() => {
      if (active) setError('Lỗi khi lấy danh sách thành viên');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [homeId]);

  const handleRoleChange = async (memberId: string, newRole: 'OWNER' | 'MEMBER') => {
    try {
      await updateMemberRole(homeId, memberId, newRole);
      void fetchMembers();
      notify.success('Đã cập nhật quyền thành viên');
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, 'Không thể thay đổi quyền'));
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa thành viên này?')) return;
    try {
      await removeMember(homeId, memberId);
      void fetchMembers();
      notify.success('Đã xóa thành viên khỏi nhà');
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, 'Không thể xóa thành viên'));
    }
  };

  const handleOpenInviteModal = async () => {
    setShowInviteModal(true);
    setInviteEmail('');
    setInvitation(null);
    setInviteLoading(true);
    try {
      const data = await generateInvitation(homeId);
      setInvitation(data);
      notify.success('Đã tạo liên kết mời');
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, 'Không thể tạo link mời'));
      setShowInviteModal(false);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    try {
      const data = await generateInvitation(homeId, inviteEmail.trim());
      if (data.emailSent) {
        notify.success('Đã gửi lời mời', inviteEmail.trim());
      } else {
        notify.warning('Đã tạo lời mời nhưng chưa gửi được email', 'Bạn có thể sao chép liên kết để gửi thủ công.');
      }
      setInviteEmail('');
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, 'Không thể tạo lời mời'));
    } finally {
      setInviteLoading(false);
    }
  };

  if (loading) {
    return <div role="status" className="surface-card p-6 text-muted">Đang tải danh sách thành viên…</div>;
  }

  const invitationUrl = invitation
    ? `${window.location.origin}/join?token=${encodeURIComponent(invitation.inviteToken)}`
    : '';

  return (
    <div className="surface-card p-5 sm:p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-100">Quản lý Thành viên</h2>
        {currentUserRole === 'OWNER' && (
          <button
            onClick={handleOpenInviteModal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Mời thành viên
          </button>
        )}
      </div>

      {error && <div role="alert" aria-live="polite" className="mb-4 text-rose-400">{error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-sm">
              <th className="pb-3 font-medium">Thành viên</th>
              <th className="pb-3 font-medium">Vai trò</th>
              <th className="pb-3 font-medium">Ngày gia nhập</th>
              {currentUserRole === 'OWNER' && <th className="pb-3 font-medium text-right">Thao tác</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {members.map((member) => (
              <tr key={member.id} className="text-slate-300">
                <td className="py-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center shrink-0 border border-slate-700">
                    {member.avatarUrl ? (
                      <img src={member.avatarUrl} alt={`Ảnh đại diện của ${member.fullName}`} width={40} height={40} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-slate-400">{member.fullName.charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-slate-200">{member.fullName}</div>
                    <div className="text-xs text-slate-500">{member.email}</div>
                  </div>
                </td>
                <td className="py-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    member.role === 'OWNER' ? 'bg-amber-900/40 text-amber-400 border border-amber-800/50' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {member.role === 'OWNER' ? 'Chủ nhà' : 'Thành viên'}
                  </span>
                </td>
                <td className="py-4 text-sm text-slate-400">
                  {new Date(member.joinedAt).toLocaleDateString('vi-VN')}
                </td>
                {currentUserRole === 'OWNER' && (
                  <td className="py-4 text-right space-x-2">
                    <select
                      aria-label={`Vai trò của ${member.fullName}`}
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value as 'OWNER' | 'MEMBER')}
                      className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1 outline-none"
                    >
                      <option value="MEMBER">Thành viên</option>
                      <option value="OWNER">Chủ nhà</option>
                    </select>
                    <button
                      onClick={() => handleRemove(member.id)}
                      className="text-rose-400 hover:text-rose-300 text-xs px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 rounded transition-colors"
                    >
                      Xóa
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-text/30 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="invite-modal-title" className="auth-surface w-full max-w-md overflow-hidden overscroll-contain">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 id="invite-modal-title" className="text-lg font-bold text-text">Mời thành viên</h3>
              <button type="button" aria-label="Đóng cửa sổ mời thành viên" onClick={() => setShowInviteModal(false)} className="rounded-lg p-1 text-icon hover:bg-sidebar-hover hover:text-text">
                ✕
              </button>
            </div>
            
            <div className="p-6">
              {!invitation ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p role="status" className="text-sm text-slate-400">Đang tạo link mời…</p>
                </div>
              ) : (
                <div className="space-y-6 animate-fade-in">
                  <div className="bg-emerald-950/40 border border-emerald-900/50 p-4 rounded-xl text-center">
                    <p className="text-sm text-emerald-400 font-medium mb-1">Đã tạo link mời thành công!</p>
                    <p className="text-xs text-slate-400">Link này sẽ hết hạn vào: {new Date(invitation.expiresAt).toLocaleString('vi-VN')}</p>
                  </div>

                  <div>
                    <label htmlFor="invite-link" className="block text-sm font-medium text-slate-300 mb-2">1. Gửi qua Link</label>
                    <div className="flex gap-2">
                      <input
                        id="invite-link"
                        type="text"
                        readOnly
                        value={invitationUrl}
                        className="flex-1 bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-indigo-500 outline-none"
                      />
                      <button 
                        onClick={() => {
                          void navigator.clipboard.writeText(invitationUrl)
                            .then(() => notify.success('Đã sao chép liên kết mời'))
                            .catch(() => notify.error('Không thể sao chép liên kết. Vui lòng thử lại.'));
                        }}
                        className="px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-800" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-slate-900 px-3 text-slate-400 font-medium">Hoặc</span>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="invite-email" className="block text-sm font-medium text-slate-300 mb-2">2. Gửi qua Email</label>
                    <form onSubmit={handleSendEmail} className="flex gap-2">
                      <input
                        id="invite-email"
                        type="email"
                        placeholder="Nhập email người thân…"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        required
                        autoComplete="off"
                        spellCheck={false}
                        className="flex-1 bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                      <button
                        type="submit"
                        disabled={inviteLoading}
                        className="px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {inviteLoading ? 'Đang gửi…' : 'Gửi Email'}
                      </button>
                    </form>
                  </div>

                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="w-full mt-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors"
                  >
                    Đóng
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
