import React, { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { AlertCircle, ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { loginUser, loginWithGoogle } from '../../services/authApi';
import type { AuthResponse, LoginRequest } from '../../types/auth';
import { getErrorMessage } from '../../utils/errors';
import { GoogleSignInButton } from './GoogleAccountModal';
import { AuthShell } from '../ui/AuthShell';
import { notify } from '../ui/notify';

interface LoginFormProps {
  onLoginSuccess: (authData: AuthResponse) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  const initialEmail = urlParams.get('email') || '';
  const hasContractToken = Boolean(urlParams.get('contractToken'));
  const [formData, setFormData] = useState<LoginRequest>({
    email: initialEmail,
    password: '',
    deviceId: 'WEB_CLIENT',
    deviceType: 'BROWSER',
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
        notify.success('Đăng nhập thành công');
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
        notify.success('Đăng nhập bằng Google thành công');
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

  const inputClass = 'w-full rounded-xl border border-line bg-surface py-3 pl-11 pr-4 text-sm text-text outline-none transition-colors placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30';
  const spinner = (
    <svg aria-hidden={true} className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );

  return (
    <AuthShell>
      <div className="auth-surface gentle-rise relative z-10 min-w-0 w-full max-w-md p-6 sm:p-9">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-hover">Đăng nhập</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-text">Chào mừng trở lại</h1>
          <p className="mt-2 text-sm text-muted">
            {hasContractToken
              ? 'Đăng nhập để liên kết hồ sơ hợp đồng lắp đặt và theo dõi tiến độ.'
              : 'Đăng nhập để tiếp tục quản lý ngôi nhà của bạn.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div role="alert" aria-live="polite" className="flex items-start gap-2 rounded-xl border border-error bg-error-soft px-4 py-3 text-sm text-text animate-shake">
              <AlertCircle aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-error" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-text">Email</label>
            <div className="relative">
              <Mail aria-hidden="true" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-icon" />
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
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="login-password" className="block text-sm font-medium text-text">Mật khẩu</label>
              <Link
                to={{ pathname: '/forgot-password', search: location.search, hash: location.hash }}
                state={location.state}
                className="text-sm font-medium text-primary-hover hover:underline underline-offset-4"
              >
                Quên mật khẩu?
              </Link>
            </div>
            <div className="relative">
              <LockKeyhole aria-hidden="true" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-icon" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete="current-password"
                className={`${inputClass} pr-12`}
              />
              <button
                type="button"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                aria-pressed={showPassword}
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-icon transition-colors hover:text-primary-hover"
              >
                {showPassword ? <EyeOff aria-hidden="true" size={19} /> : <Eye aria-hidden="true" size={19} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-text shadow-soft transition hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <>{spinner}<span>Đang xác thực…</span></> : <><span>Đăng nhập</span><ArrowRight aria-hidden="true" size={17} /></>}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs font-medium text-muted">
          <span className="h-px flex-1 bg-line" />
          <span>Hoặc tiếp tục với</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        {googleLoading ? (
          <div role="status" className="flex items-center justify-center gap-2 py-3 text-sm text-muted">
            {spinner}
            <span>Đang xác thực với Google…</span>
          </div>
        ) : (
          <GoogleSignInButton
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            disabled={loading}
          />
        )}

        <p className="pt-6 text-center text-sm text-muted">
          Chưa có tài khoản?{' '}
          <Link
            to={{ pathname: '/register', search: location.search, hash: location.hash }}
            state={location.state}
            className="font-semibold text-primary-hover underline-offset-4 hover:underline"
          >
            Đăng ký ngay
          </Link>
        </p>
      </div>
    </AuthShell>
  );
};
