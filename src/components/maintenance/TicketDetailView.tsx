import { CalendarClock, Phone, Star, Wrench } from 'lucide-react';
import type { MaintenanceTicket } from '../../types/maintenance';
import {
  ITEM_TYPE_LABEL,
  OUTCOME_LABEL,
  PRIORITY_META,
  STATUS_META,
  TONE_CLASS,
  formatDateTime,
  formatMoney,
  formatRange,
} from './maintenanceFormat';

export function StatusPill({ status }: { status: MaintenanceTicket['status'] }) {
  const meta = STATUS_META[status];
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${TONE_CLASS[meta.tone]}`}>{meta.label}</span>;
}

export function PriorityPill({ priority }: { priority: MaintenanceTicket['priority'] }) {
  const meta = PRIORITY_META[priority];
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${TONE_CLASS[meta.tone]}`}>Ưu tiên: {meta.label}</span>;
}

const sectionTitle = 'text-xs font-bold uppercase tracking-wide text-muted mb-2';

/** Read-only ticket body shared by the user and admin detail dialogs. */
export function TicketDetailView({ ticket, showContact }: { ticket: MaintenanceTicket; showContact?: boolean }) {
  const quote = ticket.quote;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={ticket.status} />
        <PriorityPill priority={ticket.priority} />
        <span className="text-xs text-muted">Tạo lúc {formatDateTime(ticket.createdAt)} bởi {ticket.createdBy?.fullName ?? '—'}</span>
      </div>
      {ticket.description && <p className="text-sm whitespace-pre-line">{ticket.description}</p>}
      {ticket.cancelReason && (
        <p className="rounded-xl border border-line bg-sidebar/60 p-3 text-sm"><strong>Lý do:</strong> {ticket.cancelReason}</p>
      )}

      {showContact && (
        <section>
          <h3 className={sectionTitle}>Liên hệ</h3>
          <div className="text-sm space-y-1">
            <p><strong>{ticket.homeName}</strong>{ticket.homeAddress ? ` · ${ticket.homeAddress}` : ''}</p>
            <p className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />
              {ticket.contactPhone || ticket.createdBy?.phoneNumber || 'Chưa có số'} · {ticket.createdBy?.email}</p>
          </div>
        </section>
      )}

      <section>
        <h3 className={sectionTitle}>Thiết bị ({ticket.devices.length})</h3>
        <ul className="space-y-2">
          {ticket.devices.map((d) => (
            <li key={d.id} className="rounded-2xl border border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-sm">{d.deviceName}</strong>
                {d.outcome && <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONE_CLASS[d.outcome === 'NOT_REPAIRABLE' ? 'danger' : 'ok']}`}>{OUTCOME_LABEL[d.outcome]}</span>}
              </div>
              <p className="text-xs text-muted">{[d.roomName, d.deviceType, d.model, d.serialNumber && `S/N ${d.serialNumber}`].filter(Boolean).join(' · ')}</p>
              {d.issueNote && <p className="text-sm mt-1">Lỗi: {d.issueNote}</p>}
              {d.sourceAnomalyId && <p className="text-xs text-amber-600 mt-1">Liên kết từ cảnh báo bất thường</p>}
              {d.outcomeNote && <p className="text-sm mt-1">Kết luận: {d.outcomeNote}</p>}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className={sectionTitle}>Lịch hẹn</h3>
        {ticket.scheduledStart ? (
          <p className="inline-flex items-center gap-2 text-sm">
            <CalendarClock className="w-4 h-4 text-primary" />
            <strong>{formatRange(ticket.scheduledStart, ticket.scheduledEnd)}</strong>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONE_CLASS[ticket.scheduleConfirmed ? 'ok' : 'warn']}`}>
              {ticket.scheduleConfirmed ? 'Đã xác nhận' : 'Chờ người dùng xác nhận'}
            </span>
          </p>
        ) : <p className="text-sm text-muted">Chưa xếp lịch.</p>}
        {ticket.adminNote && <p className="text-sm mt-1 text-muted">Ghi chú kỹ thuật: {ticket.adminNote}</p>}
        {ticket.slots.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-muted mb-1">Khung giờ rảnh người dùng đề xuất:</p>
            <ul className="flex flex-wrap gap-2">
              {ticket.slots.map((s) => (
                <li key={s.id ?? s.startAt} className="rounded-xl border border-line px-2.5 py-1 text-xs">{formatRange(s.startAt, s.endAt)}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {quote && (
        <section>
          <h3 className={sectionTitle}>Kết quả kiểm tra & báo giá</h3>
          <p className="text-sm whitespace-pre-line mb-2">{quote.findings}</p>
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-sidebar/60 text-xs text-muted">
                <tr>
                  <th className="text-left px-3 py-2">Hạng mục</th>
                  <th className="text-right px-3 py-2">SL</th>
                  <th className="text-right px-3 py-2">Đơn giá</th>
                  <th className="text-right px-3 py-2">Thành tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {quote.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2">
                      <span className="text-[11px] text-muted mr-1">[{ITEM_TYPE_LABEL[item.itemType]}]</span>{item.description}
                      {item.ticketDeviceId && <span className="block text-[11px] text-muted">{ticket.devices.find((d) => d.id === item.ticketDeviceId)?.deviceName}</span>}
                    </td>
                    <td className="px-3 py-2 text-right">{item.quantity}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{formatMoney(item.unitPrice)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{formatMoney(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold">
                  <td className="px-3 py-2" colSpan={3}>Tổng cộng</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{formatMoney(quote.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-xs text-muted mt-2">
            {quote.warrantyMonths ? `Bảo hành ${quote.warrantyMonths} tháng${quote.warrantyUntil ? ` (đến ${formatDateTime(quote.warrantyUntil)})` : ' kể từ khi hoàn tất'}` : 'Không bảo hành'}
            {quote.decision && ` · ${quote.decision === 'APPROVED' ? 'Đã duyệt' : 'Đã từ chối'} lúc ${formatDateTime(quote.decidedAt)}`}
          </p>
        </section>
      )}

      {ticket.rating && (
        <section>
          <h3 className={sectionTitle}>Đánh giá</h3>
          <p className="inline-flex items-center gap-1 text-sm">
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} className={`w-4 h-4 ${i < (ticket.rating ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-line'}`} aria-hidden="true" />
            ))}
            <span className="sr-only">{ticket.rating}/5</span>
            {ticket.feedback && <span className="ml-2">{ticket.feedback}</span>}
          </p>
        </section>
      )}

      <section>
        <h3 className={sectionTitle}>Tiến trình</h3>
        <ol className="relative border-l border-line ml-2 space-y-3">
          {ticket.events.map((event) => (
            <li key={event.id} className="ml-4">
              <span className="absolute -left-[7px] mt-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary/20">
                <Wrench className="w-2 h-2 text-primary" aria-hidden="true" />
              </span>
              <p className="text-sm"><strong>{STATUS_META[event.toStatus].label}</strong>
                <span className="text-xs text-muted"> · {event.actorRole === 'ADMIN' ? 'Kỹ thuật' : event.actorName ?? 'Người dùng'} · {formatDateTime(event.createdAt)}</span></p>
              {event.note && <p className="text-xs text-muted">{event.note}</p>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
