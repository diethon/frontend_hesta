import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Bot, CalendarClock, Mail, MailX, Plus, RefreshCw, Search, Wrench } from 'lucide-react';
import {
  getMaintenanceEmailPreference,
  listMaintenanceTickets,
  updateMaintenanceEmailPreference,
} from '../../services/maintenanceApi';
import type { MaintenanceStatus, MaintenanceTicketSummary } from '../../types/maintenance';
import { useAppSelector } from '../../store/hooks';
import { getErrorMessage } from '../../utils/errors';
import { notify } from '../ui/notify';
import { DashboardNavRail } from '../home/DashboardNavRail';
import { DashboardBottomNav } from '../home/DashboardBottomNav';
import { CreateMaintenanceModal } from './CreateMaintenanceModal';
import { MaintenanceAssistantDrawer } from './MaintenanceAssistantDrawer';
import { MaintenanceDetailModal } from './MaintenanceDetailModal';
import { btnGhost, btnPrimary, fieldClass } from './MaintenanceModal';
import { PriorityPill, StatusPill } from './TicketDetailView';
import { ACTIVE_STATUSES, STATUS_META, formatDateTime, formatMoney, formatRange } from './maintenanceFormat';

const PAGE_SIZE = 12;

/** Ticket statuses where the user is the one expected to act next. */
const needsUser = (t: MaintenanceTicketSummary) => t.status === 'QUOTED' || (t.status === 'SCHEDULED' && !t.scheduleConfirmed);

