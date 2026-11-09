import React, { useState, useEffect, useRef } from 'react';
import { generateInvitation, type InvitationResponse, type HomeMember } from '../../services/homeApi';
import { getErrorMessage } from '../../utils/errors';
import { notify } from '../ui/notify';
import { Icon } from '../home/HomeIcons';

export interface InviteMemberModalProps {
  isOpen: boolean;
  homeId: string;
  existingMembers: HomeMember[];
  onClose: () => void;
  triggerButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

export function formatExpiry(dateString?: string): string {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${hours}:${minutes} · ${day}/${month}/${year}`;
  } catch {
    return '';
  }
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  isOpen,
  homeId,
  existingMembers,
  onClose,
  triggerButtonRef,
}) => {
  const [activeTab, setActiveTab] = useState<'link' | 'email'>('link');

  // Link tab states
  const [invitation, setInvitation] = useState<InvitationResponse | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFallback, setCopyFallback] = useState(false);

  // Email tab states
  const [emailInput, setEmailInput] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccessMsg, setEmailSuccessMsg] = useState<string | null>(null);
  const [emailSentStatus, setEmailSentStatus] = useState<boolean | null>(null);

  const linkInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Auto-generate invite link when opening modal
  useEffect(() => {
    if (!isOpen) return;

    // Reset email states
    setEmailInput('');
    setEmailError(null);
    setEmailSuccessMsg(null);
    setCopied(false);
    setCopyFallback(false);

    let active = true;
    setLinkLoading(true);
    setLinkError(null);

    generateInvitation(homeId)
      .then((data) => {
        if (active) setInvitation(data);
      })
      .catch((err: unknown) => {
        if (active) {
          setLinkError(getErrorMessage(err, 'Không thể tạo liên kết · Thử lại'));
        }
      })
      .finally(() => {
        if (active) setLinkLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, homeId]);

  // Focus management: autofocus email input on desktop when switching to email tab
  useEffect(() => {
    if (isOpen && activeTab === 'email') {
      setTimeout(() => {
        emailInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, activeTab]);

  // Close on Escape & return focus to trigger
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      triggerButtonRef?.current?.focus();
    }, 50);
  };

  const inviteUrl = invitation
    ? `${window.location.origin}/join?token=${encodeURIComponent(invitation.inviteToken)}`
    : '';

  const handleCopyLink = () => {
    if (!inviteUrl) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(inviteUrl)
        .then(() => {
          setCopied(true);
          setCopyFallback(false);
          notify.success('Đã sao chép');
          setTimeout(() => setCopied(false), 1500);
        })
        .catch(() => {
          fallbackSelect();
        });
    } else {
      fallbackSelect();
    }
  };

  const fallbackSelect = () => {
    if (linkInputRef.current) {
      linkInputRef.current.select();
      setCopyFallback(true);
    }
  };

  const handleRetryCreateLink = () => {
    setLinkLoading(true);
    setLinkError(null);
    generateInvitation(homeId)
      .then((data) => {
        setInvitation(data);
      })
      .catch((err: unknown) => {
        setLinkError(getErrorMessage(err, 'Không thể tạo liên kết · Thử lại'));
      })
      .finally(() => {
        setLinkLoading(false);
      });
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailSuccessMsg(null);

    const email = emailInput.trim().toLowerCase();
    if (!email) return;

    // Client-side email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError('Email không hợp lệ');
      return;
    }

    // Check if already a member
    const alreadyMember = existingMembers.some((m) => m.email.toLowerCase() === email);
    if (alreadyMember) {
      setEmailError('Email này đã là thành viên');
      return;
    }

    setEmailLoading(true);
    try {
      const data = await generateInvitation(homeId, email);
      setInvitation(data);
      if (data.emailSent) {
        setEmailSentStatus(true);
        setEmailSuccessMsg(`Đã gửi email mời thành công tới ${email}`);
        setEmailInput('');
        notify.success('Đã gửi lời mời', email);
      } else {
        setEmailSentStatus(false);
        setEmailSuccessMsg(`Đã tạo lời mời cho ${email}`);
        setEmailInput('');
        notify.warning('Đã tạo lời mời', 'Dịch vụ gửi email gián đoạn');
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Không thể gửi · Thử lại');
      setEmailError(msg);
      notify.error(msg);
    } finally {
      setEmailLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div
        ref={modalRef}
        className="glass-g2 w-full sm:max-w-[480px] rounded-t-[28px] sm:rounded-3xl border border-[var(--border)] shadow-2xl p-6 space-y-5 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 bg-[var(--surface)] text-[var(--text)] relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile handle */}
        <div className="w-10 h-1 rounded-full bg-[var(--border)] mx-auto -mt-2 mb-2 sm:hidden" />

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-[var(--border)]">
          <div>
            <h3 id="invite-modal-title" className="text-base font-bold text-[var(--text)]">
              Mời thành viên
            </h3>
            <p className="text-xs text-[var(--secondary)] mt-0.5">
              Người được mời sẽ có quyền theo vai trò Thành viên
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="icon-button w-10 h-10 rounded-full flex items-center justify-center text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--muted)] transition-colors cursor-pointer shrink-0 -mr-2 -mt-1"
            aria-label="Đóng"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* ── Segmented Control: [Liên kết | Email] ── */}
        <div className="p-1 rounded-xl bg-[var(--muted)] border border-[var(--border)]/40 flex gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'link'
                ? 'bg-[var(--solid)] text-[var(--text)] shadow-xs'
                : 'text-[var(--secondary)] hover:text-[var(--text)]'
            }`}
          >
            Liên kết
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('email')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'email'
                ? 'bg-[var(--solid)] text-[var(--text)] shadow-xs'
                : 'text-[var(--secondary)] hover:text-[var(--text)]'
            }`}
          >
            Email
          </button>
        </div>

        {/* ── Tab Content: Liên kết ── */}
        {activeTab === 'link' && (
          <div className="space-y-4">
            {linkLoading ? (
              <div className="h-11 rounded-xl bg-[var(--muted)] animate-pulse" />
            ) : linkError ? (
              <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-xs text-rose-600 flex items-center justify-between">
                <span>{linkError}</span>
                <button
                  type="button"
                  onClick={handleRetryCreateLink}
                  className="font-semibold underline cursor-pointer hover:opacity-80"
                >
                  Thử lại
                </button>
              </div>
            ) : (
              <div>
                <label
                  htmlFor="invite-link-input"
                  className="block text-xs font-medium text-[var(--secondary)] mb-1.5"
                >
                  Liên kết tham gia
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="invite-link-input"
                    ref={linkInputRef}
                    type="text"
                    readOnly
                    value={inviteUrl}
                    onClick={handleCopyLink}
                    className="flex-1 min-w-0 h-11 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--solid)] text-xs text-[var(--text)] font-mono outline-none focus:ring-1 focus:ring-[var(--accent)] select-all cursor-pointer"
                    title={inviteUrl}
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="h-11 px-4 rounded-xl bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-xs cursor-pointer min-w-[104px]"
                  >
                    {copied ? (
                      <>
                        <Icon name="check" size={14} />
                        <span>Đã chép</span>
                      </>
                    ) : (
                      <>
                        <Icon name="copy" size={14} />
                        <span>Sao chép</span>
                      </>
                    )}
                  </button>
                </div>

                {copyFallback && (
                  <p className="text-[11px] text-[var(--accent)] mt-1.5">
                    Nhấn Ctrl/Cmd+C để sao chép
                  </p>
                )}

                <div className="mt-2.5 flex items-center justify-between text-[11px] text-[var(--secondary)]">
                  <span>Có hiệu lực đến {formatExpiry(invitation?.expiresAt)}</span>
                  <span>Liên kết dùng được 1 lần</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab Content: Email ── */}
        {activeTab === 'email' && (
          <form onSubmit={handleSendEmail} className="space-y-4">
            <div>
              <label
                htmlFor="invite-email-input"
                className="block text-xs font-medium text-[var(--secondary)] mb-1.5"
              >
                Địa chỉ email
              </label>
              <input
                id="invite-email-input"
                ref={emailInputRef}
                type="email"
                inputMode="email"
                placeholder="nguoidung@example.com"
                value={emailInput}
                onChange={(e) => {
                  setEmailInput(e.target.value);
                  if (emailError) setEmailError(null);
                }}
                disabled={emailLoading}
                required
                className={`w-full h-11 px-3.5 rounded-xl border bg-[var(--solid)] text-xs text-[var(--text)] outline-none focus:ring-1 ${
                  emailError
                    ? 'border-rose-500 focus:ring-rose-500'
                    : 'border-[var(--border)] focus:ring-[var(--accent)]'
                }`}
              />
              {emailError && (
                <p className="text-[11px] text-rose-600 font-medium mt-1.5">
                  {emailError}
                </p>
              )}
            </div>

            {emailSuccessMsg && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex flex-col gap-2.5 ${
                  emailSentStatus
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400'
                }`}
              >
                <div className="flex items-start gap-2">
                  <Icon
                    name={emailSentStatus ? 'check' : 'alert'}
                    size={15}
                    className={`shrink-0 mt-0.5 ${emailSentStatus ? 'text-emerald-600' : 'text-amber-600'}`}
                  />
                  <div className="leading-relaxed">
                    <p className="font-semibold">{emailSuccessMsg}</p>
                    {!emailSentStatus && (
                      <p className="text-[11px] opacity-90 mt-1 text-[var(--secondary)]">
                        Dịch vụ gửi email đang gián đoạn. Bạn có thể sao chép liên kết dưới đây để gửi trực tiếp cho thành viên:
                      </p>
                    )}
                  </div>
                </div>

                {!emailSentStatus && inviteUrl && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      readOnly
                      value={inviteUrl}
                      onClick={handleCopyLink}
                      className="flex-1 min-w-0 h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--solid)] text-xs text-[var(--text)] font-mono outline-none select-all cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="h-10 px-3.5 rounded-lg bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-xs cursor-pointer min-w-[96px]"
                    >
                      {copied ? (
                        <>
                          <Icon name="check" size={13} />
                          <span>Đã chép</span>
                        </>
                      ) : (
                        <>
                          <Icon name="copy" size={13} />
                          <span>Sao chép</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={emailLoading || !emailInput.trim()}
              className="w-full h-11 rounded-xl bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {emailLoading ? 'Đang gửi…' : 'Gửi lời mời'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
