import React from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { UserResponse } from '../../types/auth';
import { useAppSelector } from '../../store/hooks';
import { selectCurrentHomeId } from '../../store/selectors';
import { DashboardNavRail } from '../home/DashboardNavRail';
import { DashboardBottomNav } from '../home/DashboardBottomNav';
import { PageHero } from '../ui/PageHero';
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
  const userInitial = user.fullName?.trim()
    ? user.fullName.trim().split(' ').slice(-1)[0]?.charAt(0).toUpperCase() || 'M'
    : 'M';

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

        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] items-start">
          <aside className="rounded-3xl border border-[#cbd5e1] bg-white/95 p-6 shadow-sm flex flex-col gap-6">
            <div className="flex flex-col items-center text-center">
              <AvatarUploader user={user} onProfileUpdate={onProfileUpdate} size={112} />
              <p className="mt-2.5 text-xs font-medium text-[#64748b]">Nhấn vào ảnh để thay đổi</p>
              <h2 className="mt-3 text-xl font-extrabold text-[#0f172a] tracking-tight">{user.fullName}</h2>
              <p className="text-sm text-[#475569] break-all">{user.email}</p>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                <span className="rounded-full bg-[#eff6ff] border border-[#3b82f6]/40 px-2.5 py-0.5 text-[11px] font-bold text-[#1d4ed8]">
                  {user.platformRole === 'ADMIN' ? 'Quản trị viên' : 'Thành viên HESTA'}
                </span>
                {user.status === 'ACTIVE' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ecfdf5] border border-[#10b981]/40 px-2.5 py-0.5 text-[11px] font-bold text-[#047857]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                    Đang hoạt động
                  </span>
                ) : (
                  <span className="rounded-full bg-[#fff1f2] border border-[#f43f5e]/40 px-2.5 py-0.5 text-[11px] font-bold text-[#be123c]">
                    Tạm khóa
                  </span>
                )}
              </div>
            </div>

            <dl className="grid gap-3 border-t border-[#e2e8f0] pt-5 text-sm tabular-nums">
              {facts.map((fact) => (
                <div key={fact.label} className="flex justify-between gap-3">
                  <dt className="text-[#475569]">{fact.label}</dt>
                  <dd className="text-right font-semibold text-[#0f172a]">{fact.value}</dd>
                </div>
              ))}
            </dl>

            <nav aria-label="Mục hồ sơ" className="grid gap-1.5 border-t border-[#e2e8f0] pt-5">
              {SECTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-current={item.id === section ? 'page' : undefined}
                  onClick={() => setSearchParams(item.id === 'info' ? {} : { tab: item.id }, { replace: true })}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold border transition-colors cursor-pointer ${
                    item.id === section
                      ? 'bg-[#eff6ff] text-[#1d4ed8] border-[#3b82f6]/45 shadow-2xs'
                      : 'text-[#334155] border-transparent hover:bg-[#f8fafc] hover:border-[#cbd5e1] hover:text-[#0f172a]'
                  }`}
                >
                  <span className={item.id === section ? 'text-[#2563eb]' : 'text-[#64748b]'}>
                    <Icon name={item.icon} size={18} />
                  </span>
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={onLogout}
                className="mt-2 flex min-h-11 items-center gap-3 rounded-xl bg-[#fff1f2] border border-[#f43f5e]/40 px-3 text-left text-sm font-bold text-[#be123c] transition-colors hover:bg-[#ffe4e6] hover:border-[#f43f5e]/60 cursor-pointer"
              >
                <span className="text-[#e11d48]"><Icon name="power" size={18} /></span>
                Đăng xuất
              </button>
            </nav>
          </aside>

          <section className="rounded-3xl border border-[#cbd5e1] bg-white/95 p-6 sm:p-8 shadow-sm" aria-labelledby="profile-section-title">
            <div className="mb-6 pb-5 border-b border-[#e2e8f0] flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#eff6ff] text-[#1d4ed8] border border-[#3b82f6]/40">
                <Icon name={active.icon} size={22} />
              </span>
              <div>
                <h2 id="profile-section-title" className="border-l-4 border-[#2563eb] pl-3 text-xl font-bold text-[#0f172a] leading-tight">
                  {active.title}
                </h2>
                <p className="mt-1.5 text-sm text-[#475569]">{active.description}</p>
              </div>
            </div>

            <div className="w-full">
              {section === 'info' && <ProfileInfoForm key={user.id} user={user} onProfileUpdate={onProfileUpdate} />}
              {section === 'security' && (
                <div className="grid gap-6">
                  <ChangePasswordForm user={user} />
                  <div className="rounded-2xl border border-[#cbd5e1] bg-[#f8fafc] p-5">
                    <p className="flex items-center gap-2 text-sm font-bold text-[#0f172a]">
                      <span className="inline-flex items-center justify-center rounded-lg bg-[#ecfdf5] border border-[#10b981]/40 p-1 text-[#047857]">
                        <Icon name="shield" size={16} />
                      </span>
                      Mẹo giữ tài khoản an toàn
                    </p>
                    <ul className="mt-3 grid gap-2 text-sm text-[#334155]">
                      {SECURITY_TIPS.map((tip) => (
                        <li key={tip} className="flex items-start gap-2">
                          <span className="text-[#059669] mt-0.5 shrink-0"><Icon name="check" size={16} /></span>
                          <span>{tip}</span>
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
