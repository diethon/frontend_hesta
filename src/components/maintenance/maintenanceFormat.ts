import type {
  MaintenanceItemType,
  MaintenanceOutcome,
  MaintenancePriority,
  MaintenanceStatus,
  TimeSlot,
} from '../../types/maintenance';

export type Tone = 'info' | 'warn' | 'danger' | 'ok' | 'muted';

export const STATUS_META: Record<MaintenanceStatus, { label: string; tone: Tone }> = {
  SUBMITTED: { label: 'Chờ xếp lịch', tone: 'warn' },
  SCHEDULED: { label: 'Đã có lịch hẹn', tone: 'info' },
  RESCHEDULE_REQUESTED: { label: 'Yêu cầu đổi lịch', tone: 'warn' },
  INSPECTING: { label: 'Đang kiểm tra', tone: 'info' },
  QUOTED: { label: 'Chờ duyệt báo giá', tone: 'warn' },
  REPAIRING: { label: 'Đang sửa chữa', tone: 'info' },
  COMPLETED: { label: 'Hoàn tất', tone: 'ok' },
  CLOSED: { label: 'Đã đóng (không sửa)', tone: 'muted' },
  CANCELLED: { label: 'Đã huỷ', tone: 'muted' },
  REJECTED: { label: 'Bị từ chối', tone: 'danger' },
};

export const PRIORITY_META: Record<MaintenancePriority, { label: string; tone: Tone }> = {
  LOW: { label: 'Thấp', tone: 'muted' },
  NORMAL: { label: 'Bình thường', tone: 'info' },
  HIGH: { label: 'Cao', tone: 'warn' },
  URGENT: { label: 'Khẩn cấp', tone: 'danger' },
};

export const ITEM_TYPE_LABEL: Record<MaintenanceItemType, string> = {
  PART: 'Linh kiện',
  LABOR: 'Công sửa',
  FEE: 'Phí khác',
};

export const OUTCOME_LABEL: Record<MaintenanceOutcome, string> = {
  FIXED: 'Đã sửa',
  REPLACED: 'Đã thay mới',
  NOT_REPAIRABLE: 'Không sửa được',
  NO_ISSUE_FOUND: 'Không phát hiện lỗi',
};

export const TONE_CLASS: Record<Tone, string> = {
  info: 'bg-primary/10 text-primary border-primary/20',
  warn: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  danger: 'bg-rose-500/10 text-rose-600 border-rose-500/30',
  ok: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  muted: 'bg-sidebar text-muted border-line',
};

export const ACTIVE_STATUSES: MaintenanceStatus[] = [
  'SUBMITTED', 'SCHEDULED', 'RESCHEDULE_REQUESTED', 'INSPECTING', 'QUOTED', 'REPAIRING',
];

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
export const formatMoney = (value?: number | null) => money.format(Number(value ?? 0));

const dateTime = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
const time = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' });
const weekday = new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });

export const formatDateTime = (value?: string | null) => (value ? dateTime.format(new Date(value)) : '—');

export const formatRange = (start?: string | null, end?: string | null) => {
  if (!start || !end) return '—';
  const s = new Date(start);
  return `${weekday.format(s)} · ${time.format(s)} – ${time.format(new Date(end))}`;
};

// ---- Slot editing (local date + HH:mm inputs; the browser's timezone is the user's) ----

export interface SlotDraft {
  key: string;
  date: string;
  start: string;
  end: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const newSlotDraft = (daysAhead = 1, start = '09:00', end = '11:00'): SlotDraft => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return { key: crypto.randomUUID(), date: toDateInput(d), start, end };
};

export const draftToSlot = (draft: SlotDraft): TimeSlot => ({
  startAt: new Date(`${draft.date}T${draft.start}:00`).toISOString(),
  endAt: new Date(`${draft.date}T${draft.end}:00`).toISOString(),
});

/** Mirrors the backend rules so the user sees the problem before submitting; the backend still decides. */
export function slotProblem(drafts: SlotDraft[]): string | null {
  if (drafts.length === 0) return 'Chọn ít nhất 1 khung giờ rảnh.';
  if (drafts.length > 5) return 'Tối đa 5 khung giờ.';
  const now = Date.now();
  const ranges = drafts.map((d) => ({ s: new Date(`${d.date}T${d.start}:00`).getTime(), e: new Date(`${d.date}T${d.end}:00`).getTime(), d }));
  for (const { s, e, d } of ranges) {
    if (Number.isNaN(s) || Number.isNaN(e)) return 'Khung giờ chưa hợp lệ.';
    if (d.start < '07:00' || d.end > '21:00') return 'Khung giờ phải nằm trong 07:00 – 21:00.';
    const minutes = (e - s) / 60000;
    if (minutes < 30 || minutes > 480) return 'Mỗi khung dài từ 30 phút đến 8 giờ.';
    if (s < now + 2 * 3600_000) return 'Khung giờ phải cách hiện tại ít nhất 2 giờ.';
    if (e > now + 14 * 86400_000) return 'Chỉ chọn trong 14 ngày tới.';
  }
  const sorted = [...ranges].sort((a, b) => a.s - b.s);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].s < sorted[i - 1].e) return 'Các khung giờ không được chồng nhau.';
  }
  return null;
}
