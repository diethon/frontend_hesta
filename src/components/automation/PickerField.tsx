import React from 'react';
import { Icon, type IconName } from '../home/HomeIcons';

export interface PickerFieldProps {
  label?: string;
  placeholder?: string;
  value?: string;
  subtitle?: string;
  icon?: IconName;
  statusDot?: 'online' | 'offline' | 'none';
  error?: string;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

export const PickerField: React.FC<PickerFieldProps> = ({
  label,
  placeholder = 'Chọn một mục...',
  value,
  subtitle,
  icon,
  statusDot = 'none',
  error,
  disabled = false,
  onClick,
  className = '',
}) => {
  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="block text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider">
          {label}
        </label>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`w-full min-h-[46px] px-3.5 py-2.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 ${
          error
            ? 'border-rose-400 bg-rose-50/20'
            : 'border-[var(--border)] bg-[var(--solid)] hover:border-[var(--accent)]'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {icon && (
            <div className="w-8 h-8 rounded-xl bg-[var(--muted)] flex items-center justify-center shrink-0 text-[var(--secondary)]">
              <Icon name={icon} size={16} />
            </div>
          )}

          <div className="min-w-0 flex-1">
            {value ? (
              <span className="text-xs font-semibold text-[var(--text)] block truncate">
                {value}
              </span>
            ) : (
              <span className="text-xs text-[var(--tertiary)] italic block truncate">
                {placeholder}
              </span>
            )}

            {(subtitle || statusDot !== 'none') && (
              <div className="flex items-center gap-1.5 mt-0.5">
                {statusDot !== 'none' && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      statusDot === 'online' ? 'bg-emerald-500' : 'bg-slate-400'
                    }`}
                  />
                )}
                {subtitle && (
                  <span className="text-[10px] text-[var(--tertiary)] truncate">
                    {subtitle}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="text-[var(--tertiary)] shrink-0">
          <Icon name="chevronDown" size={16} />
        </div>
      </button>

      {error && (
        <span className="block text-[11px] text-rose-500 font-medium">{error}</span>
      )}
    </div>
  );
};

