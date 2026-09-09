import React from 'react';

interface UnauthenticatedJoinProps {
  token: string;
  onSelectLogin: () => void;
  onSelectRegister: () => void;
}

export const UnauthenticatedJoin: React.FC<UnauthenticatedJoinProps> = ({ token, onSelectLogin, onSelectRegister }) => {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-cyan-500/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <div className="w-16 h-16 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20 mx-auto mb-6">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-center text-white mb-2">
            Lời mời tham gia nhà
          </h2>
          
          <div className="text-center mb-8">
            <p className="text-slate-300">
              Bạn vừa nhận được lời mời tham gia vào một ngôi nhà thông minh.
            </p>
            <p className="text-sm text-slate-500 mt-2">
              Bạn đã có tài khoản trên HESTA chưa?
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => {
                window.history.pushState({}, '', `/register?inviteToken=${token}`);
                onSelectRegister();
              }}
              className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl font-bold shadow-lg shadow-cyan-500/25 transition-all active:scale-[0.98] flex items-center justify-center"
            >
              Chưa, Đăng ký tài khoản mới
            </button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-900 px-3 text-slate-400 font-medium">Hoặc</span>
              </div>
            </div>

            <button
              onClick={() => {
                window.history.pushState({}, '', `/login?inviteToken=${token}`);
                onSelectLogin();
              }}
              className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all border border-slate-700"
            >
              Đã có, Đăng nhập ngay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
