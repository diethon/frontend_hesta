import type { TwinHealthStatus } from '../../types/twin';

const healthStyles: Record<TwinHealthStatus, string> = {
  ACTIVE: 'border-success bg-success-soft',
  STALE: 'border-warning bg-warning-soft',
  OFFLINE: 'border-off bg-off-soft',
};
const healthLabels: Record<TwinHealthStatus, string> = {
  ACTIVE: 'Dữ liệu mới', STALE: 'Dữ liệu đã cũ', OFFLINE: 'Không có dữ liệu mới',
};

export function TwinHealthBadge({ healthStatus }: { healthStatus: TwinHealthStatus }) {
  return <span title={healthLabels[healthStatus]} className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold text-text ${healthStyles[healthStatus]}`}>
    {healthStatus}
  </span>;
}
