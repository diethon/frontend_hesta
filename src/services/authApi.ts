import type { ApiResponse, AuthResponse, GoogleLoginRequest, LoginRequest, RegisterRequest, UserResponse } from '../types/auth';
import { apiClient } from './apiClient';

export async function registerUser(data: RegisterRequest): Promise<ApiResponse<UserResponse>> {
  const response = await apiClient.post('/auth/register', data);
  return response.data;
}

export async function loginUser(data: LoginRequest): Promise<ApiResponse<AuthResponse>> {
  const response = await apiClient.post('/auth/login', data);
  return response.data;
}

export async function loginWithGoogle(data: GoogleLoginRequest): Promise<ApiResponse<AuthResponse>> {
  const response = await apiClient.post('/auth/google', data);
  return response.data;
}

export async function forgotPassword(data: import('../types/auth').ForgotPasswordRequest): Promise<ApiResponse<void>> {
  const response = await apiClient.post('/auth/forgot-password', data);
  return response.data;
}

export async function verifyOtp(data: import('../types/auth').VerifyOtpRequest): Promise<ApiResponse<void>> {
  const response = await apiClient.post('/auth/verify-otp', data);
  return response.data;
}

export async function resetPassword(data: import('../types/auth').ResetPasswordRequest): Promise<ApiResponse<void>> {
  const response = await apiClient.post('/auth/reset-password', data);
  return response.data;
}
