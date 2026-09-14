import React, { useState } from 'react';
import { verifyOtp, resetPassword } from '../../services/authApi';
import { getErrorMessage } from '../../utils/errors';

interface ResetPasswordFormProps {
  email: string;
  onBackToLogin: () => void;
  onSuccess: () => void;
}

export const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({ email, onBackToLogin, onSuccess }) => {
  const [step, setStep] = useState<1 | 2>(1); // 1: Verify OTP, 2: Reset Password
  const [formData, setFormData] = useState({
    otp: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // Format OTP to only allow numbers and max 6 chars
    if (name === 'otp') {
      const formattedValue = value.replace(/\D/g, '').slice(0, 6);
      setFormData((prev) => ({ ...prev, [name]: formattedValue }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    
    if (error) setError(null);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.otp.length !== 6) {
      setError('Mã OTP phải có đúng 6 chữ số.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await verifyOtp({ email, otp: formData.otp });
      // OTP hợp lệ, chuyển sang bước đặt mật khẩu mới
      setStep(2);
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Mã OTP không hợp lệ hoặc đã hết hạn.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await resetPassword({
        email,
        otp: formData.otp,
        newPassword: formData.newPassword,
      });
      onSuccess();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Khôi phục mật khẩu không thành công. Vui lòng thử lại.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-4 text-slate-100 relative overflow-hidden font-sans">
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-2xl border border-slate-800 rounded-3xl p-8 shadow-2xl shadow-cyan-950/30 relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30 mb-3">
            {step === 1 ? (
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {step === 1 ? 'Xác thực mã OTP' : 'Đặt mật khẩu mới'}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {step === 1 ? (
              <>Đã gửi mã xác nhận đến <span className="text-emerald-400 font-medium">{email}</span></>
            ) : (
              'Vui lòng nhập mật khẩu mới cho tài khoản của bạn'
            )}
          </p>
        </div>

        {error && (
          <div className="bg-rose-950/60 border border-rose-500/30 text-rose-300 px-4 py-3 rounded-xl text-xs flex items-center gap-2 animate-shake mb-4">
            <svg className="w-4 h-4 shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Mã xác thực OTP (6 số) <span className="text-rose-400">*</span></label>
              <input
                type="text"
                name="otp"
                placeholder="000000"
                value={formData.otp}
                onChange={handleChange}
                maxLength={6}
                required
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-2.5 text-center tracking-[0.5em] text-lg font-mono text-emerald-400 placeholder-slate-600 outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading || formData.otp.length !== 6}
              className="w-full mt-4 py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/25 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Đang xác thực...</span>
                </>
              ) : (
                <span>Tiếp tục</span>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Mật khẩu mới <span className="text-rose-400">*</span></label>
              <input
                type="password"
                name="newPassword"
                placeholder="••••••••"
                value={formData.newPassword}
                onChange={handleChange}
                required
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Xác nhận mật khẩu mới <span className="text-rose-400">*</span></label>
              <input
                type="password"
                name="confirmPassword"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !formData.newPassword || !formData.confirmPassword}
              className="w-full mt-4 py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/25 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <span>Cập nhật mật khẩu</span>
              )}
            </button>
          </form>
        )}

        <div className="text-center pt-6">
          <button
            type="button"
            onClick={step === 2 ? () => setStep(1) : onBackToLogin}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            {step === 2 ? 'Quay lại' : 'Hủy và quay lại Đăng nhập'}
          </button>
        </div>
      </div>
    </div>
  );
};
