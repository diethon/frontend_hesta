import type { TwinDeviceSnapshotResponse, TwinHealthStatus } from '../../types/twin';
import { useTwinUpdateMotion } from './useTwinMotion';
import { healthSymbols } from './twinPresentation';

const healthStyles: Record<TwinHealthStatus, string> = {
  ACTIVE: 'border-success bg-success-soft',
  STALE: 'border-warning bg-warning-soft',
  OFFLINE: 'border-off bg-off-soft',
};
const healthLabels: Record<TwinHealthStatus, string> = {
  ACTIVE: 'Dữ liệu mới', STALE: 'Dữ liệu đã cũ', OFFLINE: 'Không có dữ liệu mới',
};

export function TwinHealthBadge({ healthStatus, compact = false }: { healthStatus: TwinHealthStatus; compact?: boolean }) {
  const motionRef = useTwinUpdateMotion<HTMLSpanElement>(healthStatus);
  return <span ref={motionRef} title={healthLabels[healthStatus]} className={`inline-flex items-center gap-1 rounded-full border text-text ${compact ? 'px-1.5 py-0.5 text-[10px] leading-4' : 'px-2.5 py-1 text-xs'} font-semibold ${healthStyles[healthStatus]}`}>
    <span aria-hidden="true">{healthSymbols[healthStatus]}</span>{healthStatus}
  </span>;
}

export function TwinDeviceStatusBadge({ status, compact = false }: { status: TwinDeviceSnapshotResponse['status']; compact?: boolean }) {
  const styles = { ONLINE: 'border-success bg-success-soft', OFFLINE: 'border-off bg-off-soft', ERROR: 'border-error bg-error-soft', UNKNOWN: 'border-line bg-off-soft' };
  const labels = { ONLINE: 'Trực tuyến', OFFLINE: 'Ngoại tuyến', ERROR: 'Thiết bị báo lỗi', UNKNOWN: 'Chưa xác định kết nối' };
  return <span title={labels[status]} className={`inline-flex items-center gap-1 rounded-full border font-semibold text-text ${compact ? 'px-1.5 py-0.5 text-[10px] leading-4' : 'px-2.5 py-1 text-xs'} ${styles[status]}`}>
    <span aria-hidden="true">{status === 'ONLINE' ? '✓' : status === 'ERROR' ? '!' : status === 'OFFLINE' ? '×' : '?'}</span>{status}
  </span>;
}
