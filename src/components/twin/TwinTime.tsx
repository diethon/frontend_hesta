const dateFormat = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium' });

export function TwinTime({ value }: { value: string | null }) {
  if (!value || !Number.isFinite(Date.parse(value))) return <span>Chưa ghi nhận</span>;
  return <time dateTime={value} title={value}>{dateFormat.format(new Date(value))}</time>;
}
