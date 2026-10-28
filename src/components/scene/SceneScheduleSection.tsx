import React, { useState, useEffect, useCallback } from 'react';
import { getSchedules, saveSchedule, deleteSchedule } from '../../services/scheduleApi';
import type { Schedule, ScheduleInput } from '../../types/schedule';
import { Icon } from '../home/HomeIcons';
import { notify } from '../ui/notify';

interface SceneScheduleSectionProps {
  homeId: string;
  sceneId?: string; // Scene ID if editing existing scene, otherwise draft schedules in-memory
  onScheduleCountChange?: (count: number) => void;
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
  onScheduleCountChange,
}) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states for inline add/edit card
  const [hour, setHour] = useState('07');
  const [minute, setMinute] = useState('00');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  // Fetch schedules if sceneId exists
  const fetchSchedules = useCallback(async () => {
    if (!homeId || !sceneId) return;
    setLoading(true);
    try {
      const data = await getSchedules(homeId, 'scenes', sceneId);
      const list = data || [];
      setSchedules(list);
      onScheduleCountChange?.(list.length);
    } catch {
      // Fallback empty
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [homeId, sceneId, onScheduleCountChange]);

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

    if (!sceneId) {
      // In-memory mode for draft scene before creation
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
        return next;
      });
      handleCloseForm();
      notify.success('Đã lưu lịch tự động');
      return;
    }

    setSaving(true);
    try {
      await saveSchedule(homeId, 'scenes', sceneId, payload, editingId || undefined);
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
    setSchedules((prev) =>
      prev.map((s) => (s.id === sch.id ? { ...s, active: nextState } : s))
    );

    if (sceneId && !sch.id.startsWith('temp_')) {
      try {
        await saveSchedule(
          homeId,
          'scenes',
          sceneId,
          {
            scheduledTime: sch.scheduledTime,
            repeatDays: sch.repeatDays,
            active: nextState,
          },
          sch.id
        );
      } catch {
        // Revert
        setSchedules((prev) =>
          prev.map((s) => (s.id === sch.id ? { ...s, active: sch.active } : s))
        );
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
      return next;
    });

    if (sceneId && !sch.id.startsWith('temp_')) {
      try {
        await deleteSchedule(homeId, 'scenes', sceneId, sch.id);
        notify.success('Đã xóa lịch chạy');
      } catch {
        await fetchSchedules();
        notify.error('Lỗi khi xóa lịch chạy');
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <strong className="text-sm font-bold text-[var(--text)] block">Lịch chạy</strong>
          <small className="text-[11px] text-[var(--tertiary)]">
            Tự động chạy kịch bản vào giờ cố định
          </small>
        </div>
        {!adding && (
          <button
            type="button"
            className="scene-ghost text-xs h-9 px-3.5"
            onClick={handleOpenAdd}
          >
            + Thêm lịch
          </button>
        )}
      </div>

      {/* Inline Add / Edit Card */}
      {adding && (
        <form onSubmit={handleSaveSchedule} className="schedule-card-inline animate-in fade-in">
          <div className="flex items-center justify-between">
            <strong className="text-xs font-bold text-[var(--text)]">
              {editingId ? 'Chỉnh sửa lịch chạy' : 'Thêm lịch chạy mới'}
            </strong>
            <button
              type="button"
              className="text-xs text-[var(--tertiary)] hover:text-[var(--text)]"
              onClick={handleCloseForm}
            >
              Đóng
            </button>
          </div>

          {/* Time Wheel / Steppers (24h) */}
          <div className="flex flex-col items-center gap-1.5 py-2">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="23"
                value={hour}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(23, Number(e.target.value) || 0));
                  setHour(String(val).padStart(2, '0'));
                }}
                className="w-16 h-14 rounded-2xl bg-[var(--solid)] border border-[var(--border)] text-center text-2xl font-bold text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
              <span className="text-2xl font-bold text-[var(--secondary)]">:</span>
              <input
                type="number"
                min="0"
                max="59"
                value={minute}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(59, Number(e.target.value) || 0));
                  setMinute(String(val).padStart(2, '0'));
                }}
                className="w-16 h-14 rounded-2xl bg-[var(--solid)] border border-[var(--border)] text-center text-2xl font-bold text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
            </div>
            <span className="text-[10px] text-[var(--tertiary)]">Định dạng 24 giờ (Giờ : Phút)</span>
          </div>

          {/* Presets */}
          <div className="flex items-center gap-2 justify-center">
            <button
              type="button"
              className={`command-chip ${selectedDays.length === 0 ? 'active' : ''}`}
              onClick={() => applyPreset('all')}
            >
              Hằng ngày
            </button>
            <button
              type="button"
              className={`command-chip ${
                selectedDays.length === 5 && [1, 2, 3, 4, 5].every((d) => selectedDays.includes(d))
                  ? 'active'
                  : ''
              }`}
              onClick={() => applyPreset('weekdays')}
            >
              Ngày thường
            </button>
            <button
              type="button"
              className={`command-chip ${
                selectedDays.length === 2 && [6, 7].every((d) => selectedDays.includes(d))
                  ? 'active'
                  : ''
              }`}
              onClick={() => applyPreset('weekend')}
            >
              Cuối tuần
            </button>
          </div>

          {/* 7 Round Day Toggles */}
          <div>
            <div className="day-chips-grid">
              {DAY_LABELS.map((label, idx) => {
                const dayNum = idx + 1;
                const isSelected = selectedDays.includes(dayNum);
                return (
                  <button
                    key={label}
                    type="button"
                    className={`day-chip-toggle ${isSelected ? 'active' : ''}`}
                    onClick={() => handleToggleDay(dayNum)}
                    title={DAY_NAMES[idx]}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-[var(--tertiary)] text-center mt-2">
              Không chọn ngày = chạy hằng ngày
            </p>
          </div>

          {/* Overlap Warning */}
          {overlappingSchedule && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 text-xs text-center font-medium">
              Trùng với lịch {overlappingSchedule.scheduledTime.slice(0, 5)} đã có
            </div>
          )}

          {/* Card Buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
            <button
              type="button"
              className="scene-ghost h-9 px-4 text-xs"
              onClick={handleCloseForm}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="add-device h-9 px-4 text-xs"
              disabled={saving}
            >
              {saving ? 'Đang lưu…' : 'Lưu lịch'}
            </button>
          </div>
        </form>
      )}

      {/* Existing Schedules List */}
      {loading ? (
        <div className="p-6 text-center text-xs text-[var(--tertiary)]">
          Đang tải lịch chạy...
        </div>
      ) : schedules.length === 0 && !adding ? (
        <div className="p-6 rounded-2xl border border-dashed border-[var(--border)] text-center text-xs text-[var(--tertiary)]">
          Chưa có lịch · Kịch bản chỉ chạy khi bạn bấm Chạy.
        </div>
      ) : (
        <div className="space-y-2">
          {schedules.map((sch) => {
            const timeStr = (sch.scheduledTime || '07:00').slice(0, 5);
            const repeatStr = formatRepeatDays(sch.repeatDays);

            return (
              <div key={sch.id} className="schedule-item-row glass-g1">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="action-step-bubble-36">
                    <Icon name="clock" size={18} />
                  </div>
                  <div className="min-w-0">
                    <span className="time-title block">{timeStr}</span>
                    <span className="text-[11px] text-[var(--secondary)] block truncate">
                      {repeatStr}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    className={`toggle ${sch.active ? 'active' : ''}`}
                    onClick={() => handleToggleSchedule(sch)}
                    title={sch.active ? 'Tắt lịch' : 'Bật lịch'}
                  >
                    <span />
                  </button>

                  <button
                    type="button"
                    className="p-1 rounded-lg text-[var(--tertiary)] hover:text-[var(--text)] transition-colors"
                    onClick={() => handleOpenEdit(sch)}
                    title="Chỉnh sửa lịch"
                  >
                    <Icon name="pencil" size={15} />
                  </button>

                  <button
                    type="button"
                    className="p-1 rounded-lg text-[var(--tertiary)] hover:text-rose-500 transition-colors"
                    onClick={() => handleDeleteSchedule(sch)}
                    title="Xóa lịch"
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
