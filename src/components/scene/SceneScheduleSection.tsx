import React, { useState, useEffect, useCallback } from 'react';
import { getSchedules, saveSchedule, deleteSchedule } from '../../services/scheduleApi';
import type { Schedule, ScheduleInput } from '../../types/schedule';
import { Icon } from '../home/HomeIcons';
import { notify } from '../ui/notify';

interface SceneScheduleSectionProps {
  homeId: string;
  sceneId?: string; // Scene or rule ID if editing existing entity
  targetId?: string; // Explicit target ID
  targetKind?: 'scenes' | 'automation-rules'; // Default: 'scenes'
  onScheduleCountChange?: (count: number) => void;
  onSchedulesChange?: (schedules: Schedule[]) => void;
}

const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const DAY_NAMES = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

export function formatRepeatDays(days: number[]): string {
  if (!days || days.length === 0 || days.length === 7) return 'Hằng ngày';
  if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return 'Ngày thường (T2–T6)';
  if (days.length === 2 && [6, 7].every((d) => days.includes(d))) return 'Cuối tuần (T7, CN)';
  return days
    .slice()
    .sort()
    .map((d) => DAY_LABELS[d - 1])
    .join(', ');
}

export const SceneScheduleSection: React.FC<SceneScheduleSectionProps> = ({
  homeId,
  sceneId,
  targetId,
  targetKind = 'scenes',
  onScheduleCountChange,
  onSchedulesChange,
}) => {
  const effectiveTargetId = targetId || sceneId;
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states for inline add/edit card
  const [hour, setHour] = useState('07');
  const [minute, setMinute] = useState('00');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  // Fetch schedules if effectiveTargetId exists
  const fetchSchedules = useCallback(async () => {
    if (!homeId || !effectiveTargetId) return;
    setLoading(true);
    try {
      const data = await getSchedules(homeId, targetKind, effectiveTargetId);
      const list = data || [];
      setSchedules(list);
      onScheduleCountChange?.(list.length);
      onSchedulesChange?.(list);
    } catch {
      // Fallback empty
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [homeId, targetKind, effectiveTargetId, onScheduleCountChange, onSchedulesChange]);

  useEffect(() => {
    void fetchSchedules();
  }, [fetchSchedules]);

  // Open inline add form
  const handleOpenAdd = () => {
    setEditingId(null);
    setHour('07');
    setMinute('00');
    setSelectedDays([]);
    setAdding(true);
  };

  // Open inline edit form
  const handleOpenEdit = (sch: Schedule) => {
    setEditingId(sch.id);
    const parts = (sch.scheduledTime || '07:00').slice(0, 5).split(':');
    setHour(parts[0] || '07');
    setMinute(parts[1] || '00');
    setSelectedDays(sch.repeatDays || []);
    setAdding(true);
  };

  // Close inline form
  const handleCloseForm = () => {
    setAdding(false);
    setEditingId(null);
  };

  // Check overlap with other schedules
  const currentFormattedTime = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  const overlappingSchedule = schedules.find((s) => {
    if (editingId && s.id === editingId) return false;
    const sTime = (s.scheduledTime || '').slice(0, 5);
    if (sTime !== currentFormattedTime) return false;

    // Both every day
    if ((!s.repeatDays || s.repeatDays.length === 0) && (!selectedDays || selectedDays.length === 0)) {
      return true;
    }
    // Shared days
    if (!selectedDays || selectedDays.length === 0) return true;
    if (!s.repeatDays || s.repeatDays.length === 0) return true;
    return selectedDays.some((d) => s.repeatDays.includes(d));
  });

  // Toggle day
  const handleToggleDay = (dayIndex: number) => {
    setSelectedDays((prev) =>
      prev.includes(dayIndex) ? prev.filter((d) => d !== dayIndex).sort() : [...prev, dayIndex].sort()
    );
  };

  // Presets
  const applyPreset = (preset: 'all' | 'weekdays' | 'weekend') => {
    if (preset === 'all') setSelectedDays([]);
    if (preset === 'weekdays') setSelectedDays([1, 2, 3, 4, 5]);
    if (preset === 'weekend') setSelectedDays([6, 7]);
  };

  // Save schedule
  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    const timeString = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    const payload: ScheduleInput = {
      scheduledTime: timeString,
      repeatDays: selectedDays,
      active: true,
    };

    if (!effectiveTargetId) {
      // In-memory mode for draft before creation
      const draftSch: Schedule = {
        id: editingId || `temp_${Date.now()}`,
        scheduledTime: timeString,
        repeatDays: selectedDays,
        active: true,
      };
      setSchedules((prev) => {
        const next = editingId
          ? prev.map((s) => (s.id === editingId ? draftSch : s))
          : [...prev, draftSch];
        onScheduleCountChange?.(next.length);
        onSchedulesChange?.(next);
        return next;
      });
      handleCloseForm();
      notify.success('Đã lưu lịch tự động');
      return;
    }

    setSaving(true);
    try {
      await saveSchedule(homeId, targetKind, effectiveTargetId, payload, editingId || undefined);
      await fetchSchedules();
      handleCloseForm();
      notify.success('Đã lưu lịch tự động');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể lưu lịch';
      notify.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Toggle schedule active
  const handleToggleSchedule = async (sch: Schedule) => {
    const nextState = !sch.active;
    // Optimistic
    setSchedules((prev) => {
      const next = prev.map((s) => (s.id === sch.id ? { ...s, active: nextState } : s));
      onSchedulesChange?.(next);
      return next;
    });

    if (effectiveTargetId && !sch.id.startsWith('temp_')) {
      try {
        await saveSchedule(
          homeId,
          targetKind,
          effectiveTargetId,
          {
            scheduledTime: sch.scheduledTime,
            repeatDays: sch.repeatDays,
            active: nextState,
          },
          sch.id
        );
      } catch {
        // Revert
        setSchedules((prev) => {
          const reverted = prev.map((s) => (s.id === sch.id ? { ...s, active: sch.active } : s));
          onSchedulesChange?.(reverted);
          return reverted;
        });
        notify.error('Không thể cập nhật trạng thái lịch');
      }
    }
  };

  // Delete schedule
  const handleDeleteSchedule = async (sch: Schedule) => {
    if (!window.confirm(`Xóa lịch chạy ${sch.scheduledTime.slice(0, 5)}?`)) return;

    setSchedules((prev) => {
      const next = prev.filter((s) => s.id !== sch.id);
      onScheduleCountChange?.(next.length);
      onSchedulesChange?.(next);
      return next;
    });

    if (effectiveTargetId && !sch.id.startsWith('temp_')) {
      try {
        await deleteSchedule(homeId, targetKind, effectiveTargetId, sch.id);
        notify.success('Đã xóa lịch chạy');
      } catch {
        void fetchSchedules();
        notify.error('Không thể xóa lịch chạy');
      }
    }
  };

  return (
    <div className="space-y-3">
      {/* List of Schedules */}
      {loading ? (
        <div className="p-4 text-center text-xs text-[var(--secondary)]">Đang tải lịch chạy...</div>
      ) : schedules.length > 0 ? (
        <div className="space-y-2">
          {schedules.map((sch) => {
            const timeStr = (sch.scheduledTime || '').slice(0, 5);
            return (
              <div
                key={sch.id}
                className="action-step-card glass-g1 p-3.5 rounded-2xl border border-[var(--border)] flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="action-step-bubble-36 w-9 h-9 rounded-xl bg-[var(--solid)] text-[var(--accent)] border border-[var(--border)] flex items-center justify-center shrink-0">
                    <Icon name="clock" size={18} />
                  </div>
                  <div>
                    <strong className="text-sm font-bold text-[var(--text)] block">{timeStr}</strong>
                    <span className="text-[11px] text-[var(--secondary)] block">
                      {formatRepeatDays(sch.repeatDays || [])}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Inline Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleSchedule(sch)}
                    className={`device-toggle-pill scale-80 cursor-pointer ${sch.active ? 'active' : ''}`}
                    aria-label={sch.active ? 'Tắt lịch' : 'Bật lịch'}
                  >
                    <span />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(sch)}
                    className="w-7 h-7 rounded-lg hover:bg-[var(--border)] flex items-center justify-center text-[var(--secondary)] cursor-pointer"
                    aria-label="Sửa lịch"
                  >
                    <Icon name="pencil" size={13} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteSchedule(sch)}
                    className="w-7 h-7 rounded-lg hover:bg-[var(--border)] flex items-center justify-center text-rose-500 cursor-pointer"
                    aria-label="Xóa lịch"
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : !adding ? (
        <div className="p-4 rounded-2xl border border-dashed border-[var(--border)] text-center text-xs text-[var(--tertiary)]">
          Chưa thiết lập lịch chạy tự động.
        </div>
      ) : null}

      {/* Inline Add / Edit Form Card */}
      {adding ? (
        <form onSubmit={handleSaveSchedule} className="action-step-card glass-g1 p-4 rounded-2xl border border-[var(--border)] space-y-3">
          <div className="flex items-center justify-between">
            <strong className="text-xs text-[var(--text)]">
              {editingId ? 'Chỉnh sửa lịch chạy' : 'Thêm giờ chạy'}
            </strong>
            <button
              type="button"
              onClick={handleCloseForm}
              className="text-[11px] text-[var(--tertiary)] hover:text-[var(--text)] cursor-pointer"
            >
              Hủy
            </button>
          </div>

          {/* Time Picker 24h */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[var(--secondary)] uppercase tracking-wider block">
              Giờ kích hoạt (24h)
            </label>
            <div className="flex items-center gap-2 justify-center py-2 bg-[var(--solid)] rounded-xl border border-[var(--border)]">
              <input
                type="number"
                min="0"
                max="23"
                value={hour}
                onChange={(e) => setHour(e.target.value.slice(-2))}
                className="w-12 text-center text-lg font-bold bg-transparent text-[var(--text)] focus:outline-none"
              />
              <span className="text-lg font-bold text-[var(--tertiary)]">:</span>
              <input
                type="number"
                min="0"
                max="59"
                value={minute}
                onChange={(e) => setMinute(e.target.value.slice(-2))}
                className="w-12 text-center text-lg font-bold bg-transparent text-[var(--text)] focus:outline-none"
              />
            </div>
          </div>

          {/* Day Pills */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-[var(--secondary)] uppercase tracking-wider block">
                Lặp lại vào
              </label>
              <div className="flex items-center gap-1.5 text-[10px] text-[var(--accent)] font-medium">
                <button type="button" onClick={() => applyPreset('all')} className="hover:underline cursor-pointer">
                  Mỗi ngày
                </button>
                <span>·</span>
                <button type="button" onClick={() => applyPreset('weekdays')} className="hover:underline cursor-pointer">
                  T2–T6
                </button>
                <span>·</span>
                <button type="button" onClick={() => applyPreset('weekend')} className="hover:underline cursor-pointer">
                  T7, CN
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {DAY_LABELS.map((dayLabel, idx) => {
                const dayNum = idx + 1;
                const isSelected = selectedDays.includes(dayNum);
                return (
                  <button
                    key={dayLabel}
                    type="button"
                    onClick={() => handleToggleDay(dayNum)}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                      isSelected
                        ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                        : 'bg-[var(--solid)] text-[var(--secondary)] border-[var(--border)] hover:bg-[var(--muted)]'
                    }`}
                    title={DAY_NAMES[idx]}
                  >
                    {dayLabel}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-[var(--tertiary)]">
              {selectedDays.length === 0 ? 'Không chọn ngày = chạy lặp lại hằng ngày' : formatRepeatDays(selectedDays)}
            </p>
          </div>

          {overlappingSchedule && (
            <p className="text-[10px] text-amber-600 font-medium">
              Trùng giờ với một lịch chạy hiện có ({overlappingSchedule.scheduledTime.slice(0, 5)}).
            </p>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCloseForm}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[var(--secondary)] hover:bg-[var(--muted)] cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[var(--accent)] text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Đang lưu...' : 'Lưu lịch'}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={handleOpenAdd}
          className="w-full py-2.5 rounded-2xl border border-dashed border-[var(--border)] text-xs font-bold text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Icon name="plus" size={14} />
          <span>+ Thêm giờ chạy</span>
        </button>
      )}
    </div>
  );
};
