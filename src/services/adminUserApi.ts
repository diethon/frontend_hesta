import { apiClient } from './apiClient';
import type {
  AdminUser,
  AdminUserStats,
  AdminUserFilters,
  AdminCreateUserPayload,
  AdminUpdateUserPayload,
  AdminPageResponse,
} from '../types/adminUser';

export interface AdminDashboardStats {
  totalUsers: number;
  activeDevices: number;
  totalNodes: number;
  systemAlerts: number;
  uptime: string;
}

export const getAdminDashboardStats = async (): Promise<AdminDashboardStats> => {
  const response = await apiClient.get('/admin/dashboard-stats');
  return response.data.result;
};

export const getAdminUsers = async (filters: AdminUserFilters): Promise<AdminPageResponse<AdminUser>> => {
  const params: Record<string, string | number> = {
    page: filters.page,
    size: filters.size,
  };
  if (filters.search) params.search = filters.search;
  if (filters.role && filters.role !== 'ALL') params.role = filters.role;
  if (filters.status && filters.status !== 'ALL') params.status = filters.status;
  if (filters.provider && filters.provider !== 'ALL') params.provider = filters.provider;
  if (filters.sortBy) params.sortBy = filters.sortBy;
  if (filters.direction) params.direction = filters.direction;

  const response = await apiClient.get('/admin/users', { params });
  return response.data.result;
};

export const getAdminUserStats = async (): Promise<AdminUserStats> => {
  const response = await apiClient.get('/admin/users/stats');
  return response.data.result;
};

export const getAdminUserById = async (id: string): Promise<AdminUser> => {
  const response = await apiClient.get(`/admin/users/${id}`);
  return response.data.result;
};

export const adminCreateUser = async (payload: AdminCreateUserPayload): Promise<AdminUser> => {
  const response = await apiClient.post('/admin/users', payload);
  return response.data.result;
};

export const adminUpdateUser = async (id: string, payload: AdminUpdateUserPayload): Promise<AdminUser> => {
  const response = await apiClient.put(`/admin/users/${id}`, payload);
  return response.data.result;
};

export const adminUpdateUserStatus = async (id: string, status: 'ACTIVE' | 'LOCKED' | 'DISABLED'): Promise<AdminUser> => {
  const response = await apiClient.patch(`/admin/users/${id}/status`, { status });
  return response.data.result;
};

export const adminUnlockUser = async (id: string): Promise<AdminUser> => {
  const response = await apiClient.post(`/admin/users/${id}/unlock`);
  return response.data.result;
};

export const adminResetPassword = async (id: string, newPassword: string): Promise<void> => {
  await apiClient.post(`/admin/users/${id}/reset-password`, { newPassword });
};
