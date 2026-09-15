import React from 'react';
import { BrandMark } from './AppSidebar';

interface AuthShellProps {
  children: React.ReactNode;
}

export const AuthShell: React.FC<AuthShellProps> = ({ children }) => (
  <main id="main-content" className="relative grid min-h-[100dvh] grid-cols-[minmax(0,1fr)] overflow-hidden bg-app lg:grid-cols-[minmax(320px,0.85fr)_minmax(520px,1.15fr)]">
    <div className="soft-grid pointer-events-none absolute inset-0" />
    <section className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 lg:flex xl:p-14">
      <BrandMark />
      <div className="max-w-md">
        <p className="mb-4 text-sm font-semibold text-primary-hover">Ngôi nhà, theo cách của bạn</p>
        <h1 className="text-4xl font-bold leading-tight tracking-tight text-text xl:text-5xl">
          Điều khiển nhẹ nhàng. Sống an tâm hơn.
        </h1>
        <p className="mt-5 max-w-[44ch] text-base leading-7 text-muted">
          HESTA giúp cả gia đình quản lý thiết bị, thành viên và các kịch bản tự động trong một không gian thân thiện.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm text-muted">
        <div className="rounded-2xl border border-line bg-white/70 p-4">
          <span className="mb-3 block h-2 w-8 rounded-full bg-success" />
          Kết nối ổn định
        </div>
        <div className="rounded-2xl border border-line bg-white/70 p-4">
          <span className="mb-3 block h-2 w-8 rounded-full bg-primary" />
          Trải nghiệm dễ dùng
        </div>
      </div>
    </section>
    <section className="relative min-w-0 flex items-center justify-center p-4 sm:p-8 lg:p-12">
      <div className="absolute left-5 top-5 lg:hidden">
        <BrandMark />
      </div>
      {children}
    </section>
  </main>
);
