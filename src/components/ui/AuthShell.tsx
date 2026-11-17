import React from 'react';
import { Box, Lightbulb, ShieldCheck, Sparkles } from 'lucide-react';
import hestaLogo from '../../assets/hesta-logo.png';

interface AuthShellProps {
  children: React.ReactNode;
}

const features = [
  { Icon: Lightbulb, title: 'Điều khiển mọi thiết bị', text: 'Đèn, quạt, máy lạnh, cửa cuốn… trong một màn hình.' },
  { Icon: Sparkles, title: 'Tự động hóa thông minh', text: 'Kịch bản và quy tắc để ngôi nhà tự phản ứng.' },
  { Icon: Box, title: 'Digital Twin 3D', text: 'Nhìn toàn bộ ngôi nhà và trạng thái theo thời gian thực.' },
  { Icon: ShieldCheck, title: 'An tâm cho cả gia đình', text: 'Phân quyền thành viên và cảnh báo an ninh.' },
];

const Logo: React.FC<{ className: string }> = ({ className }) => (
  <img src={hestaLogo} alt="HESTA Smart Home System" className={className} />
);

export const AuthShell: React.FC<AuthShellProps> = ({ children }) => (
  <main id="main-content" className="relative grid min-h-[100dvh] grid-cols-[minmax(0,1fr)] overflow-hidden bg-app lg:grid-cols-[minmax(320px,0.85fr)_minmax(520px,1.15fr)]">
    <div className="soft-grid pointer-events-none absolute inset-0" />
    <section className="relative hidden flex-col justify-between gap-10 overflow-hidden border-r border-line bg-sidebar p-10 lg:flex xl:p-14">
      <Logo className="h-12 w-auto self-start" />
      <div className="max-w-md">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-xs font-semibold text-primary-hover shadow-soft">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />Ngôi nhà, theo cách của bạn
        </p>
        <h1 className="text-4xl font-bold leading-tight tracking-tight text-text xl:text-5xl">
          Điều khiển nhẹ nhàng. Sống an tâm hơn.
        </h1>
        <p className="mt-5 max-w-[44ch] text-base leading-7 text-muted">
          HESTA giúp cả gia đình quản lý thiết bị, thành viên và các kịch bản tự động trong một không gian thân thiện.
        </p>
        <ul className="mt-8 grid gap-4">
          {features.map(({ Icon, title, text }) => (
            <li key={title} className="flex items-start gap-3">
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-primary-hover shadow-soft"><Icon size={19} strokeWidth={1.9} /></span>
              <span><span className="block text-sm font-semibold text-text">{title}</span><span className="block text-sm text-muted">{text}</span></span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-muted">© HESTA · Smart Home System</p>
    </section>
    <section className="relative flex min-w-0 flex-col items-center justify-center gap-8 p-4 py-8 sm:p-8 lg:p-12">
      <Logo className="h-10 w-auto self-start lg:hidden" />
      {children}
    </section>
  </main>
);
