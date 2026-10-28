import React from 'react';
import { useNavigate } from 'react-router';
import { Icon, type IconName } from './HomeIcons';
import { notify } from '../ui/notify';

interface HomeActivityWidgetProps {
  homeId?: string;
}

export const HomeActivityWidget: React.FC<HomeActivityWidgetProps> = ({ homeId }) => {
  const navigate = useNavigate();

  const activities: [IconName, string, string][] = [
    ['door', 'Cổng chính đã dừng', 'Vừa xong'],
    ['lamp', 'Đèn ngủ bật', '07:19'],
    ['snowflake', 'Điều hòa Casper bật', '06:50'],
  ];

  const handleSeeAll = () => {
    if (homeId) {
      navigate(`/home/${encodeURIComponent(homeId)}/devices`);
    } else {
      notify.info('Xem tất cả nhật ký hoạt động.');
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
        {activities.map(([icon, text, time]) => (
          <div className="activity-row" key={text}>
            <span className="activity-icon">
              <Icon name={icon} size={19} />
            </span>
            <strong>{text}</strong>
            <time>{time}</time>
          </div>
        ))}
      </div>
    </section>
  );
};
