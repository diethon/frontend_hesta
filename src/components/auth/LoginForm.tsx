import React, { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { loginUser, loginWithGoogle } from '../../services/authApi';
import type { AuthResponse, LoginRequest } from '../../types/auth';
import { getErrorMessage } from '../../utils/errors';
import { GoogleSignInButton } from './GoogleAccountModal';
import { AuthShell } from '../ui/AuthShell';

interface LoginFormProps {
  onLoginSuccess: (authData: AuthResponse) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const location = useLocation();
  const [formData, setFormData] = useState<LoginRequest>({
    email: '',
    password: '',
    deviceId: 'WEB_CLIENT',
    deviceType: 'BROWSER',
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.email.trim()) {
      setError('Vui lòng nhập địa chỉ email.');
      return;
    }

    if (!formData.password) {
      setError('Vui lòng nhập mật khẩu.');
      return;
    }

    setLoading(true);

    try {
      const response = await loginUser({
        email: formData.email.trim(),
        password: formData.password,
        deviceId: formData.deviceId,
        deviceType: formData.deviceType,
      });

      if (response.result) {
        onLoginSuccess(response.result);
      }
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Email hoặc mật khẩu không chính xác.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (idToken: string) => {
    setError(null);
    setGoogleLoading(true);

    try {
      const response = await loginWithGoogle({
        idToken,
        deviceId: formData.deviceId,
        deviceType: formData.deviceType,
      });

      if (response.result) {
        onLoginSuccess(response.result);
      }
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Xác thực tài khoản Google thất bại.'));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleError = (errorMsg: string) => {
    setError(errorMsg);
  };

  return (
    <AuthShell>
      <div className="auth-surface gentle-rise relative z-10 mt-20 min-w-0 w-full max-w-md p-6 sm:mt-0 sm:p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/30 mb-3">
            <svg aria-hidden={true} className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Chào mừng trở lại</h1>
          <p className="mt-1 text-sm text-muted">Đăng nhập để tiếp tục quản lý ngôi nhà của bạn</p>
        </div>

        {/* Form */}
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
            <label htmlFor="login-email" className="block text-xs font-medium text-slate-300 mb-1">Địa chỉ Email <span className="text-rose-400">*</span></label>
            <input
              id="login-email"
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

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="login-password" className="block text-xs font-medium text-slate-300">Mật khẩu <span className="text-rose-400">*</span></label>
              <Link
                to={{ pathname: '/forgot-password', search: location.search, hash: location.hash }}
                state={location.state}
                className="text-xs text-cyan-400 hover:text-cyan-300"
              >
                Quên mật khẩu?
              </Link>
            </div>
            <input
              id="login-password"
              type="password"
              name="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              required
              autoComplete="current-password"
              className="w-full bg-slate-950/60 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition shadow-lg shadow-cyan-500/25 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg aria-hidden={true} className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Đang xác thực…</span>
              </>
            ) : (
              <span>Đăng nhập Email/Mật khẩu</span>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-slate-900 px-3 text-slate-400 font-medium">Hoặc tiếp tục với</span>
          </div>
        </div>

        {/* Google Sign-In Button (SDK chính thức) */}
        {googleLoading ? (
          <div className="flex items-center justify-center gap-2 py-3">
            <svg aria-hidden={true} className="animate-spin w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm text-slate-300">Đang xác thực với Google…</span>
          </div>
        ) : (
          <GoogleSignInButton
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            disabled={loading}
          />
        )}

        <div className="text-center pt-4">
          <p className="text-xs text-slate-400">
            Chưa có tài khoản?{' '}
            <Link
              to={{ pathname: '/register', search: location.search, hash: location.hash }}
              state={location.state}
              className="text-cyan-400 hover:text-cyan-300 font-medium underline underline-offset-4"
            >
              Đăng ký ngay
            </Link>
          </p>
        </div>
      </div>
    </AuthShell>
  );
};
