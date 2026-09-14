import React, { useState } from 'react';
import { useLocation } from 'react-router';
import { joinHome } from '../../services/homeApi';
import { getErrorMessage } from '../../utils/errors';

interface JoinHomeProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const JoinHome: React.FC<JoinHomeProps> = ({ onSuccess, onCancel }) => {
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
      alert('Gia nhập nhà thành công!');
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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-cyan-500/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <div className="w-16 h-16 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20 mx-auto mb-6">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-center text-white mb-2">
            Lời mời tham gia
          </h2>
          
          <div className="text-center mb-8">
            <p className="text-slate-300">
              Bạn nhận được lời mời tham gia vào một ngôi nhà thông minh trên HESTA.
            </p>
            <p className="text-sm text-slate-500 mt-2">
              Bấm Xác nhận để tiếp tục và bắt đầu quản lý các thiết bị.
            </p>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/50 text-rose-400 p-4 rounded-xl text-sm mb-6 text-center">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleJoin}
              disabled={loading || !token}
              className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl font-bold shadow-lg shadow-cyan-500/25 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                'Xác nhận tham gia'
              )}
            </button>

            <button
              onClick={handleCancel}
              className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all"
            >
              Từ chối & Quay lại
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
