import React from 'react';

type SidebarItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
};

interface AppSidebarProps {
  activeItem: string;
  items: SidebarItem[];
  contextLabel: string;
}

export const HomeIcon = () => (
  <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
    <path strokeLinecap="round" strokeLinejoin="round" d="m4 10 8-7 8 7v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 21v-7h6v7" />
  </svg>
);

export const BrandMark: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <div className="flex items-center gap-3">
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-soft">
      <HomeIcon />
    </div>
    {compact ? null : (
      <div>
        <p className="text-lg font-bold tracking-tight text-text">HESTA</p>
        <p className="text-xs font-medium text-muted">Smart Home</p>
      </div>
    )}
  </div>
);

export const DeviceIcon = () => (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 3h8v6H8zM5 14h14v7H5zM12 9v5M8 17h.01M12 17h.01" />
    </svg>
  );

export const SceneIcon = () => (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 4h14v5H5zM5 15h14v5H5zM9 9v6M15 9v6" />
    </svg>
  );

export const PeopleIcon = () => (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM16 11a3 3 0 0 0 0-6M17 15a4 4 0 0 1 4 4v1" />
    </svg>
  );

export const AdminIcon = () => (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 4.5 6v5c0 4.8 3.1 8.5 7.5 10 4.4-1.5 7.5-5.2 7.5-10V6L12 3Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" />
    </svg>
  );

export const AppSidebar: React.FC<AppSidebarProps> = ({ activeItem, items, contextLabel }) => (
  <aside className="app-sidebar fixed inset-y-0 left-0 z-30 hidden w-64 flex-col p-5 lg:flex">
    <div className="px-2 py-1">
      <BrandMark />
    </div>

    <div className="mt-8 px-3 text-xs font-semibold text-muted">{contextLabel}</div>
    <nav aria-label="Điều hướng chính" className="mt-3 space-y-1.5">
      {items.map((item) => {
        const active = item.id === activeItem;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={item.onClick}
            className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-sm font-semibold transition-colors active:translate-y-px ${
              active
                ? 'bg-sidebar-active text-primary-hover'
                : 'text-muted hover:bg-sidebar-hover hover:text-text'
            }`}
          >
            <span className={active ? 'text-primary' : 'text-icon'}>{item.icon}</span>
            {item.label}
          </button>
        );
      })}
    </nav>

    <div className="mt-auto rounded-2xl border border-line bg-white/80 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-text">
        <span className="status-pulse h-2 w-2 rounded-full bg-success" />
        Hệ thống ổn định
      </div>
      <p className="mt-2 text-xs leading-5 text-muted">Nhà của bạn đang được kết nối an toàn.</p>
    </div>
  </aside>
);
