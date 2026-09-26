import React, { useState } from 'react';
import { useLocation } from 'react-router';
import { registerUser } from '../../services/authApi';
import type { RegisterRequest, UserResponse } from '../../types/auth';
import { getErrorMessage } from '../../utils/errors';
import { AuthShell } from '../ui/AuthShell';
import { notify } from '../ui/notify';

interface RegisterFormProps {
  onSwitchToLogin?: (handledInviteToken?: string) => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin }) => {
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  const initialInviteToken = urlParams.get('inviteToken') || urlParams.get('token') || '';

  const [formData, setFormData] = useState<RegisterRequest & { confirmPassword: string }>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phoneNumber: '',
    inviteCode: initialInviteToken,
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredUser, setRegisteredUser] = useState<UserResponse | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validations
    if (!formData.fullName.trim()) {
      setError('Vui lòng nhập họ và tên.');
      return;
    }

    if (!formData.email.trim()) {
      setError('Vui lòng nhập email.');
      return;
    }

    if (formData.password.length < 8) {
      setError('Mật khẩu phải chứa ít nhất 8 ký tự.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu nhập lại không trùng khớp.');
      return;
    }

    setLoading(true);

    try {
      const response = await registerUser({
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        password: formData.password,
        phoneNumber: formData.phoneNumber?.trim() || undefined,
        inviteCode: formData.inviteCode?.trim() || undefined,
      });

      if (response.result) {
        setRegisteredUser(response.result);
        notify.success('Đăng ký tài khoản thành công');
      }
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Đã có lỗi xảy ra trong quá trình đăng ký.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="auth-surface gentle-rise relative z-10 mt-20 w-full max-w-lg p-6 sm:mt-0 sm:p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/30 mb-3">
            <svg aria-hidden={true} className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Tạo tài khoản HESTA</h1>
          <p className="mt-1 text-sm text-muted">Đăng ký tài khoản hệ thống local-first</p>
          {initialInviteToken && (
            <div className="mt-4 inline-block bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-medium">
              Bạn đang đăng ký từ một lời mời gia đình
            </div>
          )}
        </div>

        {/* Success Alert */}
        {registeredUser ? (
          <div role="status" aria-live="polite" className="relative z-10 rounded-2xl border border-success bg-success-soft p-8 text-center">
          <div className="w-16 h-16 bg-gradient-to-tr from-emerald-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/20">
            <svg aria-hidden={true} className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Đăng ký thành công!</h2>
          <p className="text-slate-400 mb-6">
            Chào mừng <span className="text-white font-medium">{registeredUser.fullName}</span> đã đến với HESTA.
          </p>
          <button
            onClick={() => {
              onSwitchToLogin?.(initialInviteToken);
            }}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-bold transition shadow-lg shadow-emerald-500/25 active:scale-[0.98]"
          >
            Chuyển sang Đăng nhập
          </button>
        </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div role="alert" aria-live="polite" className="bg-rose-950/60 border border-rose-500/30 text-rose-300 px-4 py-3 rounded-xl text-xs flex items-center gap-2 animate-shake">
                <svg aria-hidden={true} className="w-4 h-4 shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="register-name" className="block text-xs font-medium text-slate-300 mb-1">Họ và tên <span className="text-rose-400">*</span></label>
              <input
                id="register-name"
                type="text"
                name="fullName"
                placeholder="Nguyễn Văn A"
                value={formData.fullName}
                onChange={handleChange}
                required
                autoComplete="name"
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition"
              />
            </div>

            <div>
              <label htmlFor="register-email" className="block text-xs font-medium text-slate-300 mb-1">Địa chỉ Email <span className="text-rose-400">*</span></label>
              <input
                id="register-email"
                type="email"
                name="email"
                placeholder="name@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
                spellCheck={false}
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label htmlFor="register-password" className="block text-xs font-medium text-slate-300 mb-1">Mật khẩu <span className="text-rose-400">*</span></label>
                <input
                  id="register-password"
                  type="password"
                  name="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition"
                />
              </div>

              <div>
                <label htmlFor="register-confirm-password" className="block text-xs font-medium text-slate-300 mb-1">Xác nhận mật khẩu <span className="text-rose-400">*</span></label>
                <input
                  id="register-confirm-password"
                  type="password"
                  name="confirmPassword"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label htmlFor="register-phone" className="block text-xs font-medium text-slate-300 mb-1">Số điện thoại (tùy chọn)</label>
              <input
                id="register-phone"
                type="tel"
                name="phoneNumber"
                placeholder="0912 345 678"
                value={formData.phoneNumber}
                onChange={handleChange}
                autoComplete="tel"
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition"
              />
            </div>



            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition shadow-lg shadow-cyan-500/25 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg aria-hidden={true} className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Đang khởi tạo tài khoản…</span>
                </>
              ) : (
                <span>Đăng ký tài khoản [FE-01.1]</span>
              )}
            </button>

            <div className="text-center pt-2">
              <p className="text-xs text-slate-400">
                Đã có tài khoản?{' '}
                <button
                  type="button"
                  onClick={() => onSwitchToLogin?.()}
                  className="text-cyan-400 hover:text-cyan-300 font-medium underline underline-offset-4"
                >
                  Đăng nhập ngay
                </button>
              </p>
            </div>
          </form>
        )}
      </div>
    </AuthShell>
  );
};
