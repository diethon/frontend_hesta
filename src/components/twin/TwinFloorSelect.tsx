import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, House, Layers3 } from 'lucide-react';

type FloorValue = number | 'all';

export function TwinFloorSelect({ floors, value, onChange, allLabel = 'Toàn nhà', ariaLabel = 'Chọn tầng' }: {
  floors: readonly number[];
  value: FloorValue;
  onChange: (floor: FloorValue) => void;
  allLabel?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();
  const options = [
    { value: 'all' as const, label: allLabel, description: `Hiển thị toàn bộ ${floors.length} tầng` },
    ...[...floors].reverse().map((floor) => ({ value: floor, label: `Tầng ${floor}`, description: 'Xem riêng mặt bằng tầng' })),
  ];
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selectedLabel = options[selectedIndex].label;
  const SelectedIcon = value === 'all' ? House : Layers3;

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  useEffect(() => {
    if (open) optionRefs.current[selectedIndex]?.focus();
  }, [open, selectedIndex]);

  const selectFloor = (floor: FloorValue) => {
    onChange(floor);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const moveOptionFocus = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    const lastIndex = options.length - 1;
    const nextIndex = event.key === 'ArrowDown' ? Math.min(lastIndex, index + 1)
      : event.key === 'ArrowUp' ? Math.max(0, index - 1)
        : event.key === 'Home' ? 0
          : event.key === 'End' ? lastIndex
            : index;
    if (nextIndex !== index) {
      event.preventDefault();
      optionRefs.current[nextIndex]?.focus();
    }
  };

  return <div ref={rootRef} className="relative inline-block text-left">
    <button
      ref={triggerRef}
      type="button"
      role="combobox"
      aria-label={ariaLabel}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? listboxId : undefined}
      data-floor-count={floors.length}
      data-value={value}
      onClick={() => setOpen((current) => !current)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          setOpen(true);
        } else if (event.key === 'Escape') {
          setOpen(false);
        }
      }}
      className={`group flex min-h-12 min-w-40 items-center gap-3 rounded-2xl border bg-surface/95 p-2 pr-3 text-left shadow-soft transition-colors ${open ? 'border-primary ring-4 ring-info-soft' : 'border-line hover:border-primary hover:bg-info-soft'}`}
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${open ? 'bg-primary text-white' : 'bg-info-soft text-primary-hover group-hover:bg-surface'}`}>
        <SelectedIcon size={16} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-muted">Đang xem</span>
        <span className="block truncate text-sm font-semibold text-text">{selectedLabel}</span>
      </span>
      <ChevronDown size={16} className={`shrink-0 text-icon transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
    </button>

    {open ? <div id={listboxId} role="listbox" aria-label={ariaLabel} className="gentle-rise absolute right-0 z-50 mt-2 min-w-60 overflow-hidden rounded-2xl border border-line bg-surface p-2 shadow-float">
      <div className="border-b border-line px-3 py-2">
        <p className="text-xs font-semibold text-text">Chọn không gian hiển thị</p>
        <p className="mt-0.5 text-xs text-muted">Toàn nhà hoặc một tầng riêng</p>
      </div>
      <div className="custom-scrollbar mt-1 max-h-64 overflow-y-auto">
        {options.map((option, index) => {
          const selected = option.value === value;
          const OptionIcon = option.value === 'all' ? House : Layers3;
          return <button
            key={option.value}
            ref={(node) => { optionRefs.current[index] = node; }}
            type="button"
            role="option"
            aria-selected={selected}
            data-value={option.value}
            onClick={() => selectFloor(option.value)}
            onKeyDown={(event) => moveOptionFocus(event, index)}
            className={`mt-1 flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${selected ? 'bg-primary text-white' : 'text-text hover:bg-sidebar-hover'}`}
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-surface/20 text-white' : 'bg-info-soft text-primary-hover'}`}>
              <OptionIcon size={16} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{option.label}</span>
              <span className={`block truncate text-xs ${selected ? 'text-white/80' : 'text-muted'}`}>{option.description}</span>
            </span>
            {selected ? <Check size={17} className="shrink-0" aria-hidden="true" /> : null}
          </button>;
        })}
      </div>
    </div> : null}
  </div>;
}
