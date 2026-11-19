import React, { useState } from 'react';
import { useLocation } from 'react-router';
import { joinHome } from '../../services/homeApi';
import { getErrorMessage } from '../../utils/errors';
import { AuthShell } from '../ui/AuthShell';
import { notify } from '../ui/notify';
import type { UserResponse } from '../../types/auth';

interface JoinHomeProps {
  user?: UserResponse | null;
  onSuccess: () => void;
  onCancel: () => void;
  onSwitchAccount?: () => void;
}

export const JoinHome: React.FC<JoinHomeProps> = ({ user, onSuccess, onCancel, onSwitchAccount }) => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const token = params.get('token') || params.get('inviteToken');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : 'Đường dẫn không hợp lệ hoặc đã thiếu mã token.');

  const handleJoin = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      await joinHome(token);
      notify.success('Gia nhập nhà thành công');
      onSuccess();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Lỗi khi gia nhập nhà. Mã mời có thể đã hết hạn hoặc không tồn tại.'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    onCancel();
  };

  return (
    <AuthShell>
      <div className="relative z-10 mt-20 w-full max-w-md sm:mt-0">
        <div className="auth-surface gentle-rise p-6 sm:p-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20 mx-auto mb-6">
            <svg aria-hidden={true} className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-center text-white mb-2">
            Lời mời tham gia
          </h2>
          
          <div className="text-center mb-6">
            <p className="text-slate-300">
              Bạn nhận được lời mời tham gia vào một ngôi nhà thông minh trên HESTA.
            </p>
            <p className="text-sm text-slate-500 mt-2">
              Bấm Xác nhận để tiếp tục và bắt đầu quản lý các thiết bị.
            </p>
          </div>

          {user && (
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 mb-6 flex items-center justify-between gap-3 text-left">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center shrink-0 border border-cyan-500/30">
                  {user.fullName ? user.fullName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-slate-400">Đang đăng nhập:</div>
                  <div className="text-sm font-semibold text-slate-200 truncate">{user.fullName || user.email}</div>
                  {user.fullName && <div className="text-xs text-slate-400 truncate">{user.email}</div>}
                </div>
              </div>
              {onSwitchAccount && (
                <button
                  type="button"
                  onClick={onSwitchAccount}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-medium shrink-0 hover:underline px-2 py-1"
                >
                  Đổi tài khoản
                </button>
              )}
            </div>
          )}

          {error && (
            <div role="alert" aria-live="polite" className="bg-rose-500/10 border border-rose-500/50 text-rose-400 p-4 rounded-xl text-sm mb-6 text-center space-y-2">
              <p>{error}</p>
              {error.includes('đã là thành viên') && onSwitchAccount && (
                <div className="pt-2 border-t border-rose-500/20 text-xs text-slate-300 space-y-2">
                  <p>
                    Tài khoản <strong>{user?.email}</strong> hiện tại đã là thành viên (chủ nhà) của ngôi nhà này.
                  </p>
                  <button
                    type="button"
                    onClick={onSwitchAccount}
                    className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-semibold transition"
                  >
                    Đăng xuất để đổi tài khoản
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleJoin}
              disabled={loading || !token}
              className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl font-bold shadow-lg shadow-cyan-500/25 transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                'Xác nhận tham gia'
              )}
            </button>

            <button
              onClick={handleCancel}
              className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition"
            >
              Từ chối & Quay lại
            </button>
          </div>
        </div>
      </div>
    </AuthShell>
  );
};