export function MaintenancePage() {
  const { homeId = '' } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const authUser = useAppSelector((state) => state.auth.user);

  const [status, setStatus] = useState<MaintenanceStatus | ''>('');
  const [query, setQuery] = useState('');
  const [tickets, setTickets] = useState<MaintenanceTicketSummary[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  // Loading is derived: the list is stale until the request for the current key settles.
  const [loadedKey, setLoadedKey] = useState('');
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [emailEnabled, setEmailEnabled] = useState<boolean | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getMaintenanceEmailPreference()
      .then((res) => { if (active) setEmailEnabled(res.maintenanceEmailEnabled); })
      .catch(() => { /* ignore if unavailable */ });
    return () => { active = false; };
  }, []);

  const toggleEmailPreference = async () => {
    if (emailEnabled == null || emailBusy) return;
    setEmailBusy(true);
    try {
      const next = !emailEnabled;
      const res = await updateMaintenanceEmailPreference(next);
      setEmailEnabled(res.maintenanceEmailEnabled);
      notify.success(res.maintenanceEmailEnabled ? 'Đã bật nhận email thông báo bảo trì' : 'Đã tắt nhận email thông báo bảo trì');
    } catch (caught) {
      notify.error(getErrorMessage(caught, 'Không cập nhật được cài đặt email.'));
    } finally {
      setEmailBusy(false);
    }
  };

  // ?create=1&deviceId=…&anomalyId=… opens the form pre-filled; ?assistant=1&deviceId=… opens the diagnostic assistant.
  const creating = params.get('create') === '1';
  const assistantOpen = params.get('assistant') === '1';
  const openTicketId = params.get('ticket');

  const requestKey = `${homeId}|${status}|${page}|${version}`;
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    let active = true;
    listMaintenanceTickets(homeId, { page, size: PAGE_SIZE, status: status || undefined })
      .then((result) => {
        if (!active) return;
        setTickets((current) => (page === 0 ? result.content : [...current, ...result.content]));
        setTotalPages(result.totalPages);
        setError('');
      })
      .catch((caught: unknown) => { if (active) setError(getErrorMessage(caught, 'Không tải được danh sách bảo trì.')); })
      .finally(() => { if (active) setLoadedKey(`${homeId}|${status}|${page}|${version}`); });
    return () => { active = false; };
  }, [homeId, status, page, version]);

  const reload = useCallback(() => { setPage(0); setVersion((v) => v + 1); }, []);

  const closeDialogs = useCallback(() => setParams({}, { replace: true }), [setParams]);
  const openTicket = (id: string) => setParams({ ticket: id });

  const needle = query.trim().toLowerCase();
  const visible = tickets.filter((t) => !needle
    || `${t.code} ${t.title} ${t.deviceNames.join(' ')}`.toLowerCase().includes(needle));
  const activeCount = tickets.filter((t) => ACTIVE_STATUSES.includes(t.status)).length;
  const waitingCount = tickets.filter(needsUser).length;

  return (
    <div className="app-shell min-h-screen bg-app text-text relative">
      <div className="mesh mesh-one pointer-events-none" />
      <div className="mesh mesh-two pointer-events-none" />
      <DashboardNavRail homeId={homeId} activeItem="maintenance" user={authUser ?? undefined} onSelectOverview={() => navigate('/home')} />

      <main id="main-content" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 pb-24 lg:pb-12">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line/60 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Bảo trì & sửa chữa</p>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Yêu cầu bảo trì thiết bị</h1>
            <p className="text-sm text-muted">Báo hỏng thiết bị, chọn giờ rảnh, theo dõi lịch hẹn, duyệt báo giá và xem lịch sử sửa chữa.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {emailEnabled != null && (
              <button
                type="button"
                className={btnGhost}
                disabled={emailBusy}
                onClick={() => void toggleEmailPreference()}
                title={emailEnabled ? 'Đang bật nhận email cập nhật bảo trì — bấm để tắt' : 'Đang tắt nhận email cập nhật bảo trì — bấm để bật'}
              >
                {emailEnabled ? <Mail className="w-4 h-4 text-primary" /> : <MailX className="w-4 h-4 text-muted" />}
                {emailEnabled ? 'Email bảo trì: Bật' : 'Email bảo trì: Tắt'}
              </button>
            )}
            <button type="button" className={btnGhost} onClick={() => setParams({ assistant: '1' })}>
              <Bot className="w-4 h-4 text-primary" /> Hỏi trợ lý chẩn đoán
            </button>
            <button type="button" className={btnPrimary} onClick={() => setParams({ create: '1' })}>
              <Plus className="w-4 h-4" /> Báo hỏng thiết bị
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3" aria-label="Tổng quan bảo trì">
          <Stat icon={<Wrench className="w-5 h-5" />} label="Đang xử lý" value={activeCount} />
          <Stat icon={<CalendarClock className="w-5 h-5" />} label="Chờ bạn phản hồi" value={waitingCount} highlight={waitingCount > 0} />
          <Stat icon={<RefreshCw className="w-5 h-5" />} label="Tổng yêu cầu đã tải" value={tickets.length} />
        </section>

        <section className="flex flex-wrap items-center gap-2">
          <label className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input className={`${fieldClass} pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo mã, tiêu đề, thiết bị…" aria-label="Tìm yêu cầu" />
          </label>
          <select className={fieldClass.replace('w-full', 'w-auto')} aria-label="Lọc trạng thái" value={status}
            onChange={(e) => { setStatus(e.target.value as MaintenanceStatus | ''); setPage(0); }}>
            <option value="">Tất cả trạng thái</option>
            {Object.entries(STATUS_META).map(([id, meta]) => <option key={id} value={id}>{meta.label}</option>)}
          </select>
          <button type="button" className={btnGhost} onClick={reload} disabled={loading}><RefreshCw className="w-4 h-4" /> Làm mới</button>
        </section>

        {error && <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-600">{error}</p>}

        {visible.length > 0 ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {visible.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => openTicket(t.id)}
                  className={`w-full text-left rounded-2xl border bg-surface p-4 hover:border-primary transition-colors ${needsUser(t) ? 'border-amber-500/50' : 'border-line'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-mono text-muted">{t.code}</p>
                      <h3 className="font-semibold truncate">{t.title}</h3>
                    </div>
                    <StatusPill status={t.status} />
                  </div>
                  <p className="text-sm text-muted mt-1 truncate">{t.deviceNames.join(', ')}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-muted">
                    <PriorityPill priority={t.priority} />
                    {t.source === 'CHATBOT' && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-600">
                        <Bot className="w-3 h-3" aria-hidden="true" /> Từ trợ lý
                      </span>
                    )}
                    {t.scheduledStart && <span className="inline-flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" />{formatRange(t.scheduledStart, t.scheduledEnd)}</span>}
                    {t.quoteTotal != null && <span>Báo giá: <strong className="text-text">{formatMoney(t.quoteTotal)}</strong></span>}
                    <span className="ml-auto">{formatDateTime(t.createdAt)}</span>
                  </div>
                  {needsUser(t) && (
                    <p className="mt-2 text-xs font-semibold text-amber-600">
                      {t.status === 'QUOTED' ? 'Cần bạn duyệt báo giá' : 'Cần bạn xác nhận lịch hẹn'}
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : !loading && (
          <div className="rounded-3xl border border-dashed border-line p-10 text-center">
            <Wrench className="w-8 h-8 mx-auto text-muted" aria-hidden="true" />
            <h3 className="mt-2 font-semibold">Chưa có yêu cầu bảo trì</h3>
            <p className="text-sm text-muted">Khi thiết bị gặp sự cố, bấm "Báo hỏng thiết bị" hoặc nút báo hỏng ngay trong trang thiết bị.</p>
          </div>
        )}
        {loading && <div className="h-28 animate-pulse rounded-2xl bg-sidebar" aria-busy="true" />}
        {!loading && page + 1 < totalPages && (
          <button type="button" className={`${btnGhost} w-full`} onClick={() => setPage((p) => p + 1)}>Xem thêm</button>
        )}
      </main>
      <DashboardBottomNav activeItem="more" homeId={homeId} />

      {creating && (
        <CreateMaintenanceModal
          homeId={homeId}
          initialDeviceId={params.get('deviceId') ?? undefined}
          initialAnomalyId={params.get('anomalyId') ?? undefined}
          initialNote={params.get('note') ?? undefined}
          onClose={closeDialogs}
          onCreated={(ticket) => { setParams({ ticket: ticket.id }, { replace: true }); reload(); }}
        />
      )}
      {assistantOpen && !creating && (
        <MaintenanceAssistantDrawer
          homeId={homeId}
          initialDeviceId={params.get('deviceId') ?? undefined}
          onClose={closeDialogs}
          onTicketCreated={() => reload()}
          onViewTicket={(ticketId) => { setParams({ ticket: ticketId }, { replace: true }); reload(); }}
          onSwitchToManual={(deviceId, note) => {
            const next: Record<string, string> = { create: '1' };
            if (deviceId) next.deviceId = deviceId;
            if (note) next.note = note;
            setParams(next, { replace: true });
          }}
        />
      )}
      {openTicketId && !creating && !assistantOpen && (
        <MaintenanceDetailModal homeId={homeId} ticketId={openTicketId} onClose={closeDialogs} onChanged={reload} />
      )}
    </div>
  );
}

function Stat({ icon, label, value, highlight }: { icon: ReactNode; label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border bg-surface p-4 ${highlight ? 'border-amber-500/50' : 'border-line'}`}>
      <span className={`flex h-10 w-10 items-center justify-center rounded-full ${highlight ? 'bg-amber-500/10 text-amber-600' : 'bg-primary/10 text-primary'}`}>{icon}</span>
      <span>
        <small className="block text-xs text-muted">{label}</small>
        <strong className="text-xl">{value}</strong>
      </span>
    </div>
  );
}
