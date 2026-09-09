import type { ApiResponse, RegisterRequest, UserResponse } from '../types/auth';

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
