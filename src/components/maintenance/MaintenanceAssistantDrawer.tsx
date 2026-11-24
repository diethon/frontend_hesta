import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ExternalLink,
  ImagePlus,
  RotateCcw,
  Search,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import {
  abandonMaintenanceAssistant,
  confirmMaintenanceAssistantTicket,
  deleteMaintenanceAssistantConversation,
  deleteMaintenanceAttachment,
  getActiveMaintenanceAssistant,
  sendMaintenanceAssistantMessage,
  startMaintenanceAssistant,
  submitMaintenanceAssistantFeedback,
  uploadMaintenanceAttachment,
} from '../../services/maintenanceApi';
import { convertWebpToJpegIfNeeded } from './imageUploadUtils';
import type {
  AssistantBlock,
  AssistantConversation,
  AssistantDeviceCardBlock,
  AssistantDevicePickerBlock,
  AssistantImageAnalysisBlock,
  AssistantPrivacyNoticeBlock,
  AssistantQuickRepliesBlock,
  AssistantTicketCreatedBlock,
  AssistantTicketSummaryBlock,
  MaintenanceTicket,
  UploadedMaintenanceAttachment,
} from '../../types/maintenance';
import { getErrorMessage } from '../../utils/errors';
import { notify } from '../ui/notify';
import { btnGhost, btnPrimary, fieldClass } from './MaintenanceModal';
import { AuthenticatedImage } from './AuthenticatedImage';
import { SlotEditor } from './SlotEditor';
import { PriorityPill, StatusPill } from './TicketDetailView';
import { draftToSlot, newSlotDraft, slotProblem, type SlotDraft } from './maintenanceFormat';

interface MaintenanceAssistantDrawerProps {
  homeId: string;
  initialDeviceId?: string;
  onClose: () => void;
  onTicketCreated: (ticket: MaintenanceTicket) => void;
  onViewTicket: (ticketId: string) => void;
  onSwitchToManual: (deviceId?: string, note?: string) => void;
}

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const textToneClass: Record<string, string> = {
  default: 'bg-sidebar/80 border-line text-text',
  info: 'bg-primary/5 border-primary/25 text-text',
  warn: 'bg-[#fffbeb] border-[#f59e0b]/50 text-[#1e293b]',
  danger: 'bg-[#fff1f2] border-[#f43f5e]/50 text-[#9f1239] font-medium',
  ok: 'bg-[#ecfdf5] border-[#10b981]/50 text-[#065f46]',
};

