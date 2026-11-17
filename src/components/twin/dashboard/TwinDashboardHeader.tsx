import { useMemo } from 'react';
import { PanelLeftClose, PanelLeftOpen, RefreshCw } from 'lucide-react';
import { useAppSelector } from '../../../store/hooks';
import { selectCurrentUser } from '../../../store/selectors';
import { AutomationTopBar } from '../../automation/AutomationTopBar';
import type { TwinRendererTheme } from '../scene/rendererTheme';
import { deviceHealthCounts } from './twinDashboardData';

interface Props {
  homeId: string;
  connected: boolean;
  connectionLabel: string;
  loading: boolean;
  canReload: boolean;
  onReload: () => void;
  theme: TwinRendererTheme;
  onThemeChange: (theme: TwinRendererTheme) => void;
  navigationOpen?: boolean;
  onToggleNavigation?: () => void;
}

/** Twin header in the shared studio style of the Scene / Automation / Device pages. */
export function TwinDashboardHeader({ homeId, connected, connectionLabel, loading, canReload, onReload, navigationOpen, onToggleNavigation }: Props) {
  const user = useAppSelector(selectCurrentUser);
  const homeName = useAppSelector((state) => state.twin.homeId === homeId ? state.twin.home?.name : undefined);
  const devices = useAppSelector((state) => state.twin.homeId === homeId ? state.twin.devicesById : null);
  const health = useMemo(() => deviceHealthCounts(devices ? Object.values(devices) : []), [devices]);
  const roomCount = useAppSelector((state) => state.twin.homeId === homeId ? state.twin.roomIds.length : 0);
  const sensorCount = useAppSelector((state) => state.twin.homeId === homeId ? state.twin.sensorIds.length : 0);
  const userInitial = user?.fullName?.charAt(0) || user?.email?.charAt(0) || 'U';

  return <>
    <AutomationTopBar
      caption={`${homeName ?? 'Ngôi nhà của bạn'} · ${roomCount} phòng · ${health.online}/${health.total} thiết bị trực tuyến · ${sensorCount} cảm biến`}
      title="Digital Twin"
      subtitle="Một góc nhìn trực quan cho không gian sống thông minh."
      userInitial={userInitial}
    />
    <div className="st-toolbar">
      <p role="status" className="flex items-center gap-2 text-sm font-medium text-muted">
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${connected ? 'bg-success' : 'bg-warning'}`} />{connectionLabel}
      </p>
      <div className="st-toolbar-end">
        {onToggleNavigation ? <button type="button" className="st-link" aria-expanded={!!navigationOpen} onClick={onToggleNavigation}>
          {navigationOpen ? <PanelLeftClose size={16} aria-hidden="true" /> : <PanelLeftOpen size={16} aria-hidden="true" />}
          <span>{navigationOpen ? 'Thu gọn điều hướng' : 'Mở rộng điều hướng'}</span>
        </button> : null}
        <button type="button" className="st-btn" disabled={loading || !canReload} onClick={onReload} aria-label="Đồng bộ lại Digital Twin">
          <RefreshCw size={16} aria-hidden="true" />{loading ? 'Đang đồng bộ…' : 'Đồng bộ lại'}
        </button>
      </div>
    </div>
  </>;
}
