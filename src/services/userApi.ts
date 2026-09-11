import type { ApiResponse, UserResponse } from '../types/auth';
import type { UpdateProfileRequest, ChangePasswordRequest } from '../types/user';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

const getAuthHeaders = () => {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

export async function updateProfile(data: UpdateProfileRequest): Promise<ApiResponse<UserResponse>> {
  const response = await fetch(`${API_BASE_URL}/users/me/profile`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  const resData: ApiResponse<UserResponse> = await response.json();
  if (!response.ok) {
    throw new Error(resData.message || 'Cập nhật thông tin không thành công');
  }

  return resData;
}

export async function changePassword(data: ChangePasswordRequest): Promise<ApiResponse<void>> {
  const response = await fetch(`${API_BASE_URL}/users/me/password`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  const resData: ApiResponse<void> = await response.json();
  if (!response.ok) {
    throw new Error(resData.message || 'Đổi mật khẩu không thành công');
  }

  return resData;
}

export async function uploadAvatar(file: File): Promise<ApiResponse<UserResponse>> {
  const formData = new FormData();
  formData.append('file', file);

  const token = localStorage.getItem('accessToken');
  const response = await fetch(`${API_BASE_URL}/users/me/avatar`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}` // Do not set Content-Type for FormData, browser will set it with boundary
    },
    body: formData,
  });

  const resData: ApiResponse<UserResponse> = await response.json();
  if (!response.ok) {
    throw new Error(resData.message || 'Tải lên ảnh đại diện không thành công');
  }

  return resData;
}