export function MaintenanceAssistantDrawer({
  homeId,
  initialDeviceId,
  onClose,
  onTicketCreated,
  onViewTicket,
  onSwitchToManual,
}: MaintenanceAssistantDrawerProps) {
  const [conversation, setConversation] = useState<AssistantConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [input, setInput] = useState('');
  const [slots, setSlots] = useState<SlotDraft[]>([newSlotDraft(1)]);
  const [contactPhone, setContactPhone] = useState('');
  const [editedSummary, setEditedSummary] = useState('');
  const [summaryInitialized, setSummaryInitialized] = useState(false);
  const [attachments, setAttachments] = useState<UploadedMaintenanceAttachment[]>([]);
  const [pendingChatImage, setPendingChatImage] = useState<UploadedMaintenanceAttachment | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [feedbackDraftRating, setFeedbackDraftRating] = useState<1 | 5 | null>(null);
  const [feedbackNote, setFeedbackNote] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackDismissed, setFeedbackDismissed] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatImageInputRef = useRef<HTMLInputElement>(null);

  const bootConversation = async (forceNew: boolean) => {
    setLoading(true);
    try {
      if (!forceNew && !initialDeviceId) {
        const existing = await getActiveMaintenanceAssistant(homeId);
        if (existing) {
          setConversation(existing);
          return;
        }
      }
      const created = await startMaintenanceAssistant(homeId, initialDeviceId);
      setConversation(created);
    } catch (error) {
      notify.error(getErrorMessage(error, 'Không khởi tạo được trợ lý chẩn đoán.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void bootConversation(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeId, initialDeviceId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    if (!summaryInitialized && conversation) {
      for (let i = conversation.messages.length - 1; i >= 0; i -= 1) {
        const summaryBlock = conversation.messages[i].blocks.find((b): b is AssistantTicketSummaryBlock => b.type === 'ticket_summary');
        if (summaryBlock) {
          const initial = summaryBlock.aiSummary || summaryBlock.extractedDetails || '';
          if (initial) setEditedSummary(initial);
          if (summaryBlock.suggestedAttachments && summaryBlock.suggestedAttachments.length > 0) {
            setAttachments((prev) => {
              const existingIds = new Set(prev.map((a) => a.attachmentId));
              const additions = summaryBlock.suggestedAttachments!
                .filter((s) => !existingIds.has(s.attachmentId))
                .map((s) => ({ attachmentId: s.attachmentId, url: s.url, contentType: 'image/jpeg', sizeBytes: 0 }));
              return [...prev, ...additions].slice(0, MAX_ATTACHMENTS);
            });
          }
          setSummaryInitialized(true);
          break;
        }
      }
    }
  }, [conversation, sending, confirming, summaryInitialized]);

  const sendInput = async (
    type: 'QUICK_REPLY' | 'TEXT' | 'IMAGE',
    value: string,
    displayLabel?: string,
    imageUrl?: string,
    note?: string,
  ) => {
    if (!conversation || sending || conversation.status !== 'ACTIVE') return;
    const trimmed = value.trim();
    if (!trimmed) return;
    const trimmedNote = note?.trim() || undefined;
    setSending(true);
    try {
      const reply = await sendMaintenanceAssistantMessage(homeId, conversation.id, type, trimmed, trimmedNote);
      const nowIso = new Date().toISOString();
      setConversation((prev) => {
        if (!prev) return prev;
        const userBlocks: AssistantBlock[] = type === 'IMAGE' && imageUrl
          ? [
            { type: 'image', attachmentId: trimmed, url: imageUrl, caption: 'Ảnh thiết bị' },
            ...(trimmedNote ? [{ type: 'text' as const, text: trimmedNote }] : []),
          ]
          : [{ type: 'text', text: displayLabel ?? (type === 'IMAGE' ? '[Đã gửi ảnh thiết bị]' : trimmed) }];
        const userMsg = {
          id: `u-${crypto.randomUUID()}`,
          role: 'USER' as const,
          blocks: userBlocks,
          createdAt: nowIso,
        };
        const botMsg = {
          id: `a-${crypto.randomUUID()}`,
          role: 'ASSISTANT' as const,
          blocks: reply.blocks,
          createdAt: nowIso,
        };
        return {
          ...prev,
          state: reply.state,
          status: reply.status,
          ticketId: reply.ticketId,
          manualFallbackNote: reply.manualFallbackNote ?? prev.manualFallbackNote,
          aiTextEnabled: reply.aiTextEnabled ?? prev.aiTextEnabled,
          aiImageEnabled: reply.aiImageEnabled ?? prev.aiImageEnabled,
          deviceId: prev.state === 'SELECT_DEVICE' && type === 'QUICK_REPLY' ? trimmed : prev.deviceId,
          messages: [...prev.messages, userMsg, botMsg],
        };
      });
      if (type === 'TEXT' || type === 'IMAGE') setInput('');
      if (type === 'IMAGE') setPendingChatImage(null);
      if (type === 'QUICK_REPLY' && trimmed.startsWith('REMOVE_IMAGE:')) {
        const removedId = trimmed.substring('REMOVE_IMAGE:'.length);
        setAttachments((prev) => prev.filter((a) => a.attachmentId !== removedId));
      }
    } catch (error) {
      notify.error(getErrorMessage(error, 'Không gửi được tin nhắn, vui lòng thử lại.'));
    } finally {
      setSending(false);
    }
  };

  const handleChatImagePick = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !conversation || conversation.status !== 'ACTIVE') return;
    if (!ALLOWED_MIME.has(file.type)) {
      notify.error(`"${file.name}" không phải JPEG, PNG hoặc WebP.`);
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      notify.error(`"${file.name}" vượt quá 5 MB.`);
      return;
    }
    setUploadingImage(true);
    try {
      const prepared = await convertWebpToJpegIfNeeded(file);
      const uploaded = await uploadMaintenanceAttachment(homeId, prepared);
      setAttachments((prev) => (prev.length < MAX_ATTACHMENTS ? [...prev, uploaded] : prev));
      setPendingChatImage(uploaded);
    } catch (err) {
      notify.error(getErrorMessage(err, 'Không tải được ảnh lên hệ thống.'));
    } finally {
      setUploadingImage(false);
      if (chatImageInputRef.current) chatImageInputRef.current.value = '';
    }
  };

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = MAX_ATTACHMENTS - attachments.length;
    if (remaining <= 0) {
      notify.info(`Tối đa ${MAX_ATTACHMENTS} ảnh đính kèm.`);
      return;
    }
    setUploadingImage(true);
    try {
      for (const file of Array.from(files).slice(0, remaining)) {
        if (!ALLOWED_MIME.has(file.type)) {
          notify.error(`"${file.name}" không phải JPEG, PNG hoặc WebP.`);
          continue;
        }
        if (file.size > MAX_ATTACHMENT_BYTES) {
          notify.error(`"${file.name}" vượt quá 5 MB.`);
          continue;
        }
        try {
          const prepared = await convertWebpToJpegIfNeeded(file);
          const uploaded = await uploadMaintenanceAttachment(homeId, prepared);
          setAttachments((prev) => [...prev, uploaded]);
        } catch (err) {
          notify.error(getErrorMessage(err, `Không tải được ảnh "${file.name}".`));
        }
      }
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmTicket = async () => {
    if (!conversation || confirming) return;
    const problem = slotProblem(slots);
    if (problem) {
      notify.error(problem);
      return;
    }
    setConfirming(true);
    try {
      const res = await confirmMaintenanceAssistantTicket(homeId, conversation.id, {
        slots: slots.map(draftToSlot),
        contactPhone: contactPhone.trim() || undefined,
        attachmentIds: attachments.length > 0 ? attachments.map((a) => a.attachmentId) : undefined,
        editedSummary: editedSummary.trim() || undefined,
      });
      setConversation((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          state: res.state,
          status: res.status,
          ticketId: res.ticket.id,
          messages: [
            ...prev.messages,
            {
              id: `c-${crypto.randomUUID()}`,
              role: 'ASSISTANT',
              blocks: res.blocks,
              createdAt: new Date().toISOString(),
            },
          ],
        };
      });
      notify.success(`Đã tạo yêu cầu bảo trì ${res.ticket.code}`);
      onTicketCreated(res.ticket);
    } catch (error) {
      notify.error(getErrorMessage(error, 'Không thể tạo ticket bảo trì.'));
    } finally {
      setConfirming(false);
    }
  };

  const handleRestart = async () => {
    if (conversation && conversation.status === 'ACTIVE') {
      try {
        await abandonMaintenanceAssistant(homeId, conversation.id);
      } catch {
        // Ignore abandon error and start a fresh session
      }
    }
    setAttachments([]);
    setPendingChatImage(null);
    setSlots([newSlotDraft(1)]);
    setContactPhone('');
    setEditedSummary('');
    setSummaryInitialized(false);
    setFeedbackDraftRating(null);
    setFeedbackNote('');
    setFeedbackDismissed(false);
    void bootConversation(true);
  };

  const handleDeleteConversation = async () => {
    if (!conversation || sending || confirming) return;
    if (!window.confirm('Xoá lịch sử hội thoại này (và ảnh chưa đính ticket nếu có)?')) return;
    setSending(true);
    try {
      await deleteMaintenanceAssistantConversation(homeId, conversation.id);
      notify.success('Đã xoá lịch sử hội thoại');
      setAttachments([]);
      setSlots([newSlotDraft(1)]);
      setContactPhone('');
      setEditedSummary('');
      setSummaryInitialized(false);
      setFeedbackDraftRating(null);
      setFeedbackNote('');
      setFeedbackDismissed(false);
      await bootConversation(true);
    } catch (error) {
      notify.error(getErrorMessage(error, 'Không xoá được lịch sử hội thoại.'));
    } finally {
      setSending(false);
    }
  };

  const handleSubmitFeedback = async (rating: 1 | 5) => {
    if (!conversation || feedbackSending) return;
    setFeedbackSending(true);
    try {
      const res = await submitMaintenanceAssistantFeedback(homeId, conversation.id, rating, feedbackNote.trim() || undefined);
      setConversation((prev) => (prev ? { ...prev, userRating: res.userRating, userFeedbackNote: res.userFeedbackNote } : prev));
      setFeedbackDraftRating(null);
      setFeedbackNote('');
      notify.success('Cảm ơn bạn đã đánh giá!');
    } catch (error) {
      notify.error(getErrorMessage(error, 'Không gửi được đánh giá.'));
    } finally {
      setFeedbackSending(false);
    }
  };

  const handleRemoveUnattachedImage = async (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.attachmentId !== id));
    try {
      await deleteMaintenanceAttachment(homeId, id);
    } catch {
      // Ignore if already deleted or attached
    }
  };

  const slotError = slotProblem(slots);
  const isActive = conversation?.status === 'ACTIVE';
  const showAiBadges = conversation?.aiTextEnabled !== false;
  const isFinishedForFeedback = !!conversation
    && (conversation.status === 'RESOLVED' || conversation.status === 'ESCALATED' || conversation.state === 'TICKET_CREATED')
    && conversation.userRating == null
    && !feedbackDismissed;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs" role="dialog" aria-modal="true" aria-label="Trợ lý chẩn đoán bảo trì">
      <div className="w-full max-w-xl h-full bg-surface text-text border-l border-line shadow-2xl flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-line">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bot className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-bold truncate">Trợ lý chẩn đoán bảo trì</h2>
              <p className="text-xs text-muted truncate">Kiểm tra an toàn trước khi gọi kỹ thuật viên</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {conversation && (
              <button type="button" title="Xoá lịch sử hội thoại" aria-label="Xoá lịch sử hội thoại"
                disabled={sending || confirming}
                onClick={() => void handleDeleteConversation()}
                className="rounded-xl p-2 text-muted hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-40">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button type="button" title="Bắt đầu phiên mới" onClick={() => void handleRestart()}
              className="rounded-xl p-2 text-muted hover:bg-surface-hover hover:text-text">
              <RotateCcw className="w-4 h-4" />
            </button>
            <button type="button" aria-label="Đóng" onClick={onClose}
              className="rounded-xl p-2 text-muted hover:bg-surface-hover hover:text-text">
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Manual fallback bar */}
        <div className="px-4 py-2 bg-sidebar/60 border-b border-line flex items-center justify-between gap-2 text-xs">
          <span className="text-muted">Muốn bỏ qua chẩn đoán và điền form ngay?</span>
          <button type="button"
            onClick={() => onSwitchToManual(conversation?.deviceId ?? initialDeviceId, conversation?.manualFallbackNote ?? undefined)}
            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline shrink-0">
            <Wrench className="w-3.5 h-3.5" /> Chuyển sang form thủ công
          </button>
        </div>

        {/* Message stream */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {loading && (
            <div className="space-y-3">
              <div className="h-16 rounded-2xl bg-sidebar animate-pulse" />
              <div className="h-24 rounded-2xl bg-sidebar animate-pulse" />
            </div>
          )}

          {!loading && conversation?.messages.map((msg, msgIdx) => {
            const isLast = msgIdx === conversation.messages.length - 1;
            const isUser = msg.role === 'USER';
            return (
              <div key={msg.id} className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
                {msg.blocks.map((block, bIdx) => (
                  <AssistantBlockRenderer
                    key={`${msg.id}-${bIdx}`}
                    block={block}
                    isUser={isUser}
                    showAiBadge={showAiBadges}
                    interactive={isLast && isActive && !sending && !confirming}
                    slots={slots}
                    onSlotsChange={setSlots}
                    slotError={slotError}
                    contactPhone={contactPhone}
                    onContactPhoneChange={setContactPhone}
                    editedSummary={editedSummary}
                    onEditedSummaryChange={setEditedSummary}
                    attachments={attachments}
                    uploadingImage={uploadingImage}
                    onTriggerUpload={() => fileInputRef.current?.click()}
                    onRemoveAttachment={(id) => void handleRemoveUnattachedImage(id)}
                    confirming={confirming}
                    onQuickReply={(val, label) => void sendInput('QUICK_REPLY', val, label)}
                    onConfirmTicket={() => void handleConfirmTicket()}
                    onViewTicket={onViewTicket}
                  />
                ))}
              </div>
            );
          })}

          {!loading && isFinishedForFeedback && (
            <div className="rounded-2xl border border-line bg-sidebar/60 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-text">Trợ lý có hữu ích không?</p>
                <button type="button" onClick={() => setFeedbackDismissed(true)} className="text-[11px] text-muted hover:underline">
                  Bỏ qua
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" disabled={feedbackSending}
                  onClick={() => setFeedbackDraftRating(5)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                    feedbackDraftRating === 5 ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-line bg-surface text-text hover:border-emerald-500'
                  }`}>
                  <ThumbsUp className="w-3.5 h-3.5" /> Hữu ích
                </button>
                <button type="button" disabled={feedbackSending}
                  onClick={() => setFeedbackDraftRating(1)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                    feedbackDraftRating === 1 ? 'border-rose-600 bg-rose-600 text-white' : 'border-line bg-surface text-text hover:border-rose-500'
                  }`}>
                  <ThumbsDown className="w-3.5 h-3.5" /> Chưa hữu ích
                </button>
              </div>
              {feedbackDraftRating != null && (
                <div className="space-y-2">
                  <input
                    className={`${fieldClass} text-xs`}
                    maxLength={500}
                    value={feedbackNote}
                    onChange={(e) => setFeedbackNote(e.target.value)}
                    placeholder="Góp ý thêm (tùy chọn)…"
                  />
                  <div className="flex justify-end">
                    <button type="button" className={`${btnPrimary} text-xs py-1.5`} disabled={feedbackSending}
                      onClick={() => void handleSubmitFeedback(feedbackDraftRating)}>
                      {feedbackSending ? 'Đang gửi…' : 'Gửi đánh giá'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {sending && (
            <div className="inline-flex items-center gap-2 rounded-2xl border border-line bg-sidebar/60 px-3 py-2 text-xs text-muted">
              Đang xử lý…
            </div>
          )}
        </div>

        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
          onChange={(e) => void handleUploadFiles(e.target.files)} />
        <input ref={chatImageInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          onChange={(e) => void handleChatImagePick(e.target.files)} />

        {/* Staged image preview before sending */}
        {pendingChatImage && isActive && (
          <div className="px-3 pt-2.5 pb-1 border-t border-line bg-sidebar/50 flex items-center gap-2.5">
            <div className="relative h-14 w-14 shrink-0 rounded-xl overflow-hidden border border-line bg-surface">
              <AuthenticatedImage src={pendingChatImage.url} alt="Ảnh chờ gửi" className="w-full h-full object-cover" />
              <button
                type="button"
                aria-label="Gỡ ảnh chờ gửi"
                onClick={() => {
                  const id = pendingChatImage.attachmentId;
                  setPendingChatImage(null);
                  void handleRemoveUnattachedImage(id);
                }}
                className="absolute top-0.5 right-0.5 rounded-full bg-black/70 text-white p-0.5 hover:bg-black"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <p className="text-xs text-muted flex-1">
              Ảnh đã sẵn sàng. Nhập thêm mô tả vấn đề bên dưới rồi bấm <strong>Gửi</strong> (hoặc bấm Gửi ngay để chỉ gửi ảnh).
            </p>
          </div>
        )}

        {/* Input bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pendingChatImage) {
              void sendInput('IMAGE', pendingChatImage.attachmentId, undefined, pendingChatImage.url, input.trim() || undefined);
            } else {
              void sendInput('TEXT', input);
            }
          }}
          className="p-3 border-t border-line bg-surface flex items-center gap-2"
        >
          <button
            type="button"
            title="Chọn ảnh thiết bị để gửi kèm tin nhắn"
            aria-label="Gửi ảnh thiết bị"
            disabled={!isActive || sending || loading || uploadingImage || conversation?.state === 'SELECT_DEVICE'}
            onClick={() => chatImageInputRef.current?.click()}
            className="rounded-xl border border-line p-2.5 text-muted hover:bg-surface-hover hover:text-primary disabled:opacity-40"
          >
            <ImagePlus className="w-4 h-4" />
          </button>
          <input
            className={`${fieldClass} flex-1`}
            value={input}
            disabled={!isActive || sending || loading}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              !isActive
                ? 'Phiên chẩn đoán đã kết thúc'
                : pendingChatImage
                  ? 'Nhập mô tả vấn đề kèm ảnh này (tùy chọn)…'
                  : 'Nhập thêm mô tả sự cố (tùy chọn)…'
            }
            maxLength={1000}
          />
          <button type="submit" disabled={!isActive || sending || loading || uploadingImage || (!input.trim() && !pendingChatImage)} className={btnPrimary}>
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

interface RendererProps {
  block: AssistantBlock;
  isUser: boolean;
  showAiBadge?: boolean;
  interactive: boolean;
  slots: SlotDraft[];
  onSlotsChange: (next: SlotDraft[]) => void;
  slotError: string | null;
  contactPhone: string;
  onContactPhoneChange: (v: string) => void;
  editedSummary?: string;
  onEditedSummaryChange?: (v: string) => void;
  attachments: UploadedMaintenanceAttachment[];
  uploadingImage: boolean;
  onTriggerUpload: () => void;
  onRemoveAttachment: (id: string) => void;
  confirming: boolean;
  onQuickReply: (value: string, label: string) => void;
  onConfirmTicket: () => void;
  onViewTicket: (ticketId: string) => void;
}

export function AssistantBlockRenderer(props: RendererProps) {
  const { block, isUser, interactive } = props;

  if (block.type === 'text') {
    if (isUser) {
      return (
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary text-white px-3.5 py-2 text-sm whitespace-pre-line">
          {block.text}
        </div>
      );
    }
    const toneClass = textToneClass[block.tone ?? 'default'] ?? textToneClass.default;
    return (
      <div className={`max-w-[92%] rounded-2xl rounded-bl-sm border px-3.5 py-2.5 text-sm whitespace-pre-line ${toneClass}`}>
        {block.aiGenerated && props.showAiBadge !== false && (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 border border-indigo-500/25 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 mb-1.5">
            <Bot className="w-3 h-3" aria-hidden="true" /> Trợ lý AI
          </span>
        )}
        {block.tone === 'danger' && (
          <span className="inline-flex items-center gap-1 font-bold text-rose-600 mb-1">
            <AlertTriangle className="w-4 h-4" /> CẢNH BÁO AN TOÀN
          </span>
        )}
        <p>{block.text}</p>
      </div>
    );
  }

  if (block.type === 'image') {
    return (
      <div className="max-w-[260px] rounded-2xl overflow-hidden border border-line bg-surface shadow-xs">
        <AuthenticatedImage
          src={block.url}
          alt={block.caption ?? 'Ảnh thiết bị'}
          className="w-full max-h-[240px] object-cover block"
        />
      </div>
    );
  }

  if (block.type === 'device_card') {
    return <DeviceCardView block={block} />;
  }

  if (block.type === 'device_picker') {
    return <DevicePickerView block={block} interactive={interactive} onSelect={props.onQuickReply} />;
  }

  if (block.type === 'quick_replies') {
    return <QuickRepliesView block={block} interactive={interactive} onSelect={props.onQuickReply} />;
  }

  if (block.type === 'slot_picker') {
    if (!interactive) return null;
    return (
      <div className="w-full rounded-2xl border border-line bg-sidebar/40 p-3.5 space-y-3">
        <p className="text-xs text-muted">{block.prompt}</p>
        <SlotEditorInline value={props.slots} onChange={props.onSlotsChange} />
        <div className="space-y-2 pt-1 border-t border-line/60">
          <label className="block">
            <span className="text-xs font-semibold text-text">Số điện thoại liên hệ (tùy chọn)</span>
            <input className={fieldClass} type="tel" maxLength={20} value={props.contactPhone}
              onChange={(e) => props.onContactPhoneChange(e.target.value)}
              placeholder="Mặc định dùng số trong hồ sơ" />
          </label>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">Ảnh hiện trạng ({props.attachments.length}/{MAX_ATTACHMENTS})</span>
            {props.attachments.length < MAX_ATTACHMENTS && (
              <button type="button" disabled={props.uploadingImage} onClick={props.onTriggerUpload}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                <ImagePlus className="w-3.5 h-3.5" /> {props.uploadingImage ? 'Đang tải…' : 'Đính kèm ảnh'}
              </button>
            )}
          </div>
          {props.attachments.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {props.attachments.map((att) => (
                <div key={att.attachmentId} className="relative rounded-lg overflow-hidden border border-line aspect-square">
                  <AuthenticatedImage src={att.url} alt="Ảnh sự cố" className="w-full h-full object-cover" />
                  <button type="button" aria-label="Xoá ảnh" onClick={() => props.onRemoveAttachment(att.attachmentId)}
                    className="absolute top-0.5 right-0.5 rounded-full bg-black/70 text-white p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (block.type === 'ticket_summary') {
    return (
      <TicketSummaryView
        block={block}
        interactive={interactive}
        slotError={props.slotError}
        confirming={props.confirming}
        uploadingImage={props.uploadingImage}
        editedSummary={props.editedSummary ?? ''}
        onEditedSummaryChange={props.onEditedSummaryChange}
        onConfirm={props.onConfirmTicket}
      />
    );
  }

  if (block.type === 'ticket_created') {
    return <TicketCreatedView block={block} onViewTicket={props.onViewTicket} />;
  }

  if (block.type === 'privacy_notice') {
    return <PrivacyNoticeView block={block} interactive={interactive} onQuickReply={props.onQuickReply} />;
  }

  if (block.type === 'image_analysis') {
    return (
      <ImageAnalysisView
        block={block}
        interactive={interactive}
        onTriggerRetake={props.onTriggerUpload}
      />
    );
  }

  return null;
}

function PrivacyNoticeView({
  block,
  interactive,
  onQuickReply,
}: {
  block: AssistantPrivacyNoticeBlock;
  interactive: boolean;
  onQuickReply: (value: string, label: string) => void;
}) {
  return (
    <div className="w-full rounded-2xl border border-[#f59e0b]/50 bg-[#fffbeb] p-3.5 space-y-2.5 text-[#1e293b]">
      <p className="text-xs font-bold uppercase text-[#92400e]">Thông báo quyền riêng tư hình ảnh</p>
      <p className="text-xs text-text whitespace-pre-line">{block.text}</p>
      {interactive && (
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" className={btnPrimary}
            onClick={() => onQuickReply(block.acceptValue, 'Đồng ý gửi ảnh để AI phân tích')}>
            Đồng ý phân tích bằng AI
          </button>
          <button type="button" className={btnGhost}
            onClick={() => onQuickReply(block.declineValue, 'Không phân tích AI, chỉ đính kèm ảnh')}>
            Không đồng ý (chỉ đính kèm ticket)
          </button>
        </div>
      )}
    </div>
  );
}

function ImageAnalysisView({
  block,
  interactive,
  onTriggerRetake,
}: {
  block: AssistantImageAnalysisBlock;
  interactive: boolean;
  onTriggerRetake: () => void;
}) {
  return (
    <div className="w-full rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-3.5 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 border border-indigo-500/25 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">
          <Bot className="w-3 h-3" aria-hidden="true" /> Trợ lý AI
        </span>
        <span className="text-[11px] font-medium text-[#92400e]">
          Quan sát sơ bộ — chưa được kiểm chứng
        </span>
      </div>
      {block.observations && block.observations.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-text">Trợ lý quan sát thấy (chưa được kiểm chứng):</p>
          <ul className="list-disc pl-4 text-xs text-text space-y-0.5">
            {block.observations.map((obs, idx) => <li key={idx}>{obs}</li>)}
          </ul>
        </div>
      )}
      <p className="text-xs text-text whitespace-pre-line">{block.staticAdvice}</p>
      {interactive && (block.decision === 'RETAKE_NEEDED' || block.decision === 'PRIVACY_REJECT_PEOPLE_OR_DOCS') && (
        <div className="pt-1">
          <button type="button" onClick={onTriggerRetake} className={`${btnGhost} text-xs py-1.5`}>
            Chụp / chọn ảnh khác
          </button>
        </div>
      )}
    </div>
  );
}

function DeviceCardView({ block }: { block: AssistantDeviceCardBlock }) {
  const isOffline = block.status === 'OFFLINE';
  return (
    <div className="w-full rounded-2xl border border-line bg-surface p-3.5 space-y-2 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold truncate">{block.name}</p>
          <p className="text-xs text-muted truncate">
            {[block.roomName, block.deviceType, block.model].filter(Boolean).join(' · ')}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
          block.status === 'ONLINE'
            ? 'bg-emerald-500/10 text-emerald-600'
            : 'bg-rose-500/10 text-rose-600'
        }`}>
          {isOffline ? 'Mất kết nối' : block.status === 'ONLINE' ? 'Trực tuyến' : block.status}
        </span>
      </div>
      <div className="text-xs text-muted space-y-0.5">
        {block.offlineDurationLabel && <p>Thời gian mất kết nối: <strong className="text-rose-600">{block.offlineDurationLabel}</strong></p>}
        {block.healthPercent != null && (
          <p>Sức khỏe phần cứng: <strong>{block.healthPercent}%</strong> ({block.switchCycles ?? 0} chu kỳ)</p>
        )}
        {block.chatteringWarning && <p className="text-amber-600 font-semibold">Cảnh báo: Relay đóng cắt bất thường</p>}
        {block.openAnomalies && block.openAnomalies.length > 0 && (
          <p className="text-amber-600">Cảnh báo đang mở: {block.openAnomalies.map((a) => a.reason || a.type).join('; ')}</p>
        )}
      </div>
    </div>
  );
}

function DevicePickerView({
  block,
  interactive,
  onSelect,
}: {
  block: AssistantDevicePickerBlock;
  interactive: boolean;
  onSelect: (id: string, name: string) => void;
}) {
  const [query, setQuery] = useState('');
  if (!interactive) return null;
  const showSearch = block.devices.length > 6;
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? block.devices.filter((d) =>
      `${d.name} ${d.roomName ?? ''} ${d.deviceType ?? ''} ${d.model ?? ''}`.toLowerCase().includes(needle))
    : block.devices;

  return (
    <div className="w-full space-y-2">
      {showSearch && (
        <label className="relative block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            className={`${fieldClass} pl-9`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm thiết bị theo tên, phòng, loại…"
            aria-label="Tìm thiết bị trong trợ lý"
          />
        </label>
      )}
      <div className="w-full rounded-2xl border border-line divide-y divide-line/60 bg-surface">
        {visible.length === 0 && <p className="p-3 text-xs text-muted">Không tìm thấy thiết bị phù hợp.</p>}
        {visible.map((d) => (
          <button key={d.deviceId} type="button" onClick={() => onSelect(d.deviceId, d.name)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-surface-hover">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{d.name}</p>
              <p className="text-xs text-muted truncate">{[d.roomName, d.deviceType].filter(Boolean).join(' · ')}</p>
            </div>
            {d.status !== 'ONLINE' && (
              <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 bg-rose-500/10 text-rose-600">
                {d.status === 'OFFLINE' ? 'Mất kết nối' : d.status}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function QuickRepliesView({
  block,
  interactive,
  onSelect,
}: {
  block: AssistantQuickRepliesBlock;
  interactive: boolean;
  onSelect: (value: string, label: string) => void;
}) {
  if (!interactive) return null;
  const normalOptions = block.options.filter((opt) => opt.tone !== 'danger');
  const dangerOptions = block.options.filter((opt) => opt.tone === 'danger');

  return (
    <div className="w-full space-y-2">
      <div className="w-full flex flex-wrap gap-2">
        {normalOptions.map((opt) => {
          const tone = opt.tone === 'primary'
            ? 'border-primary bg-primary text-white hover:bg-primary-hover'
            : 'border-line bg-surface text-text hover:border-primary hover:bg-primary/5';
          return (
            <button key={opt.value} type="button" onClick={() => onSelect(opt.value, opt.label)}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold text-left transition-colors ${tone}`}>
              {opt.label}
            </button>
          );
        })}
      </div>
      {dangerOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {dangerOptions.map((opt) => (
            <button key={opt.value} type="button" onClick={() => onSelect(opt.value, opt.label)}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-500/35 bg-rose-500/5 px-2.5 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-500/15 transition-colors text-left">
              <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TicketSummaryView({
  block,
  interactive,
  slotError,
  confirming,
  uploadingImage,
  editedSummary,
  onEditedSummaryChange,
  onConfirm,
}: {
  block: AssistantTicketSummaryBlock;
  interactive: boolean;
  slotError: string | null;
  confirming: boolean;
  uploadingImage: boolean;
  editedSummary: string;
  onEditedSummaryChange?: (v: string) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="w-full rounded-2xl border border-primary/30 bg-primary/5 p-3.5 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold">{block.title}</p>
        <PriorityPill priority={block.priority} />
      </div>
      <p className="text-xs text-muted whitespace-pre-line">{block.diagnosisSummary}</p>
      {block.aiSummary && (
        <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/5 p-2.5 space-y-1">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-indigo-600">
            <Bot className="w-3 h-3" aria-hidden="true" /> AI tóm tắt
          </span>
          <p className="text-xs text-text whitespace-pre-line">{block.aiSummary}</p>
        </div>
      )}
      {interactive && onEditedSummaryChange && (
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-text">
            Chỉnh sửa ghi chú / tóm tắt gửi kỹ thuật viên (tùy chọn)
          </span>
          <textarea
            className={`${fieldClass} min-h-[64px] text-xs`}
            maxLength={1500}
            value={editedSummary}
            onChange={(e) => onEditedSummaryChange(e.target.value)}
            placeholder="Bổ sung hoặc chỉnh sửa mô tả của bạn trước khi gửi yêu cầu…"
          />
        </label>
      )}
      {interactive && (
        <div className="pt-1 flex justify-end">
          <button type="button" className={btnPrimary}
            disabled={confirming || uploadingImage || !!slotError}
            onClick={onConfirm}>
            {confirming ? 'Đang tạo yêu cầu…' : 'Xác nhận tạo yêu cầu bảo trì'}
          </button>
        </div>
      )}
    </div>
  );
}

function TicketCreatedView({
  block,
  onViewTicket,
}: {
  block: AssistantTicketCreatedBlock;
  onViewTicket: (ticketId: string) => void;
}) {
  return (
    <div className="w-full rounded-2xl border border-emerald-300 bg-emerald-50 p-3.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-800">
          <CheckCircle2 className="w-4 h-4" /> {block.code}
        </span>
        {block.status && <StatusPill status={block.status} />}
      </div>
      <p className="text-xs text-text">{block.title}</p>
      <button type="button" onClick={() => onViewTicket(block.ticketId)}
        className={`${btnGhost} inline-flex items-center gap-1.5 text-xs py-1.5`}>
        <ExternalLink className="w-3.5 h-3.5" /> Xem chi tiết ticket
      </button>
    </div>
  );
}

function SlotEditorInline({ value, onChange }: { value: SlotDraft[]; onChange: (next: SlotDraft[]) => void }) {
  return <SlotEditor value={value} onChange={onChange} />;
}
