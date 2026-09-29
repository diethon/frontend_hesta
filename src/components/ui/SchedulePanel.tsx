import { useEffect, useState, type FormEvent } from 'react';
import { deleteSchedule, getSchedules, saveSchedule } from '../../services/scheduleApi';
import type { Schedule } from '../../types/schedule';

const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

interface Props {
  homeId: string;
  kind: 'scenes' | 'automation-rules';
  targetId: string;
}

export function SchedulePanel({ homeId, kind, targetId }: Props) {
  const [items, setItems] = useState<Schedule[]>([]);
  const [time, setTime] = useState('07:00');
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    getSchedules(homeId, kind, targetId)
      .then((result) => { if (active) setItems(result); })
      .catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : 'Không thể tải lịch.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [homeId, kind, targetId]);

  const refresh = async () => setItems(await getSchedules(homeId, kind, targetId));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(''); setSuccess('');
    try {
      await saveSchedule(homeId, kind, targetId, { scheduledTime: time, repeatDays, active: true }, editingId ?? undefined);
      await refresh(); setEditingId(null); setTime('07:00'); setRepeatDays([]);
      setSuccess('Đã lưu lịch.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể lưu lịch.'); }
    finally { setSaving(false); }
  };

  const toggle = async (item: Schedule) => {
    setError('');
    try {
      await saveSchedule(homeId, kind, targetId, { scheduledTime: item.scheduledTime,
        repeatDays: item.repeatDays, active: !item.active }, item.id);
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể đổi trạng thái lịch.'); }
  };

  const remove = async (item: Schedule) => {
    if (!window.confirm('Xóa lịch này?')) return;
    setError('');
    try { await deleteSchedule(homeId, kind, targetId, item.id); await refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể xóa lịch.'); }
  };

  return <section aria-label="Lịch tự động" className="mt-4 space-y-3 rounded-2xl border border-line bg-surface p-4 text-text">
    <h4 className="font-semibold">Lịch tự động</h4>
    {error && <p role="alert" className="rounded-xl bg-error-soft p-2 text-text">{error}</p>}
    {success && <p role="status" className="rounded-xl bg-success-soft p-2 text-text">{success}</p>}
    {loading ? <p>Đang tải lịch...</p> : items.length ? <ul className="space-y-2">{items.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2 text-sm">
      <span>{item.scheduledTime.slice(0, 5)} · {item.repeatDays.length ? item.repeatDays.map((day) => days[day - 1]).join(', ') : 'Hằng ngày'} · {item.active ? 'Đang bật' : 'Đang tắt'}{item.nextRunAt ? ` · Tiếp theo: ${new Date(item.nextRunAt).toLocaleString('vi-VN')}` : ''}</span>
      <span className="flex flex-wrap gap-2"><button type="button" onClick={() => { setEditingId(item.id); setTime(item.scheduledTime.slice(0, 5)); setRepeatDays(item.repeatDays); }} className="rounded-xl bg-sidebar px-3 py-2">Sửa</button><button type="button" onClick={() => void toggle(item)} className="rounded-xl bg-sidebar px-3 py-2">{item.active ? 'Tắt' : 'Bật'}</button><button type="button" onClick={() => void remove(item)} className="rounded-xl bg-error-soft px-3 py-2">Xóa</button></span>
    </li>)}</ul> : <p className="text-sm text-muted">Chưa có lịch tự động.</p>}
    <form onSubmit={submit} className="space-y-2 border-t border-line pt-3">
      <label className="block text-sm">Giờ chạy<input type="time" required value={time} onChange={(event) => setTime(event.target.value)} className="input mt-1" /></label>
      <fieldset><legend className="text-sm">Ngày lặp lại (để trống để chạy hằng ngày)</legend><div className="mt-2 flex flex-wrap gap-3">{days.map((label, index) => <label key={label} className="inline-flex items-center gap-1 text-sm"><input type="checkbox" checked={repeatDays.includes(index + 1)} onChange={(event) => setRepeatDays((current) => event.target.checked ? [...current, index + 1].sort() : current.filter((day) => day !== index + 1))} />{label}</label>)}</div></fieldset>
      <div className="flex gap-2"><button disabled={saving} className="rounded-xl bg-primary px-4 py-2 font-semibold text-white disabled:opacity-50">{saving ? 'Đang lưu...' : editingId ? 'Lưu lịch' : 'Thêm lịch'}</button>{editingId && <button type="button" onClick={() => { setEditingId(null); setTime('07:00'); setRepeatDays([]); }} className="rounded-xl bg-sidebar px-4 py-2">Hủy sửa</button>}</div>
    </form>
  </section>;
}
