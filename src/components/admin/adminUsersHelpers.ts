export interface FilterOption<T = string> {
  value: T;
  label: string;
}

export const ROLE_OPTIONS: FilterOption[] = [
  { value: 'ALL', label: 'Mọi vai trò' },
  { value: 'USER', label: 'Người dùng (USER)' },
  { value: 'ADMIN', label: 'Quản trị viên (ADMIN)' },
];

export const STATUS_OPTIONS: FilterOption[] = [
  { value: 'ALL', label: 'Mọi trạng thái' },
  { value: 'ACTIVE', label: 'Đang hoạt động' },
  { value: 'LOCKED', label: 'Bị tạm khóa' },
  { value: 'DISABLED', label: 'Vô hiệu hóa' },
];

export const PROVIDER_OPTIONS: FilterOption[] = [
  { value: 'ALL', label: 'Mọi nguồn đăng nhập' },
  { value: 'LOCAL', label: 'Email / Mật khẩu' },
  { value: 'GOOGLE', label: 'Google OAuth' },
];

export const PAGE_SIZE_OPTIONS: FilterOption<number>[] = [
  { value: 10, label: '10 / trang' },
  { value: 20, label: '20 / trang' },
  { value: 50, label: '50 / trang' },
];

export function formatDateTimeVi(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime())
    ? dateStr
    : d.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
}

export function formatDateTimeFullVi(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime())
    ? dateStr
    : d.toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
}
