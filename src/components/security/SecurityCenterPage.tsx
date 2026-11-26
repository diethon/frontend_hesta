import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  acknowledgeAnomaly,
  getAnomalies,
  getSecurityEvents,
  resolveAnomaly,
  updateSecurityEvent,
} from '../../services/securityApi';
import type { AnomalyStatus, DeviceAnomaly, SecurityEvent, SecurityEventStatus } from '../../types/security';
import { useAppSelector } from '../../store/hooks';
import { DashboardNavRail } from '../home/DashboardNavRail';
import { DashboardBottomNav } from '../home/DashboardBottomNav';
import { PageHero, SectionTitle } from '../ui/PageHero';
import { Icon, type IconName } from '../ui/LucideIcon';
import { notify } from '../ui/notify';
import { errorText, formatDateTime } from './historyFormat';
import './security.css';

type Tab = 'events' | 'anomalies';
type Tone = 'warn' | 'danger' | 'ok' | 'muted';

interface CardAction { label: string; primary?: boolean; run: () => Promise<unknown> }
interface IncidentCard {
  id: string;
  icon: IconName;
  tone: Tone;
  title: string;
  detail: string;
  time: string;
  statusLabel: string;
  actions: CardAction[];
}

const PAGE_SIZE = 12;

const EVENT_STATUS: Record<SecurityEventStatus, { label: string; tone: Tone }> = {
  DETECTED: { label: 'Chưa xử lý', tone: 'warn' },
  CONFIRMED: { label: 'Đã xác nhận', tone: 'danger' },
  DISMISSED: { label: 'Báo động giả', tone: 'muted' },
};
const ANOMALY_STATUS: Record<AnomalyStatus, { label: string; tone: Tone }> = {
  OPEN: { label: 'Đang mở', tone: 'danger' },
  ACKNOWLEDGED: { label: 'Đã xác nhận', tone: 'warn' },
  RESOLVED: { label: 'Đã xử lý', tone: 'ok' },
};
const ANOMALY_TITLE: Record<DeviceAnomaly['anomalyType'], string> = {
  GAS_LEAKAGE: 'Rò rỉ khí gas',
  SMOKE_DETECTED: 'Phát hiện khói',
  HIGH_TEMPERATURE: 'Nhiệt độ cao bất thường',
  SENSOR_OFFLINE: 'Cảm biến mất kết nối',
};

