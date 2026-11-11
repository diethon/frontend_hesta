export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  avatarUrl: string | null;
  provider: 'LOCAL' | 'GOOGLE';
  platformRole: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'LOCKED' | 'DISABLED';
  failedLoginAttempts: number;
  lockedUntil: string | null;
  lastActiveAt: string | null;
  createdAt: string;
  updatedAt: string;
  homeCount: number;
}

export interface RegistrationTrendPoint {
  label: string;
  count: number;
}

export interface AdminUserStats {
  totalUsers: number;
  activeUsers: number;
  lockedUsers: number;
  disabledUsers: number;
  adminUsers: number;
  standardUsers: number;
  localUsers: number;
  googleUsers: number;
  registrationTrend: RegistrationTrendPoint[];
}

export interface AdminUserFilters {
  search?: string;
  role?: string;
  status?: string;
  provider?: string;
  page: number;
  size: number;
  sortBy?: string;
  direction?: 'asc' | 'desc';
}

export interface AdminCreateUserPayload {
  fullName: string;
  email: string;
  phoneNumber?: string;
  password: string;
  platformRole?: 'USER' | 'ADMIN';
}

export interface AdminUpdateUserPayload {
  fullName: string;
  phoneNumber?: string;
  platformRole: 'USER' | 'ADMIN';
}

export interface AdminPageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}
