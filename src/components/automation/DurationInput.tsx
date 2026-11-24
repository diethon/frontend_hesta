import React, { useState } from 'react';
import { DURATION_UNITS, formatDuration } from './ruleTiming';

function bestUnit(seconds: number): number {
  if (seconds >= 3600 && seconds % 3600 === 0) return 3600;
  if (seconds >= 60 && seconds % 60 === 0) return 60;
  return 1;
}

/** Number + unit input that reports whole seconds; out-of-range values are shown but not reported. */
export const DurationInput: React.FC<{
  seconds: number;
  max: number;
  onChange: (seconds: number) => void;
  label: string;
}> = ({ seconds, max, onChange, label }) => {
  const [unit, setUnit] = useState(() => bestUnit(seconds));
  const [text, setText] = useState(() => String(seconds / bestUnit(seconds)));
  const [shown, setShown] = useState(seconds);

  const toSeconds = (t: string, u: number) => Math.round(Number(t.replace(',', '.')) * u);
  // A different saved value (e.g. another step) resets the fields; our own edits coming back do not.
  if (seconds !== shown) {
    setShown(seconds);
    if (toSeconds(text, unit) !== seconds) {
      setUnit(bestUnit(seconds));
      setText(String(seconds / bestUnit(seconds)));
    }
  }

  const value = toSeconds(text, unit);
  const valid = Number.isFinite(value) && value >= 1 && value <= max;
  const commit = (nextText: string, nextUnit: number) => {
    const next = toSeconds(nextText, nextUnit);
    if (Number.isFinite(next) && next >= 1 && next <= max && next !== seconds) onChange(next);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          step="any"
          inputMode="decimal"
          aria-label={label}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            commit(e.target.value, unit);
          }}
          className={`w-24 px-3 py-2 rounded-xl border bg-[var(--solid)] text-xs font-semibold text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] ${
            valid ? 'border-[var(--border)]' : 'border-rose-400'
          }`}
        />
        <select
          aria-label={`Đơn vị ${label.toLowerCase()}`}
          value={unit}
          onChange={(e) => {
            const u = Number(e.target.value);
            setUnit(u);
            commit(text, u);
          }}
          className="px-2.5 py-2 rounded-xl border border-[var(--border)] bg-[var(--solid)] text-xs text-[var(--text)] cursor-pointer"
        >
          {DURATION_UNITS.map((u) => (
            <option key={u.seconds} value={u.seconds}>
              {u.label}
            </option>
          ))}
        </select>
      </div>
      {!valid && (
        <p className="text-[10px] text-rose-500 font-semibold">Chọn từ 1 giây đến {formatDuration(max)}.</p>
      )}
    </div>
  );
};
