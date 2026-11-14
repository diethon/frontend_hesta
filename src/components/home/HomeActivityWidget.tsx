import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Icon, type IconName } from './HomeIcons';
import type { DeviceResponse, DeviceStateHistoryResponse } from '../../types/device';
import { getDeviceHistory } from '../../services/deviceApi';
import { notify } from '../ui/notify';

interface HomeActivityWidgetProps {
  homeId?: string;
  devices?: DeviceResponse[];
}

interface ActivityItem {
  id: string;
  icon: IconName;
  text: string;
  time: string;
}

function resolveActivityIcon(deviceType?: string, actionText?: string): IconName {
  const dt = (deviceType || '').toUpperCase();
  const act = (actionText || '').toLowerCase();
  if (dt.includes('LIGHT') || dt.includes('LED') || act.includes('đèn') || act.includes('độ sáng')) return 'lamp';
  if (dt.includes('AC') || dt.includes('AIR') || act.includes('nhiệt độ') || act.includes('điều hòa')) return 'snowflake';
  if (dt.includes('GATE') || dt.includes('DOOR') || act.includes('cổng') || act.includes('cửa')) return 'door';
  if (dt.includes('LOCK') || act.includes('khóa')) return 'lock';
  if (dt.includes('CAMERA')) return 'camera';
  if (dt.includes('SENSOR') || dt.includes('TEMP') || dt.includes('HUMID')) return 'thermometer';
  return 'activity';
}

function formatTimeVi(dateStr?: string | null): string {
  if (!dateStr) return 'Chưa có dữ liệu';
  const d = new Date(dateStr);
  const diffMs = Date.now() - d.getTime();
  if (isNaN(diffMs)) return 'Chưa có dữ liệu';
  if (diffMs < 60000) return 'Vừa xong';
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Hôm qua';
  return `${diffDays} ngày trước`;
}

function formatEventDescription(
  deviceName: string,
  newState: Record<string, unknown> = {},
  deviceType = ''
): string {
  const dt = deviceType.toUpperCase();
  const stateUpper = String(newState.state ?? newState.gateAction ?? newState.gate ?? '').toUpperCase();
  if (stateUpper === 'OPEN' || stateUpper === 'OPENING') {
    return `${deviceName} đã mở`;
  }
  if (stateUpper === 'CLOSE' || stateUpper === 'CLOSED' || stateUpper === 'CLOSING') {
    return `${deviceName} đã đóng`;
  }
  if (stateUpper === 'STOP' || stateUpper === 'STOPPED') {
    return `${deviceName} đã dừng`;
  }
  if (
    newState.power === 'ON' ||
    newState.power === true ||
    newState.state === 'ON' ||
    newState.state === true
  ) {
    return `${deviceName} đã bật`;
  }
  if (
    newState.power === 'OFF' ||
    newState.power === false ||
    newState.state === 'OFF' ||
    newState.state === false
  ) {
    return `${deviceName} đã tắt`;
  }
  if (newState.brightness !== undefined && newState.brightness !== null) {
    return `${deviceName} chỉnh độ sáng ${newState.brightness}%`;
  }
  if (newState.temperature !== undefined && newState.temperature !== null) {
    if (dt.includes('SENSOR') || dt.includes('TEMP') || dt.includes('HUMID')) {
      return `${deviceName} đo được ${newState.temperature}°C`;
    }
    return `${deviceName} đặt ${newState.temperature}°C`;
  }
  return `${deviceName} cập nhật trạng thái`;
}

export const HomeActivityWidget: React.FC<HomeActivityWidgetProps> = ({
  homeId,
  devices = [],
}) => {
  const navigate = useNavigate();
  const [historyItems, setHistoryItems] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (!devices || devices.length === 0) return;

    let active = true;
    const targets = devices.slice(0, 5);

    Promise.allSettled(targets.map((d) => getDeviceHistory(d.id)))
      .then((results) => {
        if (!active) return;
        const events: {
          event: DeviceStateHistoryResponse;
          deviceName: string;
          deviceType: string;
        }[] = [];

        results.forEach((res, i) => {
          if (res.status === 'fulfilled' && Array.isArray(res.value)) {
            const dev = targets[i];
            for (const h of res.value) {
              events.push({
                event: h,
                deviceName: dev.name,
                deviceType: dev.deviceType,
              });
            }
          }
        });

        // Sort descending by changedAt
        events.sort(
          (a, b) =>
            new Date(b.event.changedAt).getTime() - new Date(a.event.changedAt).getTime()
        );

        const latest5 = events.slice(0, 5).map(({ event, deviceName, deviceType }) => {
          const text = formatEventDescription(
            deviceName,
            event.newState as Record<string, unknown>,
            deviceType
          );
          return {
            id: event.id || `${deviceName}-${event.changedAt}`,
            icon: resolveActivityIcon(deviceType, text),
            text,
            time: formatTimeVi(event.changedAt),
          };
        });

        setHistoryItems(latest5);
      })
      .catch((err) => {
        console.warn('Failed to fetch device histories:', err);
      });

    return () => {
      active = false;
    };
  }, [devices]);

  // Fallback to recent lastSeen devices if no history table rows
  const fallbackActivities: ActivityItem[] = devices
    .filter((d) => Boolean(d.lastSeen))
    .sort(
      (a, b) =>
        new Date(b.lastSeen ?? '').getTime() - new Date(a.lastSeen ?? '').getTime()
    )
    .slice(0, 5)
    .map((d) => {
      const isOn =
        d.currentState?.power === 'ON' ||
        d.currentState?.power === true ||
        d.currentState?.state === 'ON';
      const text = `${d.name} · ${isOn ? 'Đang bật' : 'Đang chờ'}`;
      return {
        id: d.id,
        icon: resolveActivityIcon(d.deviceType, text),
        text,
        time: formatTimeVi(d.lastSeen),
      };
    });

  const displayActivities =
    historyItems.length > 0 ? historyItems : fallbackActivities;

  const handleSeeAll = () => {
    if (homeId) {
      navigate(`/home/${encodeURIComponent(homeId)}/devices`);
    } else {
      notify.info('Hãy chọn hoặc tạo một ngôi nhà trước.');
    }
  };

  return (
    <section className="activity-card">
      <div className="section-head">
        <div>
          <span className="eyebrow">NHẬT KÝ</span>
          <h2>Hoạt động gần đây</h2>
        </div>

        <button
          type="button"
          className="text-button"
          onClick={handleSeeAll}
          title="Xem toàn bộ nhật ký sự kiện"
        >
          <span>Xem tất cả</span>
          <Icon name="chevron" size={16} />
        </button>
      </div>

      <div className="activity-list">
        {displayActivities.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--secondary)]">
            Chưa có hoạt động nào gần đây
          </div>
        ) : (
          displayActivities.map((item) => (
            <div className="activity-row" key={item.id}>
              <span className="activity-icon">
                <Icon name={item.icon} size={19} />
              </span>
              <strong>{item.text}</strong>
              <time>{item.time}</time>
            </div>
          ))
        )}
      </div>
    </section>
  );
};
