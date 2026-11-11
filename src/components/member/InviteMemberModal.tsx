import React, { useState, useEffect, useRef } from 'react';
import {
  generateInvitation,
  type InvitationResponse,
  type HomeMember,
  type InvitationAccessPayload,
} from '../../services/homeApi';
import { getErrorMessage } from '../../utils/errors';
import { notify } from '../ui/notify';
import { Icon } from '../home/HomeIcons';
import { AccessEditor } from './AccessEditor';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
  const [step, setStep] = useState<1 | 2>(1);
  const [accessPayload, setAccessPayload] = useState<InvitationAccessPayload>({
    scope: 'ALL',
    rooms: [],
    devices: [],
  });

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

  // Reset modal state on open
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setAccessPayload({ scope: 'ALL', rooms: [], devices: [] });
    setEmailInput('');
    setEmailError(null);
    setEmailSuccessMsg(null);
    setCopied(false);
    setCopyFallback(false);
    setInvitation(null);
  }, [isOpen]);

  const loadInviteLink = (access: InvitationAccessPayload) => {
    setLinkLoading(true);
    setLinkError(null);

    generateInvitation(homeId, undefined, access)
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

  const handleProceedToStep2 = () => {
    setStep(2);
    loadInviteLink(accessPayload);
  };

  const handleRetryCreateLink = () => {
    loadInviteLink(accessPayload);
  };

  // Focus management: autofocus email input on desktop when switching to email tab
  useEffect(() => {
    if (isOpen && step === 2 && activeTab === 'email') {
      setTimeout(() => {
        emailInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, step, activeTab]);

  // Close on Escape & return focus to trigger
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        triggerButtonRef?.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, triggerButtonRef]);

  const handleClose = () => {
    onClose();
    triggerButtonRef?.current?.focus();
  };

  const inviteUrl = invitation
    ? `${window.location.origin}/join/${invitation.inviteToken}`
    : '';

  const handleCopyLink = async () => {
    if (!inviteUrl) return;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(inviteUrl);
      } else {
        linkInputRef.current?.select();
        document.execCommand('copy');
      }
      setCopied(true);
      notify.success('Đã sao chép liên kết tham gia');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      linkInputRef.current?.select();
      setCopyFallback(true);
      notify.info('Hãy nhấn Ctrl/Cmd+C để sao chép');
    }
  };

  const validateEmail = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) return 'Vui lòng nhập email';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) return 'Email không hợp lệ';

    const isExisting = existingMembers.some(
      (m) => m.email && m.email.toLowerCase() === trimmed.toLowerCase()
    );
    if (isExisting) {
      return 'Người này đã là thành viên trong nhà';
    }

    return null;
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validateEmail(emailInput);
    if (error) {
      setEmailError(error);
      return;
    }

    try {
      setEmailLoading(true);
      setEmailError(null);
      setEmailSuccessMsg(null);
      setEmailSentStatus(null);

      const targetEmail = emailInput.trim();
      const res = await generateInvitation(homeId, targetEmail, accessPayload);
      setInvitation(res);

      const sent = res.emailSent === true;
      setEmailSentStatus(sent);

      if (sent) {
        setEmailSuccessMsg(`Đã gửi lời mời tới ${targetEmail}`);
        notify.success('Đã gửi email mời thành viên');
      } else {
        setEmailSuccessMsg(`Đã tạo lời mời cho ${targetEmail}`);
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
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--muted)] transition-colors cursor-pointer shrink-0"
                  aria-label="Quay lại bước 1"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              <h3 id="invite-modal-title" className="text-base font-bold text-[var(--text)] truncate">
                Mời thành viên {step === 1 ? '· Quyền truy cập' : '· Gửi lời mời'}
              </h3>
            </div>
            <p className="text-xs text-[var(--secondary)] mt-0.5 truncate">
              {step === 1
                ? 'Bước 1 / 2: Chọn phạm vi phòng và thiết bị cho thành viên mới'
                : 'Bước 2 / 2: Chia sẻ liên kết hoặc gửi email mời tham gia'}
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

        {/* ── STEP 1: Quyền truy cập ── */}
        {step === 1 && (
          <div className="space-y-4">
            <AccessEditor
              homeId={homeId}
              showSaveButton={false}
              onChange={(payload) => {
                setAccessPayload({
                  scope: payload.scope,
                  rooms: payload.rooms,
                  devices: payload.devices,
                });
              }}
            />

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 h-11 px-4 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--secondary)] hover:bg-[var(--muted)] transition-all cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleProceedToStep2}
                className="flex-1 h-11 px-4 rounded-xl bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-90 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                <span>Tiếp tục</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Phương thức mời ── */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Scope Summary Pill with Change Button */}
            <div className="p-3 rounded-xl bg-[var(--muted)]/50 border border-[var(--border)] flex items-center justify-between gap-3 text-xs">
              <div className="min-w-0 flex-1">
                <span className="text-[var(--secondary)] block text-[11px]">Quyền đã chọn</span>
                <span className="font-semibold text-[var(--text)] truncate block mt-0.5">
                  {accessPayload.scope === 'ALL'
                    ? 'Toàn bộ nhà (Toàn quyền xem & điều khiển)'
                    : `Tùy chỉnh (${accessPayload.rooms.length} phòng, ${accessPayload.devices.length} ghi đè)`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs font-semibold text-[var(--accent)] hover:underline shrink-0 cursor-pointer"
              >
                Thay đổi
              </button>
            </div>

            {/* Segmented Control: [Liên kết | Email] */}
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

            {/* Tab Content: Liên kết */}
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

            {/* Tab Content: Email */}
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
        )}
      </div>
    </div>
  );
};
