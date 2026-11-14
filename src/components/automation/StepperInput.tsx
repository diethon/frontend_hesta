import React from 'react';

export interface StepperInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  liveValue?: string | number;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export const StepperInput: React.FC<StepperInputProps> = ({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit,
  liveValue,
  label,
  disabled = false,
  className = '',
}) => {
  const handleDecrement = () => {
    if (disabled) return;
    const next = Math.max(min, value - step);
    onChange(next);
  };

  const handleIncrement = () => {
    if (disabled) return;
    const next = Math.min(max, value + step);
    onChange(next);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = Number(e.target.value);
    if (!Number.isNaN(num)) {
      onChange(Math.max(min, Math.min(max, num)));
    }
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider">
            {label}
          </label>
          {liveValue !== undefined && liveValue !== null && (
            <span className="text-[10px] text-[var(--tertiary)] font-medium">
              Hiện tại: <strong className="text-[var(--text)]">{liveValue}{unit ? ` ${unit}` : ''}</strong>
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center justify-between p-1 rounded-2xl border border-[var(--border)] bg-[var(--solid)]">
          <button
            type="button"
            disabled={disabled || value <= min}
            onClick={handleDecrement}
            className="w-10 h-10 rounded-xl bg-[var(--g1)] hover:bg-[var(--border)] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-sm font-bold text-[var(--text)] transition-colors cursor-pointer"
            aria-label="Giảm"
          >
            −
          </button>

          <div className="flex items-center justify-center gap-1 px-3">
            <input
              type="number"
              value={value}
              min={min}
              max={max}
              step={step}
              disabled={disabled}
              onChange={handleInputChange}
              className="w-14 text-center font-bold text-sm text-[var(--text)] bg-transparent border-0 focus:outline-none"
            />
            {unit && (
              <span className="text-xs font-semibold text-[var(--secondary)]">{unit}</span>
            )}
          </div>

          <button
            type="button"
            disabled={disabled || value >= max}
            onClick={handleIncrement}
            className="w-10 h-10 rounded-xl bg-[var(--g1)] hover:bg-[var(--border)] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-sm font-bold text-[var(--text)] transition-colors cursor-pointer"
            aria-label="Tăng"
          >
            +
          </button>
        </div>

        {unit && (
          <span className="px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--g1)] text-xs font-bold text-[var(--secondary)] shrink-0">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
};

