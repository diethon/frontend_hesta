import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import type { UserResponse } from '../../types/auth';
import { ProfileModal } from '../profile/ProfileModal';
import { MemberManagement } from './MemberManagement';
import { SceneManagement } from './SceneManagement';
import { getMyHomes, createHome } from '../../services/homeApi';
import { getMyHomes, createHome, type HomeSummary } from '../../services/homeApi';
import { currentHomeChanged, currentHomeCleared } from '../../store/homeSlice';
import { useAppDispatch } from '../../store/hooks';
import { getErrorMessage } from '../../utils/errors';

interface HomePageProps {
  user: UserResponse;
  onLogout: () => void;
  onProfileUpdate: (user: UserResponse) => void;
}

function retainSelectedHome(homes: HomeSummary[], selectedHome: HomeSummary | null) {
  if (homes.length === 0) return null;
  if (!selectedHome) return homes[0];
  return homes.find((home) => home.homeId === selectedHome.homeId) ?? homes[0];
}

export const HomePage: React.FC<HomePageProps> = ({ user, onLogout, onProfileUpdate }) => {
  const dispatch = useAppDispatch();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [userHome, setUserHome] = useState<HomeSummary | null>(null);
  const [newHomeName, setNewHomeName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [homesList, setHomesList] = useState<HomeSummary[]>([]);
  const navigate = useNavigate();
  const fetchHomes = async () => {
    try {
      const homes = await getMyHomes();
      setHomesList(homes || []);
      setUserHome((selectedHome) => retainSelectedHome(homes || [], selectedHome));
    } catch (err) {
      console.error('Failed to fetch homes', err);
    }
  };

  useEffect(() => {
    let active = true;
    getMyHomes().then((homes) => {
      if (!active) return;
      setHomesList(homes || []);
      setUserHome((selectedHome) => retainSelectedHome(homes || [], selectedHome));
    }).catch((error: unknown) => {
      if (active) console.error('Failed to fetch homes', error);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    dispatch(currentHomeChanged(userHome?.homeId ?? null));
  }, [dispatch, userHome?.homeId]);

  useEffect(() => () => {
    dispatch(currentHomeCleared());
  }, [dispatch]);

  const handleCreateHome = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      await createHome(newHomeName.trim());
      alert('Tạo nhà thành công!');
      setIsCreateModalOpen(false);
      setNewHomeName('');
      fetchHomes();
    } catch (error: unknown) {
      alert(getErrorMessage(error, 'Lỗi khi tạo nhà'));
    } finally {
      setCreateLoading(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
          <span className={`hidden sm:inline-block px-2.5 py-1 text-xs font-semibold rounded-full border ${
            user.platformRole === 'ADMIN'
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
          }`}>
            {user.platformRole}
          </span>
          
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 shadow-md hover:shadow-cyan-500/40 transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900 border-2 border-slate-800 overflow-hidden"
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold text-sm">
                  {user.fullName.charAt(0).toUpperCase()}
                </span>
              )}
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="px-4 py-2 border-b border-slate-800">
                  <p className="text-sm font-medium text-white truncate">{user.fullName}</p>
                  <p className="text-xs text-slate-400 truncate">{user.email}</p>
                </div>
                
                <div className="p-1">
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setIsProfileModalOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Hồ sơ & Bảo mật
                  </button>
                  
                  <button
                    className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Cài đặt
                  </button>
                </div>
                
                <div className="border-t border-slate-800 p-1">
                  <button
                    onClick={onLogout}
                    className="w-full text-left px-3 py-2 text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Đăng xuất
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content Dashboard */}
      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-indigo-950 border border-slate-800 rounded-3xl p-8 shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-cyan-500/5 blur-2xl pointer-events-none" />
          <div className="relative z-10">
            <h2 className="text-2xl font-bold text-white mb-2">Xin chào, {user.fullName}! 👋</h2>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Bạn đã đăng nhập thành công vào hệ thống HESTA Smart Home local-first. 
              Mã định danh duy nhất của bạn: <span className="font-mono text-cyan-400 text-xs">{user.id}</span>
            </p>
          </div>
          {homesList.length > 0 && (
            <div className="relative z-10 w-full md:w-auto">
              <label className="block text-xs font-medium text-slate-400 mb-1">Đang xem thông tin của nhà:</label>
              <select 
                value={userHome?.homeId || ''}
                onChange={(e) => {
                  const selected = homesList.find(h => h.homeId === e.target.value);
                  if (selected) setUserHome(selected);
                }}
                className="w-full md:w-64 bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all shadow-lg shadow-black/20"
              >
                {homesList.map(h => (
                  <option key={h.homeId} value={h.homeId}>{h.homeName} ({h.role === 'OWNER' ? 'Chủ nhà' : 'Thành viên'})</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div
            onClick={() => {
              if (userHome) {
                navigate(`/home/${userHome.homeId}/devices`);
              } else {
                alert('Vui lòng chọn hoặc tham gia một Ngôi nhà trước khi quản lý thiết bị.');
              }
            }}
            className="cursor-pointer bg-slate-900/80 border border-slate-800 rounded-2xl p-6 hover:border-cyan-500/40 transition-all shadow-lg group"
          >
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

        {userHome ? (
          <div className="mt-8 space-y-6">
            <SceneManagement key={userHome.homeId} homeId={userHome.homeId} currentUserRole={userHome.role} />
            <MemberManagement homeId={userHome.homeId} currentUserRole={userHome.role} />
          </div>
        ) : (
          <div className="mt-8 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 text-center shadow-lg">
            <div className="w-16 h-16 bg-slate-800 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Bạn chưa tham gia Ngôi nhà nào</h3>
            <p className="text-sm text-slate-400 mb-6">
              Bạn cần có một Ngôi nhà để quản lý thiết bị và thành viên. Bạn có thể tự tạo mới hoặc tham gia bằng mã mời.
            </p>
            <div className="flex items-center justify-center gap-4">
              <button 
                onClick={() => setIsCreateModalOpen(true)}
                className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-xl transition-all"
              >
                + Tạo nhà mới
              </button>
            </div>
          </div>
        )}
      </main>


      {/* Create Home Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Tạo Nhà Mới</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleCreateHome} className="p-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">Tên ngôi nhà của bạn</label>
              <input
                type="text"
                placeholder="VD: Nhà của tôi, Tổ ấm..."
                value={newHomeName}
                onChange={(e) => setNewHomeName(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none mb-6"
                maxLength={50}
              />
              <button
                type="submit"
                disabled={createLoading}
                className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-medium transition-colors"
              >
                {createLoading ? 'Đang khởi tạo...' : 'Xác nhận tạo mới'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {isProfileModalOpen ? (
        <ProfileModal
          isOpen
          onClose={() => setIsProfileModalOpen(false)}
          user={user}
          onProfileUpdate={onProfileUpdate}
        />
      ) : null}
    </div>
  );
};