export function SecurityCenterPage() {
  const { homeId = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = searchParams.get('tab') === 'anomalies' ? 'anomalies' : 'events';
  const authUser = useAppSelector((state) => state.auth.user);
  const userInitial = authUser?.fullName?.charAt(0) || authUser?.email?.charAt(0) || 'U';

  const [statusFilter, setStatusFilter] = useState('');
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [anomalies, setAnomalies] = useState<DeviceAnomaly[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [stats, setStats] = useState({ events: 0, pending: 0, openAnomalies: 0 });
  const [latest, setLatest] = useState<{ events: SecurityEvent[]; anomalies: DeviceAnomaly[] }>({ events: [], anomalies: [] });

  // Bumping `request` (re)loads a list page; bumping `statsVersion` reloads the stat row.
  const [request, setRequest] = useState({ page: 0, version: 0 });
  const [statsVersion, setStatsVersion] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      getSecurityEvents(homeId, { size: 1 }),
      getSecurityEvents(homeId, { size: 1, status: 'DETECTED' }),
      getAnomalies(homeId, { size: 1, status: 'OPEN' }),
      getSecurityEvents(homeId, { size: 3 }),
      getAnomalies(homeId, { size: 3 }),
    ]).then(([all, pending, open, latestEvents, latestAnomalies]) => {
      if (!active) return;
      setStats({ events: all.totalElements, pending: pending.totalElements, openAnomalies: open.totalElements });
      setLatest({ events: latestEvents.content, anomalies: latestAnomalies.content });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [homeId, statsVersion]);

  // Page 0 replaces the list; later pages append ("Xem thêm").
  useEffect(() => {
    let active = true;
    const nextPage = request.page;
    const finish = (totalPages: number) => {
      setHasMore(nextPage + 1 < totalPages);
      setPage(nextPage);
      setError('');
    };
    const pending = tab === 'events'
      ? getSecurityEvents(homeId, { page: nextPage, size: PAGE_SIZE, status: (statusFilter || undefined) as SecurityEventStatus | undefined })
          .then((result) => {
            if (!active) return;
            setEvents((current) => (nextPage === 0 ? result.content : [...current, ...result.content]));
            finish(result.totalPages);
          })
      : getAnomalies(homeId, { page: nextPage, size: PAGE_SIZE, status: (statusFilter || undefined) as AnomalyStatus | undefined })
          .then((result) => {
            if (!active) return;
            setAnomalies((current) => (nextPage === 0 ? result.content : [...current, ...result.content]));
            finish(result.totalPages);
          });
    pending
      .catch((caught: unknown) => { if (active) setError(errorText(caught, 'Không tải được dữ liệu an ninh.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [homeId, tab, statusFilter, request]);

  const reload = (nextPage: number) => {
    setLoading(true);
    setRequest((current) => ({ page: nextPage, version: current.version + 1 }));
  };

  const runAction = async (id: string, action: () => Promise<unknown>, success: string) => {
    setWorkingId(id);
    try {
      await action();
      notify.success(success);
      reload(0);
      setStatsVersion((v) => v + 1);
    } catch (caught) {
      notify.error(errorText(caught, 'Không cập nhật được.'));
    } finally {
      setWorkingId(null);
    }
  };

  function eventCard(event: SecurityEvent): IncidentCard {
    const status = EVENT_STATUS[event.status];
    return {
      id: event.id,
      icon: event.eventType === 'INTRUSION' ? 'alert' : 'activity',
      tone: status.tone,
      title: event.eventType === 'INTRUSION' ? 'Phát hiện xâm nhập' : 'Phát hiện chuyển động',
      detail: [event.deviceName, event.location ?? event.roomName].filter(Boolean).join(' · '),
      time: event.detectedAt,
      statusLabel: status.label,
      actions: event.status === 'DETECTED' ? [
        { label: 'Báo động giả', run: () => runAction(event.id, () => updateSecurityEvent(homeId, event.id, 'dismiss'), 'Đã đánh dấu báo động giả') },
        { label: 'Xác nhận', primary: true, run: () => runAction(event.id, () => updateSecurityEvent(homeId, event.id, 'confirm'), 'Đã xác nhận sự kiện an ninh') },
      ] : [],
    };
  }

  function anomalyCard(anomaly: DeviceAnomaly): IncidentCard {
    const status = ANOMALY_STATUS[anomaly.status];
    const actions: CardAction[] = [];
    if (anomaly.status === 'OPEN') {
      actions.push({ label: 'Xác nhận', run: () => runAction(anomaly.id, () => acknowledgeAnomaly(homeId, anomaly.id), 'Đã xác nhận sự cố') });
    }
    if (anomaly.status !== 'RESOLVED') {
      actions.push({ label: 'Đã xử lý', primary: true, run: () => runAction(anomaly.id, () => resolveAnomaly(homeId, anomaly.id), 'Đã đánh dấu đã xử lý') });
    }
    if (anomaly.status !== 'RESOLVED' && anomaly.deviceId) {
      // Opens the maintenance form pre-filled; the ticket closes this anomaly once the device is repaired.
      const report = new URLSearchParams({ create: '1', deviceId: anomaly.deviceId, anomalyId: anomaly.id, note: ANOMALY_TITLE[anomaly.anomalyType] ?? '' });
      actions.push({ label: 'Báo hỏng', run: async () => navigate(`/homes/${encodeURIComponent(homeId)}/maintenance?${report.toString()}`) });
    }
    return {
      id: anomaly.id,
      icon: anomaly.anomalyType === 'SMOKE_DETECTED' || anomaly.anomalyType === 'GAS_LEAKAGE' ? 'flame'
        : anomaly.anomalyType === 'HIGH_TEMPERATURE' ? 'thermometer' : 'cloud',
      tone: status.tone,
      title: ANOMALY_TITLE[anomaly.anomalyType] ?? anomaly.anomalyType,
      detail: [anomaly.deviceName, anomaly.roomName, anomaly.currentValue && `Giá trị: ${anomaly.currentValue}`]
        .filter(Boolean).join(' · '),
      time: anomaly.detectedAt,
      statusLabel: status.label,
      actions,
    };
  }

  const needle = query.trim().toLowerCase();
  const cards = (tab === 'events' ? events.map(eventCard) : anomalies.map(anomalyCard))
    .filter((card) => !needle || `${card.title} ${card.detail}`.toLowerCase().includes(needle));

  const recent = [...latest.events.map(eventCard), ...latest.anomalies.map(anomalyCard)]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 3);

  const statusOptions: Array<{ id: string; label: string }> = tab === 'events'
    ? [{ id: '', label: 'Tất cả' }, ...Object.entries(EVENT_STATUS).map(([id, s]) => ({ id, label: s.label }))]
    : [{ id: '', label: 'Tất cả' }, ...Object.entries(ANOMALY_STATUS).map(([id, s]) => ({ id, label: s.label }))];

  const switchTab = (next: Tab) => {
    if (next === tab) return;
    reload(0);
    setStatusFilter('');
    setSearchParams(next === 'anomalies' ? { tab: 'anomalies' } : {}, { replace: true });
  };

  return (
    <div className="app-shell scenes-page studio st-theme st-pro">
      <DashboardNavRail
        homeId={homeId}
        activeItem="security"
        user={authUser ?? undefined}
        onSelectOverview={() => navigate('/home')}
      />
      <main className="sec-page">
        <PageHero
          eyebrow="An ninh & giám sát"
          title="Trung tâm an ninh"
          subtitle="Theo dõi chuyển động, xâm nhập và sự cố từ cảm biến trong ngôi nhà."
          userInitial={userInitial}
        />

        <section className="sec-stats" aria-label="Tổng quan an ninh">
          <StatCard icon="shield" tone="accent" label="Sự kiện an ninh" value={stats.events} />
          <StatCard icon="alert" tone="warn" label="Chưa xử lý" value={stats.pending} />
          <StatCard icon="activity" tone="danger" label="Bất thường đang mở" value={stats.openAnomalies} />
          <button type="button" className="sec-stat sec-stat-link" onClick={() => navigate(`/home/${homeId}/fall-detection`)}>
            <i className="sec-dot" aria-hidden={true} />
            <span>Giám sát té ngã & camera</span>
            <Icon name="chevron" size={18} />
          </button>
        </section>

        {error && (
          <div role="alert" className="st-alert error">
            <Icon name="alert" size={18} />
            <span>{error}</span>
          </div>
        )}

        <section className="sec-panel">
          <div className="sec-panel-head">
            <SectionTitle>Nhật ký an ninh</SectionTitle>
            <div className="sec-panel-tools">
              <label className="st-search">
                <Icon name="search" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo thiết bị, phòng…" aria-label="Tìm trong nhật ký" />
              </label>
              <button type="button" className="st-btn st-btn-primary" disabled={loading} onClick={() => { reload(0); setStatsVersion((v) => v + 1); }}>
                <Icon name="refresh" size={16} />
                Làm mới
              </button>
            </div>
          </div>

          <div className="st-toolbar">
            <div className="st-seg" role="tablist" aria-label="Loại nhật ký">
              <button type="button" role="tab" aria-selected={tab === 'events'} className={tab === 'events' ? 'active' : ''} onClick={() => switchTab('events')}>
                Sự kiện an ninh
              </button>
              <button type="button" role="tab" aria-selected={tab === 'anomalies'} className={tab === 'anomalies' ? 'active' : ''} onClick={() => switchTab('anomalies')}>
                Bất thường
              </button>
            </div>
            <div className="st-seg" role="tablist" aria-label="Lọc theo trạng thái">
              {statusOptions.map((option) => (
                <button key={option.id || 'all'} type="button" role="tab" aria-selected={statusFilter === option.id}
                  className={statusFilter === option.id ? 'active' : ''} onClick={() => { if (statusFilter !== option.id) { setStatusFilter(option.id); reload(0); } }}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {cards.length > 0 ? (
            <div className="sec-grid">
              {cards.map((card) => (
                <article key={card.id} className={`sec-card tone-${card.tone}`}>
                  <div className="sec-card-body">
                    <span className="sec-card-icon"><Icon name={card.icon} size={22} /></span>
                    <div>
                      <h3>{card.title}</h3>
                      <p>{card.detail || 'Không rõ thiết bị'}</p>
                      <span className="sec-pill">{card.statusLabel}</span>
                    </div>
                  </div>
                  <footer>
                    <span className="sec-time"><Icon name="clock" size={14} />{formatDateTime(card.time)}</span>
                    <span className="sec-actions">
                      {card.actions.map((action) => (
                        <button key={action.label} type="button" disabled={workingId !== null}
                          className={`st-btn st-btn-sm ${action.primary ? 'st-btn-primary' : ''}`} onClick={() => void action.run()}>
                          {action.label}
                        </button>
                      ))}
                    </span>
                  </footer>
                </article>
              ))}
            </div>
          ) : !loading && (
            <div className="st-empty">
              <div className="st-empty-icon"><Icon name="shield" /></div>
              <h3>{tab === 'events' ? 'Chưa có sự kiện an ninh' : 'Chưa có sự cố bất thường'}</h3>
              <p>{tab === 'events'
                ? 'Khi cảm biến chuyển động phát hiện có người, sự kiện sẽ được ghi lại tại đây.'
                : 'Khi cảm biến ghi nhận giá trị nguy hiểm hoặc mất kết nối, sự cố sẽ hiện tại đây.'}</p>
            </div>
          )}

          {loading && <div className="st-skeleton" style={{ height: 120 }} aria-busy="true" />}
          {hasMore && !loading && (
            <button type="button" className="st-btn sec-more" onClick={() => reload(page + 1)}>Xem thêm</button>
          )}
        </section>

        {recent.length > 0 && (
          <section className="sec-recent">
            <SectionTitle>Hoạt động gần đây</SectionTitle>
            <ul>
              {recent.map((card) => (
                <li key={card.id} className={`tone-${card.tone}`}>
                  <span className="sec-card-icon"><Icon name={card.icon} size={18} /></span>
                  <span className="sec-recent-text">
                    <strong>{card.title}</strong>
                    <small>{formatDateTime(card.time)}</small>
                  </span>
                  <span className="sec-pill">{card.statusLabel}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <DashboardBottomNav activeItem="more" homeId={homeId} />
    </div>
  );
}

function StatCard({ icon, tone, label, value }: { icon: IconName; tone: string; label: string; value: number }) {
  return (
    <div className={`sec-stat tone-${tone}`}>
      <span className="sec-stat-icon"><Icon name={icon} size={24} /></span>
      <span>
        <small>{label}</small>
        <strong>{String(value).padStart(2, '0')}</strong>
      </span>
    </div>
  );
}
