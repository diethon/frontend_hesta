import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from './HomeIcons';
import type { EnergySummary } from '../../types/energy';
import { notify } from '../ui/notify';

interface HomeEnergyWidgetProps {
  homeId?: string;
  energySummary?: EnergySummary | null;
}

export const HomeEnergyWidget: React.FC<HomeEnergyWidgetProps> = ({
  homeId,
  energySummary,
}) => {
  const navigate = useNavigate();
  const [activeSegment, setActiveSegment] = useState<'day' | 'week' | 'month'>('day');
  const [selectedBarIndex, setSelectedBarIndex] = useState<number>(5);

  const segmentData = {
    day: [54, 68, 49, 76, 61, 87, 70],
    week: [62, 58, 71, 80, 75, 90, 68],
    month: [45, 55, 68, 85, 78, 92, 74],
  };

  const labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const bars = segmentData[activeSegment];

  const totalKwh = energySummary?.totalKwh ? energySummary.totalKwh.toFixed(1) : '12.4';

  const handleOpenEnergyPage = () => {
    if (homeId) {
      navigate(`/home/${encodeURIComponent(homeId)}/energy`);
    } else {
      notify.info('Hãy chọn hoặc tạo một ngôi nhà trước.');
    }
  };

  return (
    <section className="energy-card glass-g1">
      <div className="section-head">
        <div>
          <span className="eyebrow">HÔM NAY</span>
          <h2>Điện năng</h2>
        </div>

        <button
          type="button"
          className="more-button"
          aria-label="Tùy chọn điện năng"
          title="Xem chi tiết tiêu thụ điện năng"
          onClick={handleOpenEnergyPage}
        >
          <Icon name="more" />
        </button>
      </div>

      <div className="energy-value">
        <strong>{totalKwh}</strong>
        <span>kWh</span>
      </div>

      <p className="delta">
        ↓ 8% <span>so với hôm qua</span>
      </p>

      <div className="chart" aria-label="Biểu đồ điện năng 7 ngày">
        {bars.map((bar, i) => (
          <div
            className="bar-wrap"
            key={labels[i]}
            onClick={() => setSelectedBarIndex(i)}
            title={`${labels[i]}: ${bar}%`}
          >
            <div
              className={`bar ${selectedBarIndex === i ? 'selected' : ''}`}
              style={{ height: `${bar}%` }}
            />
            <small>{labels[i]}</small>
          </div>
        ))}
      </div>

      <div className="segments">
        <button
          type="button"
          className={activeSegment === 'day' ? 'active' : ''}
          onClick={() => setActiveSegment('day')}
        >
          Ngày
        </button>
        <button
          type="button"
          className={activeSegment === 'week' ? 'active' : ''}
          onClick={() => setActiveSegment('week')}
        >
          Tuần
        </button>
        <button
          type="button"
          className={activeSegment === 'month' ? 'active' : ''}
          onClick={() => setActiveSegment('month')}
        >
          Tháng
        </button>
      </div>
    </section>
  );
};
