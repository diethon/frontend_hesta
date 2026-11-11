import React, { useState } from 'react';
import { Icon } from '../home/HomeIcons';

interface AccordionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export const Accordion: React.FC<AccordionProps> = ({
  title,
  children,
  defaultOpen = false,
  className = '',
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`rounded-2xl border border-[var(--border)] bg-[var(--solid)] overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full px-3.5 py-2.5 flex items-center justify-between text-left text-xs font-semibold text-[var(--secondary)] hover:text-[var(--text)] transition-colors cursor-pointer"
      >
        <span>{title}</span>
        <Icon name={open ? 'chevronUp' : 'chevron'} size={14} className="text-[var(--tertiary)]" />
      </button>
      {open && <div className="px-3.5 pb-3 pt-1 border-t border-[var(--border)]">{children}</div>}
    </div>
  );
};

