import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  adminCompleteMaintenance,
  adminGetMaintenanceTicket,
  adminRateDiagnosisQuality,
  adminRejectMaintenance,
  adminScheduleMaintenance,
  adminStartInspection,
  adminSubmitQuote,
} from '../../services/maintenanceApi';
import type { MaintenanceDiagnosisQuality, MaintenanceItemType, MaintenanceOutcome, MaintenanceTicket } from '../../types/maintenance';
import { getErrorMessage } from '../../utils/errors';
import { notify } from '../ui/notify';
import { MaintenanceModal, btnDanger, btnGhost, btnPrimary, fieldClass, labelClass } from './MaintenanceModal';
import { TicketDetailView } from './TicketDetailView';
import { ITEM_TYPE_LABEL, OUTCOME_LABEL, formatMoney, formatRange, toDateInput } from './maintenanceFormat';

interface Props {
  ticketId: string;
  onClose: () => void;
  onChanged: () => void;
}

interface QuoteRow { key: string; ticketDeviceId: string; itemType: MaintenanceItemType; description: string; quantity: string; unitPrice: string }

const pad = (n: number) => String(n).padStart(2, '0');
const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const newRow = (): QuoteRow => ({ key: crypto.randomUUID(), ticketDeviceId: '', itemType: 'PART', description: '', quantity: '1', unitPrice: '0' });

