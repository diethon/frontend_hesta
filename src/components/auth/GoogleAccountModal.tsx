import React, { useState } from 'react';

interface GoogleAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAccount: (email: string, fullName: string) => void;
}

export const GoogleAccountModal: React.FC<GoogleAccountModalProps> = ({
  isOpen,
  onClose,
  onSelectAccount,
}) => {
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);

  if (!isOpen) return null;

  const presetAccounts = [
    {
      email: 'hoangtongvietduc@gmail.com',
      fullName: 'Hoàng Tùng Việt Đức',
      avatar: 'https://lh3.googleusercontent.com/a/default-user=s96-c',
    },
    {
      email: 'duc.hoang@student.hesta.edu.vn',
      fullName: 'Đức Hoàng (Student)',
      avatar: 'https://lh3.googleusercontent.com/a/default-user2=s96-c',
    },
  ];

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim()) return;
    const name = customName.trim() || customEmail.split('@')[0];
    onSelectAccount(customEmail.trim(), name);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in font-sans">
      <div className="w-full max-w-sm bg-white text-slate-800 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-scale-up">
        {/* Google Header */}
        <div className="p-6 text-center border-b border-slate-100 bg-slate-50/50">
          <div className="inline-flex items-center justify-center mb-3">
            <svg className="w-8 h-8" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Chọn tài khoản Google</h2>
          <p className="text-xs text-slate-500 mt-1">để tiếp tục tới <span className="font-medium text-slate-700">HESTA Smart Home</span></p>
        </div>

        {/* Account List */}
        {!showCustomForm ? (
          <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
            {presetAccounts.map((account) => (
              <button
                key={account.email}
                onClick={() => onSelectAccount(account.email, account.fullName)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 transition-all text-left group border border-transparent hover:border-slate-200"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-sm group-hover:scale-105 transition-transform">
                  {account.fullName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{account.fullName}</p>
                  <p className="text-xs text-slate-500 truncate">{account.email}</p>
                </div>
                <svg className="w-4 h-4 text-slate-400 group-hover:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}

            <button
              onClick={() => setShowCustomForm(true)}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 transition-all text-left text-blue-600 font-medium text-xs mt-2 border border-dashed border-slate-300"
            >
              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span>Sử dụng một tài khoản Google khác...</span>
            </button>
          </div>
        ) : (
          /* Custom Account Form */
          <form onSubmit={handleCustomSubmit} className="p-5 space-y-3">
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Nhập Email Google của bạn</h3>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email Google <span className="text-red-500">*</span></label>
              <input
                type="email"
                placeholder="your.email@gmail.com"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-300 focus:border-blue-500 focus:bg-white rounded-xl px-3.5 py-2 text-sm text-slate-900 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tên hiển thị</label>
              <input
                type="text"
                placeholder="Nguyễn Văn A"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 focus:border-blue-500 focus:bg-white rounded-xl px-3.5 py-2 text-sm text-slate-900 outline-none transition-all"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCustomForm(false)}
                className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl transition-all"
              >
                Quay lại
              </button>
              <button
                type="submit"
                className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-xl transition-all shadow-md shadow-blue-500/20"
              >
                Xác nhận
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
          <button
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-800 font-medium"
          >
            Hủy bỏ
          </button>
        </div>
      </div>
    </div>
  );
};
