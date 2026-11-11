import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from './HomeIcons';
import type { EnergySummary, EnergyAnalyticsResponse, EnergyTimeSeriesPoint } from '../../types/energy';
import { getHomeEnergyAnalytics, energyAnalyticsKey } from '../../services/energyApi';
import { peekCache } from '../../services/queryCache';
import { notify } from '../ui/notify';

interface HomeEnergyWidgetProps {
  homeId?: string;
  energySummary?: EnergySummary | null;
  energyAnalytics?: EnergyAnalyticsResponse | null;
}

type Segment = 'day' | 'week' | 'month';

const segmentPeriodMap: Record<Segment, string> = {
  day: '24H',
  week: '7D',
  month: '30D',
};

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] as const;

interface DisplayBar {
  key: string;
  label: string;
  detailLabel: string;
  kwh: number;
  costVnd: number;
  isCurrentOrHighlight?: boolean;
}

function getWeekdayLabelFromDate(dateStr?: string, fallbackIndex = 0): string {
  if (dateStr) {
    const d = new Date(dateStr);
    if (!Number.isNaN(d.getTime())) {
      const jsDay = d.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
      return jsDay === 0 ? 'CN' : `T${jsDay + 1}`;
    }
  }
  return WEEKDAY_LABELS[fallbackIndex % 7];
}

function buildDisplayBars(
  segment: Segment,
  rawPoints: EnergyTimeSeriesPoint[]
): DisplayBar[] {
  if (!rawPoints || rawPoints.length === 0) return [];

  if (segment === 'week') {
    // 7 days of the week (T2 .. CN)
    const slice = rawPoints.slice(-7);
    const ordered: DisplayBar[] = slice.map((pt, idx) => {
      const wd = getWeekdayLabelFromDate(pt.timestamp, idx);
      const dateDetail = pt.label && pt.label !== wd ? `${wd} (${pt.label})` : wd;
      return {
        key: pt.timestamp || `${wd}-${idx}`,
        label: wd,
        detailLabel: dateDetail,
        kwh: Number(pt.kwh || 0),
        costVnd: Number(pt.costVnd || 0),
        isCurrentOrHighlight: idx === slice.length - 1,
      };
    });
    return ordered;
  }

  if (segment === 'day') {
    // Aggregate 24 hourly points into 6 clean 4-hour blocks so bars never overflow
    if (rawPoints.length <= 7) {
      return rawPoints.map((pt, idx) => ({
        key: pt.timestamp || pt.label || String(idx),
        label: pt.label || `${idx * 4}h`,
        detailLabel: pt.label || `${idx * 4}:00`,
        kwh: Number(pt.kwh || 0),
        costVnd: Number(pt.costVnd || 0),
        isCurrentOrHighlight: idx === rawPoints.length - 1,
      }));
    }
    const bucketLabels = ['00h', '04h', '08h', '12h', '16h', '20h'];
    const bucketRanges = ['00:00–03:59', '04:00–07:59', '08:00–11:59', '12:00–15:59', '16:00–19:59', '20:00–23:59'];
    const buckets: DisplayBar[] = bucketLabels.map((lbl, bIdx) => ({
      key: `day-bucket-${bIdx}`,
      label: lbl,
      detailLabel: `Khung ${bucketRanges[bIdx]}`,
      kwh: 0,
      costVnd: 0,
      isCurrentOrHighlight: bIdx === bucketLabels.length - 1,
    }));

    rawPoints.forEach((pt, idx) => {
      const bIdx = Math.min(5, Math.floor((idx / Math.max(1, rawPoints.length)) * 6));
      buckets[bIdx].kwh += Number(pt.kwh || 0);
      buckets[bIdx].costVnd += Number(pt.costVnd || 0);
    });
    return buckets;
  }

  // segment === 'month': Hiển thị các ngày hoặc các tuần từ ngày 01 đầu tháng hiện tại
  if (rawPoints.length <= 10) {
    return rawPoints.map((pt, idx) => {
      const lbl = pt.label || `0${idx + 1}`;
      return {
        key: pt.timestamp || lbl || String(idx),
        label: lbl,
        detailLabel: `Ngày ${lbl} (Tháng này)`,
        kwh: Number(pt.kwh || 0),
        costVnd: Number(pt.costVnd || 0),
        isCurrentOrHighlight: idx === rawPoints.length - 1,
      };
    });
  }

  const weekBuckets: DisplayBar[] = [];
  const daysPerWeek = 7;
  const totalWeeks = Math.ceil(rawPoints.length / daysPerWeek);
  for (let w = 0; w < totalWeeks; w++) {
    const chunk = rawPoints.slice(w * daysPerWeek, (w + 1) * daysPerWeek);
    if (chunk.length === 0) continue;
    const firstLbl = chunk[0].label || `${w * 7 + 1}`;
    const lastLbl = chunk[chunk.length - 1].label || `${(w + 1) * 7}`;
    const kwhSum = chunk.reduce((acc, p) => acc + Number(p.kwh || 0), 0);
    const costSum = chunk.reduce((acc, p) => acc + Number(p.costVnd || 0), 0);
    weekBuckets.push({
      key: `month-week-${w}`,
      label: `Tuần ${w + 1}`,
      detailLabel: `Tuần ${w + 1} (${firstLbl} – ${lastLbl})`,
      kwh: kwhSum,
      costVnd: costSum,
      isCurrentOrHighlight: w === totalWeeks - 1,
    });
  }
  return weekBuckets;
}

