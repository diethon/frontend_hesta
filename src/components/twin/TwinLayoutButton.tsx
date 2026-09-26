import type { ButtonHTMLAttributes, ReactNode } from 'react';

const variants = {
  primary: 'bg-primary text-text hover:bg-primary-hover',
  secondary: 'border border-line bg-surface text-text hover:bg-sidebar-hover',
  danger: 'border border-error bg-error-soft text-text hover:bg-off-soft',
};
export function TwinLayoutButton({ variant = 'secondary', leadingIcon, children, ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & { variant?: keyof typeof variants; leadingIcon?: ReactNode }) {
  return <button type="button" {...props} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 whitespace-nowrap text-left text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]}`}>
    {leadingIcon ? <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface">{leadingIcon}</span> : null}{children}
  </button>;
}
