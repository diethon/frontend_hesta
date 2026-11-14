import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Check, X, Filter } from 'lucide-react';
import type { DeviceSortOption } from './devicePageHelpers';

export interface DeviceFilterDropdownProps<T extends string = string> {
  labelPrefix: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  icon?: React.ReactNode;
  id?: string;
  minWidth?: string;
}

export const DeviceFilterDropdown = <T extends string>({
  labelPrefix,
  value,
  options,
  onChange,
  icon,
  id,
  minWidth = '180px',
}: DeviceFilterDropdownProps<T>): React.ReactElement => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, handleClose]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`${labelPrefix}: ${value}`}
        className="h-8 px-3 rounded-lg border border-[var(--border)] bg-transparent hover:bg-[var(--muted)]/50 text-xs font-medium text-[var(--text)] inline-flex items-center gap-1.5 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] select-none"
      >
        {icon}
        <span className="truncate max-w-[180px]">
          {labelPrefix}: <strong className="font-semibold text-[var(--text)]">{value}</strong>
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[var(--secondary)] shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label={`${labelPrefix} tùy chọn`}
          style={{ minWidth }}
          className="absolute right-0 top-full mt-1.5 z-40 max-h-64 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--solid)] p-1 shadow-lg backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
        >
          {options.map((opt) => {
            const isSelected = value === opt;
            return (
              <button
                key={opt}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt);
                  handleClose();
                  buttonRef.current?.focus();
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--accent)]/10 text-[var(--accent)] font-semibold'
                    : 'text-[var(--text)] hover:bg-[var(--muted)]/60'
                }`}
              >
                <span className="truncate">{opt}</span>
                {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-[var(--accent)]" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export interface DeviceMobileFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  typeFilter: string;
  onTypeChange: (val: string) => void;
  sort: DeviceSortOption;
  onSortChange: (val: DeviceSortOption) => void;
  typeOptions: readonly string[];
  sortOptions: readonly DeviceSortOption[];
}

export const DeviceMobileFilterModal: React.FC<DeviceMobileFilterModalProps> = ({
  isOpen,
  onClose,
  typeFilter,
  onTypeChange,
  sort,
  onSortChange,
  typeOptions,
  sortOptions,
}) => {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bộ lọc và sắp xếp"
      className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-[var(--solid)] border border-[var(--border)] rounded-t-3xl sm:rounded-2xl p-5 space-y-5 shadow-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[var(--secondary)]" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-[var(--text)]">Bộ lọc &amp; Sắp xếp</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--muted)]/50 transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section 1: Device Type */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[var(--secondary)] block">
            Loại thiết bị
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {typeOptions.map((opt) => {
              const isSelected = typeFilter === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onTypeChange(opt)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium text-left flex items-center justify-between gap-1.5 border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/30 font-semibold'
                      : 'border-[var(--border)] bg-transparent text-[var(--text)] hover:bg-[var(--muted)]/40'
                  }`}
                >
                  <span className="truncate">{opt}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-[var(--accent)]" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: Sort */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[var(--secondary)] block">
            Sắp xếp theo
          </label>
          <div className="space-y-1">
            {sortOptions.map((opt) => {
              const isSelected = sort === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onSortChange(opt)}
                  className={`w-full px-3 py-2.5 rounded-xl text-xs font-medium text-left flex items-center justify-between gap-2 border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/30 font-semibold'
                      : 'border-[var(--border)] bg-transparent text-[var(--text)] hover:bg-[var(--muted)]/40'
                  }`}
                >
                  <span className="truncate">{opt}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-[var(--accent)]" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-10 rounded-xl bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
          >
            Áp dụng
          </button>
        </div>
      </div>
    </div>
  );
};
