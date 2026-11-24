import React from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { UserResponse } from '../../types/auth';
import { useAppSelector } from '../../store/hooks';
import { selectCurrentHomeId } from '../../store/selectors';
import { DashboardNavRail } from '../home/DashboardNavRail';
import { DashboardBottomNav } from '../home/DashboardBottomNav';
import { PageHero, SectionTitle } from '../ui/PageHero';
import { Icon, type IconName } from '../ui/LucideIcon';
import { AvatarUploader } from './AvatarUploader';
import { ProfileInfoForm } from './ProfileInfoForm';
import { ChangePasswordForm } from './ChangePasswordForm';
import { NotificationPreferencesTab } from './NotificationPreferencesTab';

type Section = 'info' | 'security' | 'notifications';

const SECTIONS: Array<{ id: Section; icon: IconName; label: string; title: string; description: string }> = [
  { id: 'info', icon: 'users', label: 'Thông tin cá nhân', title: 'Thông tin cá nhân', description: 'Tên và số điện thoại hiển thị với các thành viên trong nhà.' },
  { id: 'security', icon: 'lock', label: 'Bảo mật', title: 'Bảo mật & mật khẩu', description: 'Đổi mật khẩu định kỳ để giữ tài khoản an toàn.' },
  { id: 'notifications', icon: 'bell', label: 'Thông báo', title: 'Cài đặt thông báo', description: 'Chọn loại thông báo HESTA gửi cho bạn.' },
];

const SECURITY_TIPS = [
  'Dùng mật khẩu dài ít nhất 8 ký tự, có chữ hoa, số và ký hiệu.',
  'Không dùng lại mật khẩu của tài khoản khác.',
  'Đăng xuất trên thiết bị dùng chung sau khi sử dụng.',
];

const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

export const ProfilePage: React.FC<{
  user: UserResponse;
  onLogout: () => void;
  onProfileUpdate: (updatedUser: UserResponse) => void;
}> = ({ user, onLogout, onProfileUpdate }) => {
  const navigate = useNavigate();
  const homeId = useAppSelector(selectCurrentHomeId) ?? undefined;
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const section: Section = requested === 'security' || requested === 'notifications' ? requested : 'info';
  const active = SECTIONS.find((item) => item.id === section) ?? SECTIONS[0];
  const userInitial = user.fullName?.trim().charAt(0).toUpperCase() || 'U';

  const facts: Array<{ label: string; value: string }> = [
    { label: 'Số điện thoại', value: user.phoneNumber || 'Chưa cập nhật' },
    { label: 'Đăng nhập bằng', value: user.provider === 'GOOGLE' ? 'Google' : 'Email & mật khẩu' },
    { label: 'Tham gia từ', value: formatDate(user.createdAt) },
    { label: 'Hoạt động gần nhất', value: formatDate(user.lastActiveAt) },
  ];

  return (
    <div className="app-shell scenes-page studio st-theme st-pro">
      <DashboardNavRail homeId={homeId} activeItem="profile" user={user} onSelectOverview={() => navigate('/home')} />
      <main>
        <PageHero
          eyebrow="Tài khoản"
          title="Hồ sơ của bạn"
          subtitle="Quản lý thông tin cá nhân, bảo mật và cách HESTA thông báo cho bạn."
          userInitial={userInitial}
        />

        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="surface-card flex flex-col gap-6 p-6">
            <div className="flex flex-col items-center text-center">
              <AvatarUploader user={user} onProfileUpdate={onProfileUpdate} size={112} />
              <p className="mt-2 text-xs text-muted">Nhấn vào ảnh để thay đổi</p>
              <h2 className="mt-3 text-xl font-bold text-text">{user.fullName}</h2>
              <p className="text-sm text-muted break-all">{user.email}</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <span className="rounded-full bg-info-soft px-3 py-1 text-xs font-semibold text-primary-hover">
                  {user.platformRole === 'ADMIN' ? 'Quản trị viên' : 'Thành viên HESTA'}
                </span>
                <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-text">
                  {user.status === 'ACTIVE' ? 'Đang hoạt động' : 'Tạm khóa'}
                </span>
              </div>
            </div>

            <dl className="grid gap-3 border-t border-line pt-5 text-sm">
              {facts.map((fact) => (
                <div key={fact.label} className="flex justify-between gap-3">
                  <dt className="text-muted">{fact.label}</dt>
                  <dd className="text-right font-semibold text-text">{fact.value}</dd>
                </div>
              ))}
            </dl>

            <nav aria-label="Mục hồ sơ" className="grid gap-1 border-t border-line pt-5">
              {SECTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-current={item.id === section ? 'page' : undefined}
                  onClick={() => setSearchParams(item.id === 'info' ? {} : { tab: item.id }, { replace: true })}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition-colors ${
                    item.id === section ? 'bg-sidebar-active text-text' : 'text-muted hover:bg-sidebar-hover hover:text-text'
                  }`}
                >
                  <span className={item.id === section ? 'text-primary-hover' : 'text-icon'}><Icon name={item.icon} size={18} /></span>
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={onLogout}
                className="mt-2 flex min-h-11 items-center gap-3 rounded-xl bg-error-soft px-3 text-left text-sm font-semibold text-text transition-colors hover:bg-error/20"
              >
                <span className="text-error"><Icon name="power" size={18} /></span>
                Đăng xuất
              </button>
            </nav>
          </aside>

          <section className="surface-card p-6 sm:p-8" aria-labelledby="profile-section-title">
            <div className="mb-6 flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-info-soft text-primary-hover">
                <Icon name={active.icon} size={22} />
              </span>
              <div>
                <SectionTitle id="profile-section-title">{active.title}</SectionTitle>
                <p className="mt-1 text-sm text-muted">{active.description}</p>
              </div>
            </div>

            <div className="max-w-xl">
              {section === 'info' && <ProfileInfoForm key={user.id} user={user} onProfileUpdate={onProfileUpdate} />}
              {section === 'security' && (
                <div className="grid gap-6">
                  <ChangePasswordForm user={user} />
                  <div className="rounded-2xl border border-line bg-app p-5">
                    <p className="flex items-center gap-2 text-sm font-semibold text-text">
                      <span className="text-mint"><Icon name="shield" size={18} /></span>
                      Mẹo giữ tài khoản an toàn
                    </p>
                    <ul className="mt-3 grid gap-2 text-sm text-muted">
                      {SECURITY_TIPS.map((tip) => (
                        <li key={tip} className="flex gap-2">
                          <span className="text-mint"><Icon name="check" size={16} /></span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              {section === 'notifications' && <NotificationPreferencesTab />}
            </div>
          </section>
        </div>
      </main>
      <DashboardBottomNav activeItem="more" homeId={homeId} />
    </div>
  );
};