export const HomeEnergyWidget: React.FC<HomeEnergyWidgetProps> = ({
  homeId,
  energySummary,
  energyAnalytics,
}) => {
  const navigate = useNavigate();
  // Default to 'week' (7 days of week T2..CN) per user requirement
  const [activeSegment, setActiveSegment] = useState<Segment>('week');
  const [cache, setCache] = useState<Record<string, EnergyAnalyticsResponse>>({});
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);

  const activePeriod = segmentPeriodMap[activeSegment];
  const peeked = homeId ? peekCache<EnergyAnalyticsResponse>(energyAnalyticsKey(homeId, activePeriod)) : undefined;
  const analyticsData =
    cache[activePeriod] ??
    (activeSegment === 'week' && energyAnalytics ? energyAnalytics : peeked ?? null);

  // Fetch when segment changes if not yet cached + silently prefetch other periods
  useEffect(() => {
    if (!homeId) return;

    // Silently prefetch 24H and 30D after 300ms so tab switching on dashboard is 0ms
    const timer = setTimeout(() => {
      const remaining = ['24H', '7D', '30D'].filter((p) => p !== activePeriod);
      remaining.forEach((p) => {
        getHomeEnergyAnalytics(homeId, p).catch(() => null);
      });
    }, 300);

    if (cache[activePeriod]) {
      return () => clearTimeout(timer);
    }

    let active = true;
    getHomeEnergyAnalytics(homeId, activePeriod)
      .then((res) => {
        if (active && res) {
          setCache((prev) => ({ ...prev, [activePeriod]: res }));
        }
      })
      .catch((err) => {
        console.warn('Failed to load energy analytics:', err);
      });

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [homeId, activeSegment, activePeriod, cache]);

  const activeSummary = analyticsData?.summary ?? energySummary;
  const totalKwh =
    activeSummary?.totalKwh !== undefined ? activeSummary.totalKwh.toFixed(1) : '0.0';
  const estimatedCostVnd =
    activeSummary?.estimatedCostVnd !== undefined
      ? activeSummary.estimatedCostVnd.toLocaleString('vi-VN')
      : '0';

  const comparison = activeSummary?.comparisonLastPeriodPercent;
  const displayBars = useMemo(
    () => buildDisplayBars(activeSegment, analyticsData?.timeSeries ?? []),
    [activeSegment, analyticsData?.timeSeries]
  );
  const maxKwh = Math.max(...displayBars.map((p) => p.kwh), 0.1);

  const handleOpenEnergyPage = () => {
    if (homeId) {
      navigate(`/home/${encodeURIComponent(homeId)}/energy`);
    } else {
      notify.info('Hãy chọn hoặc tạo một ngôi nhà trước.');
    }
  };

  // Default highlight is the selected bar or the latest day of the week
  const effectiveSelectedIndex =
    selectedBarIndex !== null && displayBars[selectedBarIndex]
      ? selectedBarIndex
      : displayBars.length > 0
      ? displayBars.length - 1
      : null;

  const selectedPoint =
    effectiveSelectedIndex !== null && displayBars[effectiveSelectedIndex]
      ? displayBars[effectiveSelectedIndex]
      : null;

  return (
    <section className="energy-card glass-g1">
      <div className="section-head">
        <div>
          <span className="eyebrow">
            {activeSegment === 'day'
              ? 'THEO KHUNG GIỜ TRONG NGÀY'
              : activeSegment === 'week'
              ? 'THEO NGÀY TRONG TUẦN'
              : 'TỪ ĐẦU THÁNG ĐẾN NAY'}
          </span>
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

      <div className="flex items-baseline justify-between gap-2">
        <div className="energy-value">
          <strong>{totalKwh}</strong>
          <span>kWh</span>
        </div>
        <span className="text-xs font-semibold text-[var(--secondary)]">
          ≈ {estimatedCostVnd} đ
        </span>
      </div>

      {comparison !== undefined && comparison !== null ? (
        <p className={`delta ${comparison < 0 ? 'text-emerald-500' : comparison > 0 ? 'text-rose-500' : ''}`}>
          {comparison < 0 ? '↓' : comparison > 0 ? '↑' : ''} {Math.abs(comparison).toFixed(1)}%{' '}
          <span>
            so với{' '}
            {activeSegment === 'day'
              ? 'hôm qua'
              : activeSegment === 'week'
              ? 'tuần trước'
              : 'tháng trước'}
          </span>
        </p>
      ) : (
        <p className="delta">
          <span>{activeSummary?.activeDeviceCount ?? 0} thiết bị đang tiêu thụ điện</span>
        </p>
      )}

      {selectedPoint && (
        <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--accent)] bg-[var(--accent-soft)]/60 px-2.5 py-1 rounded-lg mt-2">
          <span>{selectedPoint.detailLabel}</span>
          <span>
            {selectedPoint.kwh.toFixed(2)} kWh · {Math.round(selectedPoint.costVnd).toLocaleString('vi-VN')} đ
          </span>
        </div>
      )}

      <div className="chart" aria-label={`Biểu đồ điện năng ${activeSegment}`}>
        {displayBars.length === 0 ? (
          <div className="w-full h-24 flex items-center justify-center text-xs text-[var(--secondary)]">
            Chưa có dữ liệu tiêu thụ điện
          </div>
        ) : (
          displayBars.map((bar, i) => {
            const heightPercent = Math.max(12, Math.round((bar.kwh / maxKwh) * 100));
            const isSelected = effectiveSelectedIndex === i;

            return (
              <div
                className="bar-wrap"
                key={bar.key}
                onClick={() => setSelectedBarIndex(i)}
                title={`${bar.detailLabel}: ${bar.kwh.toFixed(2)} kWh (${Math.round(bar.costVnd).toLocaleString('vi-VN')} đ)`}
              >
                <span className={`text-[9px] font-bold leading-none ${isSelected ? 'text-[var(--accent)]' : 'text-[var(--tertiary)]'}`}>
                  {bar.kwh.toFixed(1)}
                </span>
                <div className="w-full flex-1 flex items-end justify-center">
                  <div
                    className={`bar ${isSelected ? 'selected' : ''}`}
                    style={{ height: `${heightPercent}%` }}
                  />
                </div>
                <small className={isSelected ? 'font-bold text-[var(--accent)]!' : ''}>{bar.label}</small>
              </div>
            );
          })
        )}
      </div>

      <div className="segments">
        <button
          type="button"
          className={activeSegment === 'day' ? 'active' : ''}
          onClick={() => {
            setActiveSegment('day');
            setSelectedBarIndex(null);
          }}
        >
          Ngày
        </button>
        <button
          type="button"
          className={activeSegment === 'week' ? 'active' : ''}
          onClick={() => {
            setActiveSegment('week');
            setSelectedBarIndex(null);
          }}
        >
          Tuần
        </button>
        <button
          type="button"
          className={activeSegment === 'month' ? 'active' : ''}
          onClick={() => {
            setActiveSegment('month');
            setSelectedBarIndex(null);
          }}
        >
          Tháng
        </button>
      </div>
    </section>
  );
};
