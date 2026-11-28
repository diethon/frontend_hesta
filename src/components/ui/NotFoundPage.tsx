import { Link, useLocation, useNavigate } from 'react-router';
import hestaLogo from '../../assets/hesta-logo.png';
import type { UserResponse } from '../../types/auth';
import { Icon } from './LucideIcon';
import type { IconName } from './LucideIcon';

type Shortcut = { to: string; icon: IconName; title: string; description: string };

function shortcutsFor(user: UserResponse | null): Shortcut[] {
  if (!user) {
    return [
      { to: '/login', icon: 'lock', title: 'Đăng nhập', description: 'Vào lại ngôi nhà của bạn' },
      { to: '/register', icon: 'users', title: 'Đăng ký', description: 'Tạo tài khoản HESTA mới' },
      { to: '/twin-demo', icon: 'cube', title: 'Căn hộ mẫu', description: 'Xem thử Digital Twin 3D' },
    ];
  }
  if (user.platformRole === 'ADMIN') {
    return [
      { to: '/admin', icon: 'grid', title: 'Bảng điều khiển', description: 'Tổng quan hệ thống' },
      { to: '/admin/users', icon: 'users', title: 'Người dùng', description: 'Quản lý tài khoản' },
      { to: '/admin/maintenance', icon: 'wrench', title: 'Bảo trì', description: 'Phiếu yêu cầu sửa chữa' },
    ];
  }
  return [
    { to: '/home', icon: 'home', title: 'Ngôi nhà', description: 'Thiết bị và phòng của bạn' },
    { to: '/contracts', icon: 'briefcase', title: 'Hợp đồng', description: 'Lắp đặt và khảo sát' },
    { to: '/profile', icon: 'settings', title: 'Tài khoản', description: 'Hồ sơ và thông báo' },
  ];
}

export function NotFoundPage({ homePath, user }: { homePath: string; user: UserResponse | null }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <main className="app-shell relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-app px-4 py-12">
      <div aria-hidden={true} className="soft-grid pointer-events-none absolute inset-0" />
      <div aria-hidden={true} className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
      <div aria-hidden={true} className="pointer-events-none absolute -bottom-28 -right-20 h-96 w-96 rounded-full bg-mint/25 blur-3xl" />

      <section aria-labelledby="not-found-title" className="gentle-rise relative w-full max-w-2xl text-center">
        <Link to={homePath} className="inline-block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <img src={hestaLogo} alt="HESTA – về trang chủ" className="mx-auto h-10 w-auto" />
        </Link>

        <div aria-hidden={true} className="mt-10 flex items-center justify-center gap-3 sm:gap-5">
          <span className="text-8xl font-extrabold leading-none tracking-tight text-primary sm:text-9xl">4</span>
          <span className="not-found-float relative grid h-24 w-24 place-items-center rounded-[1.75rem] border border-line bg-surface shadow-[var(--shadow-float)] sm:h-28 sm:w-28">
            <Icon name="home" size={48} className="text-primary" />
            <span className="absolute -right-2 -top-2 grid h-9 w-9 place-items-center rounded-full border-4 border-app bg-warning-soft">
              <Icon name="search" size={16} className="text-text" />
            </span>
          </span>
          <span className="text-8xl font-extrabold leading-none tracking-tight text-mint sm:text-9xl">4</span>
        </div>
        <div aria-hidden={true} className="mx-auto mt-3 h-2 w-24 rounded-full bg-primary/15 blur-sm" />

        <h1 id="not-found-title" className="mt-8 text-2xl font-bold text-text sm:text-3xl">Ối, căn phòng này không tồn tại</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
          Có vẻ bạn đã đi lạc trong ngôi nhà HESTA. Đường dẫn có thể đã bị đổi tên, bị xóa hoặc gõ nhầm.
        </p>
        <p className="mx-auto mt-4 inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 font-mono text-xs text-muted">
          <Icon name="alert" size={14} className="shrink-0 text-icon" />
          <span className="truncate">{pathname}</span>
        </p>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-5 text-sm font-semibold text-text transition-colors hover:bg-sidebar focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
          >
            <Icon name="chevron" size={16} className="rotate-180 text-icon" />
            Quay lại
          </button>
          <Link
            to={homePath}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Icon name="home" size={16} className="text-white" />
            Về trang chủ
          </Link>
        </div>

        <nav aria-label="Lối tắt" className="mt-12">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Hoặc đi tới</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {shortcutsFor(user).map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="surface-card group flex h-full items-center gap-3 px-4 py-3.5 text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-info-soft">
                    <Icon name={item.icon} size={20} className="text-icon transition-colors group-hover:text-primary" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-text">{item.title}</span>
                    <span className="block truncate text-xs text-muted">{item.description}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <p className="mt-10 text-xs text-muted">Mã lỗi 404 · Không tìm thấy trang</p>
      </section>
    </main>
  );
}