export function AdminMaintenanceModal({ ticketId, onClose, onChanged }: Props) {
  const [ticket, setTicket] = useState<MaintenanceTicket | null>(null);
  const [busy, setBusy] = useState(false);

  // Schedule form
  const [date, setDate] = useState('');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const [scheduleNote, setScheduleNote] = useState('');
  // Quote form
  const [findings, setFindings] = useState('');
  const [warranty, setWarranty] = useState('3');
  const [rows, setRows] = useState<QuoteRow[]>([newRow()]);
  // Complete form
  const [outcomes, setOutcomes] = useState<Record<string, { outcome: MaintenanceOutcome; note: string }>>({});
  const [finalNote, setFinalNote] = useState('');
  const [rejectNote, setRejectNote] = useState('');
  const [showReject, setShowReject] = useState(false);
  // Diagnosis quality rating (for CHATBOT tickets)
  const [diagQuality, setDiagQuality] = useState<MaintenanceDiagnosisQuality | ''>('');
  const [diagQualityNote, setDiagQualityNote] = useState('');

  const hydrate = (t: MaintenanceTicket) => {
    setTicket(t);
    setDiagQuality(t.diagnosisQuality ?? '');
    setDiagQualityNote(t.diagnosisQualityNote ?? '');
    const first = t.scheduledStart ? { s: t.scheduledStart, e: t.scheduledEnd ?? t.scheduledStart } : t.slots[0] && { s: t.slots[0].startAt, e: t.slots[0].endAt };
    if (first) applySlot(first.s, first.e);
    if (t.quote) {
      setFindings(t.quote.findings);
      setWarranty(String(t.quote.warrantyMonths ?? 0));
      setRows(t.quote.items.map((i) => ({
        key: i.id, ticketDeviceId: i.ticketDeviceId ?? '', itemType: i.itemType, description: i.description,
        quantity: String(i.quantity), unitPrice: String(i.unitPrice),
      })));
    }
    setOutcomes(Object.fromEntries(t.devices.map((d) => [d.id, { outcome: d.outcome ?? 'FIXED', note: d.outcomeNote ?? '' }])));
  };

  useEffect(() => {
    let active = true;
    adminGetMaintenanceTicket(ticketId)
      .then((t) => { if (active) hydrate(t); })
      .catch((error: unknown) => { notify.error(getErrorMessage(error, 'Không tải được ticket.')); onClose(); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate only on (re)open
  }, [ticketId, onClose]);

  function applySlot(s: string, e: string) {
    const sd = new Date(s);
    const ed = new Date(e);
    setDate(toDateInput(sd));
    setStart(toTimeInput(sd));
    setEnd(toTimeInput(ed));
  }

  const run = async (action: () => Promise<MaintenanceTicket>, success: string) => {
    setBusy(true);
    try {
      hydrate(await action());
      setShowReject(false);
      notify.success(success);
      onChanged();
    } catch (error) {
      notify.error(getErrorMessage(error, 'Thao tác không thành công.'));
    } finally {
      setBusy(false);
    }
  };

  // Display only; the backend recomputes every amount.
  const previewTotal = useMemo(() => rows.reduce((sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0), 0), [rows]);

  if (!ticket) {
    return <MaintenanceModal title="Đang tải…" onClose={onClose}><div className="h-40 animate-pulse rounded-2xl bg-sidebar" /></MaintenanceModal>;
  }

  const s = ticket.status;
  const canSchedule = s === 'SUBMITTED' || s === 'RESCHEDULE_REQUESTED' || s === 'SCHEDULED';
  const canQuote = s === 'INSPECTING' || s === 'QUOTED';
  const canComplete = s === 'INSPECTING' || s === 'REPAIRING';
  const quoteValid = findings.trim() && rows.length > 0 && rows.every((r) => r.description.trim() && Number(r.quantity) >= 1 && Number(r.unitPrice) >= 0);

  const submitSchedule = () => {
    const startAt = new Date(`${date}T${start}:00`);
    const endAt = new Date(`${date}T${end}:00`);
    if (!date || Number.isNaN(startAt.getTime()) || endAt <= startAt) { notify.error('Khung giờ hẹn không hợp lệ.'); return; }
    void run(() => adminScheduleMaintenance(ticket.id, startAt.toISOString(), endAt.toISOString(), scheduleNote.trim() || undefined),
      'Đã gửi lịch hẹn cho người dùng');
  };

  const submitQuote = () => void run(() => adminSubmitQuote(ticket.id, {
    findings: findings.trim(),
    warrantyMonths: Number(warranty) || 0,
    items: rows.map((r) => ({
      ticketDeviceId: r.ticketDeviceId || null,
      itemType: r.itemType,
      description: r.description.trim(),
      quantity: Number(r.quantity),
      unitPrice: Number(r.unitPrice),
    })),
  }), 'Đã gửi báo giá cho người dùng');

  const submitComplete = () => void run(() => adminCompleteMaintenance(ticket.id, {
    devices: ticket.devices.map((d) => ({ ticketDeviceId: d.id, outcome: outcomes[d.id].outcome, note: outcomes[d.id].note.trim() || undefined })),
    note: finalNote.trim() || undefined,
  }), 'Đã hoàn tất ticket');

  const panel = 'rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3';

  return (
    <MaintenanceModal wide title={`${ticket.code} · ${ticket.title}`} subtitle={ticket.homeName} onClose={onClose}
      footer={<>
        {canSchedule && !showReject && <button type="button" className={btnDanger} onClick={() => setShowReject(true)}>Từ chối ticket</button>}
        {s === 'SCHEDULED' && (
          <button type="button" className={btnPrimary} disabled={busy || !ticket.scheduleConfirmed}
            title={ticket.scheduleConfirmed ? undefined : 'Chờ người dùng xác nhận lịch'}
            onClick={() => void run(() => adminStartInspection(ticket.id), 'Đã chuyển sang đang kiểm tra')}>
            Bắt đầu kiểm tra
          </button>
        )}
        <button type="button" className={btnGhost} onClick={onClose}>Đóng</button>
      </>}>

      {showReject && (
        <section className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 space-y-3">
          <input className={fieldClass} maxLength={1000} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="Lý do từ chối (gửi cho người dùng)" />
          <div className="flex justify-end gap-2">
            <button type="button" className={btnGhost} onClick={() => setShowReject(false)}>Quay lại</button>
            <button type="button" className={btnDanger} disabled={busy}
              onClick={() => void run(() => adminRejectMaintenance(ticket.id, rejectNote.trim() || undefined), 'Đã từ chối ticket')}>Xác nhận từ chối</button>
          </div>
        </section>
      )}

      {canSchedule && (
        <section className={panel}>
          <h3 className="text-sm font-bold">{s === 'SCHEDULED' ? 'Đổi lịch hẹn' : 'Xếp lịch kiểm tra'}</h3>
          {ticket.slots.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {ticket.slots.map((slot) => (
                <button key={slot.id ?? slot.startAt} type="button" className="rounded-xl border border-line bg-surface px-2.5 py-1 text-xs hover:border-primary"
                  onClick={() => applySlot(slot.startAt, slot.endAt)}>
                  {formatRange(slot.startAt, slot.endAt)}
                </button>
              ))}
            </div>
          )}
          <p className="text-xs text-muted">Chọn trong khung rảnh của người dùng thì lịch được xác nhận ngay; chọn giờ khác thì người dùng cần xác nhận.</p>
          <div className="flex flex-wrap items-end gap-2">
            <label><span className={labelClass}>Ngày</span><input type="date" className={fieldClass} value={date} onChange={(e) => setDate(e.target.value)} /></label>
            <label><span className={labelClass}>Từ</span><input type="time" className={fieldClass} value={start} step={900} onChange={(e) => setStart(e.target.value)} /></label>
            <label><span className={labelClass}>Đến</span><input type="time" className={fieldClass} value={end} step={900} onChange={(e) => setEnd(e.target.value)} /></label>
          </div>
          <input className={fieldClass} maxLength={1000} value={scheduleNote} onChange={(e) => setScheduleNote(e.target.value)} placeholder="Ghi chú cho người dùng (kỹ thuật viên, dụng cụ cần chuẩn bị…)" />
          <div className="flex justify-end"><button type="button" className={btnPrimary} disabled={busy} onClick={submitSchedule}>Gửi lịch hẹn</button></div>
        </section>
      )}

      {canQuote && (
        <section className={panel}>
          <h3 className="text-sm font-bold">{s === 'QUOTED' ? 'Sửa báo giá (người dùng chưa duyệt)' : 'Kết quả kiểm tra & báo giá'}</h3>
          <textarea className={`${fieldClass} min-h-[72px]`} maxLength={4000} value={findings} onChange={(e) => setFindings(e.target.value)} placeholder="Tình trạng hư hỏng phát hiện được" />
          <div className="space-y-2">
            {rows.map((row, index) => (
              <div key={row.key} className="grid gap-2 sm:grid-cols-[110px_1fr_140px_70px_120px_auto] items-center">
                <select aria-label={`Loại hạng mục ${index + 1}`} className={fieldClass} value={row.itemType}
                  onChange={(e) => setRows((rs) => rs.map((r) => (r.key === row.key ? { ...r, itemType: e.target.value as MaintenanceItemType } : r)))}>
                  {Object.entries(ITEM_TYPE_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
                <input aria-label={`Mô tả hạng mục ${index + 1}`} className={fieldClass} maxLength={255} value={row.description} placeholder="Mô tả"
                  onChange={(e) => setRows((rs) => rs.map((r) => (r.key === row.key ? { ...r, description: e.target.value } : r)))} />
                <select aria-label={`Thiết bị của hạng mục ${index + 1}`} className={fieldClass} value={row.ticketDeviceId}
                  onChange={(e) => setRows((rs) => rs.map((r) => (r.key === row.key ? { ...r, ticketDeviceId: e.target.value } : r)))}>
                  <option value="">Chung</option>
                  {ticket.devices.map((d) => <option key={d.id} value={d.id}>{d.deviceName}</option>)}
                </select>
                <input aria-label={`Số lượng hạng mục ${index + 1}`} type="number" min={1} max={1000} className={fieldClass} value={row.quantity}
                  onChange={(e) => setRows((rs) => rs.map((r) => (r.key === row.key ? { ...r, quantity: e.target.value } : r)))} />
                <input aria-label={`Đơn giá hạng mục ${index + 1}`} type="number" min={0} step={1000} className={fieldClass} value={row.unitPrice}
                  onChange={(e) => setRows((rs) => rs.map((r) => (r.key === row.key ? { ...r, unitPrice: e.target.value } : r)))} />
                <button type="button" aria-label={`Xoá hạng mục ${index + 1}`} disabled={rows.length === 1}
                  className="rounded-xl p-2 text-muted hover:text-rose-600 disabled:opacity-40" onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-primary" onClick={() => setRows((rs) => [...rs, newRow()])}>
              <Plus className="w-3.5 h-3.5" /> Thêm hạng mục
            </button>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label><span className={labelClass}>Bảo hành (tháng)</span>
              <input type="number" min={0} max={60} className={fieldClass.replace('w-full', 'w-28')} value={warranty} onChange={(e) => setWarranty(e.target.value)} /></label>
            <p className="text-sm">Tạm tính: <strong>{formatMoney(previewTotal)}</strong></p>
            <button type="button" className={btnPrimary} disabled={busy || !quoteValid} onClick={submitQuote}>Gửi báo giá</button>
          </div>
        </section>
      )}

      {canComplete && (
        <section className={panel}>
          <h3 className="text-sm font-bold">Hoàn tất & kết luận từng thiết bị</h3>
          {s === 'INSPECTING' && <p className="text-xs text-muted">Không cần sửa/không phát sinh chi phí thì có thể hoàn tất luôn mà không gửi báo giá.</p>}
          {ticket.devices.map((d) => (
            <div key={d.id} className="grid gap-2 sm:grid-cols-[1fr_180px_1fr] items-center">
              <span className="text-sm font-semibold">{d.deviceName}</span>
              <select aria-label={`Kết luận ${d.deviceName}`} className={fieldClass} value={outcomes[d.id]?.outcome ?? 'FIXED'}
                onChange={(e) => setOutcomes((o) => ({ ...o, [d.id]: { ...o[d.id], outcome: e.target.value as MaintenanceOutcome } }))}>
                {Object.entries(OUTCOME_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
              <input aria-label={`Ghi chú ${d.deviceName}`} className={fieldClass} maxLength={1000} value={outcomes[d.id]?.note ?? ''} placeholder="Đã làm gì"
                onChange={(e) => setOutcomes((o) => ({ ...o, [d.id]: { ...o[d.id], note: e.target.value } }))} />
            </div>
          ))}
          <input className={fieldClass} maxLength={2000} value={finalNote} onChange={(e) => setFinalNote(e.target.value)} placeholder="Ghi chú tổng kết (tuỳ chọn)" />
          <p className="text-xs text-muted">Thiết bị kết luận "Đã sửa / Thay mới / Không phát hiện lỗi" sẽ tự đóng các cảnh báo bất thường đang mở.</p>
          <div className="flex justify-end"><button type="button" className={btnPrimary} disabled={busy} onClick={submitComplete}>Hoàn tất ticket</button></div>
        </section>
      )}

      {ticket.source === 'CHATBOT' && (
        <section className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4 space-y-3">
          <h3 className="text-sm font-bold">Đánh giá chất lượng chẩn đoán Trợ lý AI</h3>
          <div className="flex flex-wrap gap-2">
            {([
              ['HELPFUL', 'Hữu ích'],
              ['PARTIAL', 'Hữu ích một phần'],
              ['MISLEADING', 'Gây hiểu nhầm'],
            ] as const).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setDiagQuality(val)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  diagQuality === val
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-line bg-surface text-text hover:border-indigo-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            className={fieldClass}
            maxLength={500}
            value={diagQualityNote}
            onChange={(e) => setDiagQualityNote(e.target.value)}
            placeholder="Ghi chú thêm về chất lượng chẩn đoán (tùy chọn, tối đa 500 ký tự)"
          />
          <div className="flex justify-end">
            <button
              type="button"
              className={btnPrimary}
              disabled={busy || !diagQuality}
              onClick={() => diagQuality && void run(
                () => adminRateDiagnosisQuality(ticket.id, diagQuality, diagQualityNote.trim() || undefined),
                'Đã lưu đánh giá chất lượng chẩn đoán',
              )}
            >
              Lưu đánh giá
            </button>
          </div>
        </section>
      )}

      <TicketDetailView ticket={ticket} showContact />
    </MaintenanceModal>
  );
}
