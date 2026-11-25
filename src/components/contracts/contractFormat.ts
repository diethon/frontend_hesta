import type { ContractEventType, InstallationContractStatus } from '../../types/contract';

export const CONTRACT_STATUS_META: Record<
  InstallationContractStatus,
  { label: string; shortLabel: string; badgeClass: string; stepIndex: number }
> = {
  SUBMITTED: {
    label: 'Chờ tư vấn',
    shortLabel: 'Chờ tư vấn',
    badgeClass: 'bg-sky-500/12 text-sky-700 dark:text-sky-300 border-sky-500/25',
    stepIndex: 0,
  },
  SURVEYING: {
    label: 'Đang khảo sát',
    shortLabel: 'Khảo sát',
    badgeClass: 'bg-blue-500/12 text-blue-700 dark:text-blue-300 border-blue-500/25',
    stepIndex: 1,
  },
  QUOTED: {
    label: 'Đã gửi báo giá',
    shortLabel: 'Báo giá',
    badgeClass: 'bg-indigo-500/12 text-indigo-700 dark:text-indigo-300 border-indigo-500/25',
    stepIndex: 2,
  },
  REVISION_REQUESTED: {
    label: 'Yêu cầu điều chỉnh',
    shortLabel: 'Điều chỉnh',
    badgeClass: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
    stepIndex: 2,
  },
  AWAITING_DEPOSIT: {
    label: 'Đã ký · Chờ đặt cọc',
    shortLabel: 'Chờ cọc',
    badgeClass: 'bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/30',
    stepIndex: 3,
  },
  DEPOSIT_SUBMITTED: {
    label: 'Chờ đối soát cọc',
    shortLabel: 'Đối soát cọc',
    badgeClass: 'bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-500/30',
    stepIndex: 4,
  },
  DEPOSIT_CONFIRMED: {
    label: 'Đã xác nhận cọc',
    shortLabel: 'Đã nhận cọc',
    badgeClass: 'bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-500/30',
    stepIndex: 4,
  },
  INSTALLING: {
    label: 'Đang lắp đặt',
    shortLabel: 'Lắp đặt',
    badgeClass: 'bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border-cyan-500/30',
    stepIndex: 5,
  },
  HANDED_OVER: {
    label: 'Đã bàn giao',
    shortLabel: 'Hoàn tất',
    badgeClass: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
    stepIndex: 6,
  },
  CANCELLED: {
    label: 'Đã hủy',
    shortLabel: 'Đã hủy',
    badgeClass: 'bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/25',
    stepIndex: -1,
  },
};

export const CONTRACT_STEPS = [
  'Yêu cầu tư vấn',
  'Khảo sát kỹ thuật',
  'Báo giá & Hợp đồng',
  'Ký điện tử',
  'Đặt cọc & Đối soát',
  'Lắp đặt',
  'Bàn giao nhà',
];

export const CONTRACT_EVENT_LABELS: Record<ContractEventType, string> = {
  SUBMITTED: 'Gửi yêu cầu tư vấn',
  CLAIMED: 'Liên kết tài khoản',
  SURVEY_UPDATED: 'Cập nhật khảo sát kỹ thuật',
  QUOTE_SENT: 'Phát hành báo giá & hợp đồng',
  REVISION_REQUESTED: 'Yêu cầu điều chỉnh',
  COMMENT: 'Trao đổi trực tiếp',
  SIGNED: 'Ký hợp đồng điện tử',
  DEPOSIT_SUBMITTED: 'Báo đã chuyển cọc',
  DEPOSIT_CONFIRMED: 'Xác nhận đã nhận cọc',
  DEPOSIT_REJECTED: 'Yêu cầu kiểm tra lại cọc',
  INSTALLING: 'Bắt đầu lắp đặt',
  HANDED_OVER: 'Bàn giao hệ thống',
  CANCELLED: 'Hủy hồ sơ',
};

export const HOME_TYPE_LABELS: Record<string, string> = {
  APARTMENT: 'Căn hộ chung cư',
  LEVEL_4_HOUSE: 'Nhà cấp 4',
  TOWNHOUSE: 'Nhà phố',
  VILLA: 'Biệt thự',
  OFFICE: 'Văn phòng / Shophouse',
};

export const BUILDING_CONDITION_LABELS: Record<string, string> = {
  UNDER_CONSTRUCTION: 'Đang xây thô',
  FINISHING: 'Đang hoàn thiện',
  OCCUPIED: 'Nhà đang ở',
};

export const TIMELINE_LABELS: Record<string, string> = {
  URGENT_2_WEEKS: 'Càng sớm càng tốt (1–2 tuần)',
  WITHIN_1_MONTH: 'Trong 1 tháng tới',
  WITHIN_3_MONTHS: 'Trong 2–3 tháng tới',
  FLEXIBLE: 'Chưa cố định – Cần tư vấn',
};

const vndFormatter = new Intl.NumberFormat('vi-VN');

export function formatVnd(amount?: number | null): string {
  if (amount == null || !Number.isFinite(amount)) return '0 đ';
  return `${vndFormatter.format(Math.round(amount))} đ`;
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return 'Chưa xác định';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Chưa xác định';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatDateOnly(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function toLocalDateTimeInputValue(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
