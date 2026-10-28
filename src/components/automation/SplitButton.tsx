import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '../home/HomeIcons';

export interface SplitButtonProps {
  onAddDevice: () => void;
  onAddScene: () => void;
  disabled?: boolean;
  className?: string;
}

export const SplitButton: React.FC<SplitButtonProps> = ({
  onAddDevice,
  onAddScene,
  disabled = false,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="h-9 px-3.5 rounded-full border border-[var(--border)] bg-[var(--solid)] hover:bg-[var(--g1)] text-xs font-semibold text-[var(--text)] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
      >
        <span className="text-[var(--accent)] font-bold text-sm leading-none">+</span>
        <span>Thêm hành động</span>
        <span className={`text-[var(--tertiary)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          <Icon name="chevronDown" size={13} />
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-48 rounded-2xl border border-[var(--border)] bg-[var(--solid)] p-1.5 shadow-lg z-30 animate-in fade-in zoom-in-95">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onAddDevice();
            }}
            className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-[var(--text)] hover:bg-[var(--g1)] transition-colors flex items-center gap-2.5 cursor-pointer"
          >
            <span className="w-6 h-6 rounded-lg bg-[var(--muted)] flex items-center justify-center text-[var(--accent)] shrink-0">
              <Icon name="grid" size={13} />
            </span>
            <span>Điều khiển thiết bị</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onAddScene();
            }}
            className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-[var(--text)] hover:bg-[var(--g1)] transition-colors flex items-center gap-2.5 cursor-pointer mt-0.5"
          >
            <span className="w-6 h-6 rounded-lg bg-[var(--muted)] flex items-center justify-center text-[var(--accent)] shrink-0">
              <Icon name="sparkles" size={13} />
            </span>
            <span>Chạy kịch bản</span>
          </button>
        </div>
      )}
    </div>
  );
};
