import React from 'react';
import { Icon, type IconName } from '../home/HomeIcons';

export interface PickerFieldProps {
  label?: string;
  placeholder?: string;
  value?: string;
  subtitle?: string;
  caption?: string; // alias for subtitle
  icon?: IconName;
  statusDot?: 'online' | 'offline' | 'none';
  error?: string;
  hasError?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

export const PickerField: React.FC<PickerFieldProps> = ({
  label,
  placeholder = 'Chọn một mục...',
  value,
  subtitle,
  caption,
  icon,
  statusDot = 'none',
  error,
  hasError = false,
  disabled = false,
  onClick,
  className = '',
}) => {
  const displaySubtitle = subtitle || caption;
  const isError = Boolean(error || hasError);

  return (
    <div className={`space-y-1 ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border transition-all flex items-center justify-between text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          isError
            ? 'border-rose-300 bg-rose-50/50'
            : 'border-[var(--border)] bg-[var(--solid)] hover:bg-[var(--muted)]/60'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 pr-2">
          {icon && (
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                isError
                  ? 'bg-rose-100 text-rose-600'
                  : 'bg-[var(--accent-soft)] text-[var(--accent)]'
              }`}
            >
              <Icon name={icon} size={16} />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <span
              className={`text-xs block truncate ${
                label ? 'font-bold text-[var(--text)]' : 'text-[var(--tertiary)] italic'
              }`}
            >
              {label || value || placeholder}
            </span>

            {displaySubtitle && (
              <span className="text-[11px] text-[var(--secondary)] block truncate mt-0.5">
                {displaySubtitle}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {statusDot !== 'none' && (
            <span
              className={`w-2 h-2 rounded-full ${
                statusDot === 'online' ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
              title={statusDot === 'online' ? 'Trực tuyến' : 'Ngoại tuyến'}
            />
          )}
          <Icon name="chevron" size={15} className="text-[var(--tertiary)]" />
        </div>
      </button>

      {error && <p className="text-[10px] text-rose-500 font-semibold">{error}</p>}
    </div>
  );
};
