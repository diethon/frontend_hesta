import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { CalendarDays, ChevronLeft, ChevronRight, List, RefreshCw } from 'lucide-react';
import type { UserResponse } from '../../types/auth';
import { adminListMaintenanceTickets } from '../../services/maintenanceApi';
import type { MaintenanceStatus, MaintenanceTicketSummary } from '../../types/maintenance';
import { getErrorMessage } from '../../utils/errors';
import { DashboardNavRail } from '../home/DashboardNavRail';
import { DashboardBottomNav } from '../home/DashboardBottomNav';
import { NotificationBell } from '../notification/NotificationBell';
import { ProfileModal } from '../profile/ProfileModal';
import { AdminMaintenanceModal } from './AdminMaintenanceModal';
import { btnGhost, fieldClass } from './MaintenanceModal';
import { PriorityPill, StatusPill } from './TicketDetailView';
import { STATUS_META, formatDateTime, formatMoney, formatRange } from './maintenanceFormat';

interface Props {
  user: UserResponse;
  onLogout: () => void;
  onProfileUpdate: (user: UserResponse) => void;
}

type View = 'list' | 'week';
const PAGE_SIZE = 20;
const dayLabel = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' });

const startOfWeek = (d: Date) => {
  const result = new Date(d);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7)); // Monday
  return result;
};

