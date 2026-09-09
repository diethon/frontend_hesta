import React from 'react';
import type { UserResponse } from '../../types/auth';

interface HomePageProps {
  user: UserResponse;
  onLogout: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({ user, onLogout }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans relative overflow-x-hidden">
      {/* Top Navbar */}
      <nav className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">HESTA Smart Home</h1>
            <p className="text-xs text-slate-400">Trang chủ hệ thống [/home]</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-200">{user.fullName}</p>
            <p className="text-xs text-slate-400">{user.email}</p>
          </div>
          <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
            user.platformRole === 'ADMIN'
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
          }`}>
            {user.platformRole}
          </span>
          <button
            onClick={onLogout}
            className="py-2 px-3.5 bg-slate-800 hover:bg-rose-950/80 hover:text-rose-300 hover:border-rose-500/40 border border-slate-700 text-xs font-medium rounded-xl transition-all flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Đăng xuất</span>
          </button>
        </div>
      </nav>

      {/* Main Content Dashboard */}
      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-indigo-950 border border-slate-800 rounded-3xl p-8 shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-cyan-500/5 blur-2xl pointer-events-none" />
          <h2 className="text-2xl font-bold text-white mb-2">Xin chào, {user.fullName}! 👋</h2>
          <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
            Bạn đã đăng nhập thành công vào hệ thống HESTA Smart Home local-first. 
            Mã định danh duy nhất của bạn: <span className="font-mono text-cyan-400 text-xs">{user.id}</span>
          </p>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 hover:border-cyan-500/40 transition-all shadow-lg group">
            <div className="w-12 h-12 bg-cyan-500/10 text-cyan-400 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Quản lý Thiết bị</h3>
            <p className="text-xs text-slate-400 leading-relaxed">Theo dõi và điều khiển các thiết bị thông minh (Đèn, Quạt, Cảm biến) trong nhà.</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 hover:border-blue-500/40 transition-all shadow-lg group">
            <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Kịch bản & Tự động hóa</h3>
            <p className="text-xs text-slate-400 leading-relaxed">Kích hoạt các ngữ cảnh thông minh (Về nhà, Đi ngủ, Cảnh báo an ninh).</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 hover:border-purple-500/40 transition-all shadow-lg group">
            <div className="w-12 h-12 bg-purple-500/10 text-purple-400 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Hồ sơ & Phân quyền</h3>
            <p className="text-xs text-slate-400 leading-relaxed">Thông tin cá nhân, cài đặt nhiệt độ/độ sáng ưu tiên và phân quyền gia đình.</p>
          </div>
        </div>
      </main>
    </div>
  );
};
