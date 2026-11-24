import { Plus, Trash2 } from 'lucide-react';
import { newSlotDraft, slotProblem, toDateInput, type SlotDraft } from './maintenanceFormat';

interface SlotEditorProps {
  value: SlotDraft[];
  onChange: (next: SlotDraft[]) => void;
}

const inputClass = 'min-h-[40px] rounded-xl border border-line bg-surface px-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

export function SlotEditor({ value, onChange }: SlotEditorProps) {
  const today = new Date();
  const maxDay = new Date();
  maxDay.setDate(maxDay.getDate() + 14);
  const problem = slotProblem(value);

  const update = (key: string, patch: Partial<SlotDraft>) =>
    onChange(value.map((slot) => (slot.key === key ? { ...slot, ...patch } : slot)));

  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold text-text">
        Khung giờ bạn rảnh <span className="text-muted font-normal">(1–5 khung, 07:00–21:00, trong 14 ngày tới)</span>
      </legend>
      {value.map((slot, index) => (
        <div key={slot.key} className="flex flex-wrap items-center gap-2">
          <input type="date" aria-label={`Ngày khung ${index + 1}`} className={inputClass} value={slot.date}
            min={toDateInput(today)} max={toDateInput(maxDay)} onChange={(e) => update(slot.key, { date: e.target.value })} />
          <input type="time" aria-label={`Bắt đầu khung ${index + 1}`} className={inputClass} value={slot.start}
            min="07:00" max="21:00" step={900} onChange={(e) => update(slot.key, { start: e.target.value })} />
          <span className="text-muted text-sm">→</span>
          <input type="time" aria-label={`Kết thúc khung ${index + 1}`} className={inputClass} value={slot.end}
            min="07:00" max="21:00" step={900} onChange={(e) => update(slot.key, { end: e.target.value })} />
          <button type="button" aria-label={`Xoá khung ${index + 1}`} disabled={value.length === 1}
            className="rounded-xl p-2 text-muted hover:bg-surface-hover hover:text-rose-600 disabled:opacity-40"
            onClick={() => onChange(value.filter((s) => s.key !== slot.key))}>
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      {value.length < 5 && (
        <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover"
          onClick={() => onChange([...value, newSlotDraft(value.length + 1)])}>
          <Plus className="w-3.5 h-3.5" /> Thêm khung giờ
        </button>
      )}
      {problem && <p className="text-xs text-rose-600" role="alert">{problem}</p>}
    </fieldset>
  );
}
