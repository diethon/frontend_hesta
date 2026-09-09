import type { ApiResponse, AuthResponse, GoogleLoginRequest, LoginRequest, RegisterRequest, UserResponse } from '../types/auth';

const API_BASE_URL = 'http://localhost:8080/api/v1';

export async function registerUser(data: RegisterRequest): Promise<ApiResponse<UserResponse>> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const resData: ApiResponse<UserResponse> = await response.json();
  if (!response.ok) {
    throw new Error(resData.message || 'Đăng ký không thành công');
  }

  return resData;
}

export async function loginUser(data: LoginRequest): Promise<ApiResponse<AuthResponse>> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const resData: ApiResponse<AuthResponse> = await response.json();
  if (!response.ok) {
    throw new Error(resData.message || 'Đăng nhập không thành công');
  }

  return resData;
}

export async function loginWithGoogle(data: GoogleLoginRequest): Promise<ApiResponse<AuthResponse>> {
  const response = await fetch(`${API_BASE_URL}/auth/google`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const resData: ApiResponse<AuthResponse> = await response.json();
  if (!response.ok) {
    throw new Error(resData.message || 'Đăng nhập bằng Google không thành công');
  }

  return resData;
}

export async function forgotPassword(data: import('../types/auth').ForgotPasswordRequest): Promise<ApiResponse<void>> {
  const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const resData: ApiResponse<void> = await response.json();
  if (!response.ok) {
    throw new Error(resData.message || 'Gửi yêu cầu không thành công');
  }

  return resData;
}

export async function verifyOtp(data: import('../types/auth').VerifyOtpRequest): Promise<ApiResponse<void>> {
  const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const resData: ApiResponse<void> = await response.json();
  if (!response.ok) {
    throw new Error(resData.message || 'Xác thực OTP không thành công');
  }

  return resData;
}

export async function resetPassword(data: import('../types/auth').ResetPasswordRequest): Promise<ApiResponse<void>> {
  const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const resData: ApiResponse<void> = await response.json();
  if (!response.ok) {
    throw new Error(resData.message || 'Khôi phục mật khẩu không thành công');
  }

  return resData;
}