export function AdminMaintenancePage({ user, onProfileUpdate }: Props) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<View>('list');
  const [status, setStatus] = useState<MaintenanceStatus | ''>('SUBMITTED');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [tickets, setTickets] = useState<MaintenanceTicketSummary[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loadedKey, setLoadedKey] = useState('');
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const openTicketId = params.get('ticket');

  const requestKey = `${view}|${status}|${page}|${weekStart.toISOString()}|${version}`;
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    let active = true;
    const key = `${view}|${status}|${page}|${weekStart.toISOString()}|${version}`;
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const query = view === 'week'
      ? { page: 0, size: 100, from: weekStart.toISOString(), to: weekEnd.toISOString() }
      : { page, size: PAGE_SIZE, status: status || undefined };
    adminListMaintenanceTickets(query)
      .then((result) => {
        if (!active) return;
        setTickets((current) => (view === 'list' && page > 0 ? [...current, ...result.content] : result.content));
        setTotalPages(result.totalPages);
        setError('');
      })
      .catch((caught: unknown) => { if (active) setError(getErrorMessage(caught, 'Không tải được ticket bảo trì.')); })
      .finally(() => { if (active) setLoadedKey(key); });
    return () => { active = false; };
  }, [view, status, page, weekStart, version]);

  const reload = useCallback(() => { setPage(0); setVersion((v) => v + 1); }, []);
  const closeTicket = useCallback(() => setParams({}, { replace: true }), [setParams]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + i);
    return day;
  }), [weekStart]);

  const shiftWeek = (delta: number) => setWeekStart((w) => {
    const next = new Date(w);
    next.setDate(next.getDate() + delta * 7);
    return next;
  });

  const navItems = [
    { id: 'admin', icon: 'grid' as const, label: 'Quản lý thiết bị & QR', onClick: () => navigate('/admin'), active: false },
    { id: 'users', icon: 'users' as const, label: 'Quản lý người dùng', onClick: () => navigate('/admin/users'), active: false },
    { id: 'diagnostics', icon: 'activity' as const, label: 'Chẩn đoán hạ tầng IoT', onClick: () => navigate('/admin/diagnostics'), active: false },
    { id: 'maintenance', icon: 'wrench' as const, label: 'Bảo trì thiết bị', onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }), active: true },
  ];

  const ticketRow = (t: MaintenanceTicketSummary) => (
    <li key={t.id}>
      <button type="button" onClick={() => setParams({ ticket: t.id })}
        className="w-full text-left rounded-2xl border border-line bg-surface p-4 hover:border-primary transition-colors">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-mono text-muted">{t.code} · {t.homeName}</p>
            <h3 className="font-semibold truncate">{t.title}</h3>
          </div>
          <div className="flex gap-1.5"><PriorityPill priority={t.priority} /><StatusPill status={t.status} /></div>
        </div>
        <p className="text-sm text-muted mt-1 truncate">{t.deviceNames.join(', ')}</p>
        <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted">
          <span>Người gửi: {t.createdByName ?? '—'}</span>
          {t.scheduledStart && <span>Hẹn: {formatRange(t.scheduledStart, t.scheduledEnd)}{t.scheduleConfirmed ? '' : ' (chờ xác nhận)'}</span>}
          {t.quoteTotal != null && <span>Báo giá: {formatMoney(t.quoteTotal)}</span>}
          <span className="ml-auto">{formatDateTime(t.createdAt)}</span>
        </div>
      </button>
    </li>
  );

  return (
    <div className="app-shell min-h-screen bg-app text-text relative">
      <div className="mesh mesh-one pointer-events-none" />
      <div className="mesh mesh-two pointer-events-none" />
      <DashboardNavRail activeItem="maintenance" items={navItems} user={user} onOpenProfile={() => setProfileOpen(true)} hideSettings brandTitle="HESTA Admin Center" />

      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 pb-24 lg:pb-12">
        <header className="flex items-center justify-between gap-4 py-2 border-b border-line/60">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">Bảo trì thiết bị</h1>
            <p className="text-xs text-muted mt-0.5">Xếp lịch kiểm tra, gửi báo giá và ghi nhận kết quả sửa chữa.</p>
          </div>
          <NotificationBell />
        </header>

        <section className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-line p-1" role="tablist" aria-label="Chế độ xem">
            <button type="button" role="tab" aria-selected={view === 'list'} onClick={() => { setView('list'); setPage(0); }}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm ${view === 'list' ? 'bg-primary text-white' : 'text-muted'}`}>
              <List className="w-4 h-4" /> Danh sách
            </button>
            <button type="button" role="tab" aria-selected={view === 'week'} onClick={() => setView('week')}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm ${view === 'week' ? 'bg-primary text-white' : 'text-muted'}`}>
              <CalendarDays className="w-4 h-4" /> Lịch tuần
            </button>
          </div>
          {view === 'list' ? (
            <select className={fieldClass.replace('w-full', 'w-auto')} aria-label="Lọc trạng thái" value={status}
              onChange={(e) => { setStatus(e.target.value as MaintenanceStatus | ''); setPage(0); }}>
              <option value="">Tất cả trạng thái</option>
              {Object.entries(STATUS_META).map(([id, meta]) => <option key={id} value={id}>{meta.label}</option>)}
            </select>
          ) : (
            <div className="inline-flex items-center gap-1">
              <button type="button" aria-label="Tuần trước" className={btnGhost} onClick={() => shiftWeek(-1)}><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-sm font-semibold px-2">{dayLabel.format(days[0])} – {dayLabel.format(days[6])}</span>
              <button type="button" aria-label="Tuần sau" className={btnGhost} onClick={() => shiftWeek(1)}><ChevronRight className="w-4 h-4" /></button>
            </div>
          )}
          <button type="button" className={`${btnGhost} ml-auto`} onClick={reload} disabled={loading}><RefreshCw className="w-4 h-4" /> Làm mới</button>
        </section>

        {error && <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-600">{error}</p>}

        {view === 'list' ? (
          <>
            {tickets.length > 0 ? <ul className="grid gap-3 lg:grid-cols-2">{tickets.map(ticketRow)}</ul>
              : !loading && <p className="rounded-3xl border border-dashed border-line p-10 text-center text-sm text-muted">Không có ticket nào.</p>}
            {!loading && page + 1 < totalPages && (
              <button type="button" className={`${btnGhost} w-full`} onClick={() => setPage((p) => p + 1)}>Xem thêm</button>
            )}
          </>
        ) : (
          <div className="grid gap-3 md:grid-cols-7">
            {days.map((day) => {
              const items = tickets.filter((t) => t.scheduledStart && new Date(t.scheduledStart).toDateString() === day.toDateString());
              return (
                <section key={day.toISOString()} className="rounded-2xl border border-line bg-surface p-2 min-h-[120px]">
                  <h3 className="text-xs font-bold text-muted mb-2 capitalize">{dayLabel.format(day)}</h3>
                  <ul className="space-y-1.5">
                    {items.map((t) => (
                      <li key={t.id}>
                        <button type="button" onClick={() => setParams({ ticket: t.id })}
                          className={`w-full text-left rounded-xl border px-2 py-1.5 text-xs hover:border-primary ${t.scheduleConfirmed ? 'border-primary/30 bg-primary/5' : 'border-amber-500/40 bg-amber-500/5'}`}>
                          <strong className="block">{formatRange(t.scheduledStart, t.scheduledEnd).split('·')[1]}</strong>
                          <span className="block truncate">{t.homeName} · {t.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
        {loading && <div className="h-24 animate-pulse rounded-2xl bg-sidebar" aria-busy="true" />}
      </main>

      <DashboardBottomNav activeItem="maintenance" items={navItems.map((item, i) => ({ ...item, label: ['Thiết bị & QR', 'Người dùng', 'Chẩn đoán', 'Bảo trì'][i] }))} />

      {openTicketId && <AdminMaintenanceModal ticketId={openTicketId} onClose={closeTicket} onChanged={reload} />}
      {profileOpen && <ProfileModal isOpen onClose={() => setProfileOpen(false)} user={user} onProfileUpdate={onProfileUpdate} />}
    </div>
  );
}
