import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import {
  approveMaintenanceQuote,
  cancelMaintenanceTicket,
  confirmMaintenanceSchedule,
  getMaintenanceTicket,
  rejectMaintenanceQuote,
  rescheduleMaintenance,
  sendMaintenanceFeedback,
} from '../../services/maintenanceApi';
import type { MaintenanceTicket } from '../../types/maintenance';
import { getErrorMessage } from '../../utils/errors';
import { notify } from '../ui/notify';
import { MaintenanceModal, btnDanger, btnGhost, btnPrimary, fieldClass } from './MaintenanceModal';
import { SlotEditor } from './SlotEditor';
import { TicketDetailView } from './TicketDetailView';
import { draftToSlot, formatMoney, newSlotDraft, slotProblem, type SlotDraft } from './maintenanceFormat';

interface Props {
  homeId: string;
  ticketId: string;
  onClose: () => void;
  onChanged: () => void;
}

type Panel = 'none' | 'reschedule' | 'cancel' | 'rejectQuote';

export function MaintenanceDetailModal({ homeId, ticketId, onClose, onChanged }: Props) {
  const [ticket, setTicket] = useState<MaintenanceTicket | null>(null);
  const [panel, setPanel] = useState<Panel>('none');
  const [note, setNote] = useState('');
  const [slots, setSlots] = useState<SlotDraft[]>([newSlotDraft(1)]);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getMaintenanceTicket(homeId, ticketId)
      .then((t) => { if (active) setTicket(t); })
      .catch((error: unknown) => { notify.error(getErrorMessage(error, 'Không tải được ticket.')); onClose(); });
    return () => { active = false; };
  }, [homeId, ticketId, onClose]);

  const run = async (action: () => Promise<MaintenanceTicket>, success: string) => {
    setBusy(true);
    try {
      setTicket(await action());
      setPanel('none');
      setNote('');
      notify.success(success);
      onChanged();
    } catch (error) {
      notify.error(getErrorMessage(error, 'Thao tác không thành công.'));
    } finally {
      setBusy(false);
    }
  };

  if (!ticket) {
    return <MaintenanceModal title="Đang tải…" onClose={onClose}><div className="h-40 animate-pulse rounded-2xl bg-sidebar" /></MaintenanceModal>;
  }

  const s = ticket.status;
  const canCancel = ticket.canManage && (s === 'SUBMITTED' || s === 'SCHEDULED' || s === 'RESCHEDULE_REQUESTED');
  const canFeedback = ticket.canManage && (s === 'COMPLETED' || s === 'CLOSED') && !ticket.rating;
  const slotError = slotProblem(slots);

  const footer = ticket.canManage ? (
    <>
      {canCancel && panel === 'none' && <button type="button" className={btnDanger} onClick={() => setPanel('cancel')}>Huỷ yêu cầu</button>}
      {s === 'SCHEDULED' && panel === 'none' && <button type="button" className={btnGhost} onClick={() => setPanel('reschedule')}>Đổi lịch</button>}
      {s === 'SCHEDULED' && !ticket.scheduleConfirmed && panel === 'none' && (
        <button type="button" className={btnPrimary} disabled={busy}
          onClick={() => void run(() => confirmMaintenanceSchedule(homeId, ticket.id), 'Đã xác nhận lịch hẹn')}>Xác nhận lịch</button>
      )}
      {s === 'QUOTED' && panel === 'none' && <>
        <button type="button" className={btnDanger} onClick={() => setPanel('rejectQuote')}>Từ chối báo giá</button>
        <button type="button" className={btnPrimary} disabled={busy}
          onClick={() => void run(() => approveMaintenanceQuote(homeId, ticket.id), 'Đã duyệt báo giá, kỹ thuật viên sẽ tiến hành sửa')}>
          Đồng ý {formatMoney(ticket.quote?.total)}
        </button>
      </>}
    </>
  ) : undefined;

  return (
    <MaintenanceModal wide title={`${ticket.code} · ${ticket.title}`} onClose={onClose} footer={footer}>
      {!ticket.canManage && (
        <p className="rounded-xl border border-line bg-sidebar/60 p-3 text-xs text-muted">
          Chỉ chủ nhà hoặc người tạo yêu cầu mới có thể xác nhận lịch, duyệt báo giá hoặc huỷ.
        </p>
      )}

      {panel === 'reschedule' && (
        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          <SlotEditor value={slots} onChange={setSlots} />
          <input className={fieldClass} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú cho kỹ thuật viên (tuỳ chọn)" />
          <div className="flex justify-end gap-2">
            <button type="button" className={btnGhost} onClick={() => setPanel('none')}>Đóng</button>
            <button type="button" className={btnPrimary} disabled={busy || !!slotError}
              onClick={() => void run(() => rescheduleMaintenance(homeId, ticket.id, slots.map(draftToSlot), note.trim() || undefined), 'Đã gửi khung giờ mới')}>
              Gửi khung giờ mới
            </button>
          </div>
        </section>
      )}

      {(panel === 'cancel' || panel === 'rejectQuote') && (
        <section className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 space-y-3">
          <p className="text-sm font-semibold">{panel === 'cancel' ? 'Huỷ yêu cầu bảo trì này?' : 'Từ chối báo giá? Ticket sẽ được đóng và thiết bị không được sửa.'}</p>
          <input className={fieldClass} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Lý do (tuỳ chọn)" />
          <div className="flex justify-end gap-2">
            <button type="button" className={btnGhost} onClick={() => setPanel('none')}>Quay lại</button>
            <button type="button" className={btnDanger} disabled={busy}
              onClick={() => void (panel === 'cancel'
                ? run(() => cancelMaintenanceTicket(homeId, ticket.id, note.trim() || undefined), 'Đã huỷ yêu cầu')
                : run(() => rejectMaintenanceQuote(homeId, ticket.id, note.trim() || undefined), 'Đã từ chối báo giá'))}>
              Xác nhận
            </button>
          </div>
        </section>
      )}

      <TicketDetailView ticket={ticket} />

      {canFeedback && (
        <section className="rounded-2xl border border-line p-4 space-y-3">
          <p className="text-sm font-semibold">Đánh giá dịch vụ</p>
          <div className="flex gap-1" role="radiogroup" aria-label="Số sao">
            {[1, 2, 3, 4, 5].map((value) => (
              <button key={value} type="button" role="radio" aria-checked={rating === value} aria-label={`${value} sao`} onClick={() => setRating(value)}>
                <Star className={`w-6 h-6 ${value <= rating ? 'fill-amber-400 text-amber-400' : 'text-line'}`} />
              </button>
            ))}
          </div>
          <input className={fieldClass} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Nhận xét (tuỳ chọn)" />
          <div className="flex justify-end">
            <button type="button" className={btnPrimary} disabled={busy || rating === 0}
              onClick={() => void run(() => sendMaintenanceFeedback(homeId, ticket.id, rating, comment.trim() || undefined), 'Cảm ơn bạn đã đánh giá')}>
              Gửi đánh giá
            </button>
          </div>
        </section>
      )}
    </MaintenanceModal>
  );
}
