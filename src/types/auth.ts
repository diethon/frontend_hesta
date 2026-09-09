export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
  phoneNumber?: string;
}

export interface UserResponse {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  avatarUrl?: string;
  provider: 'LOCAL' | 'GOOGLE';
  platformRole: 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'LOCKED' | 'DISABLED';
  createdAt: string;
  lastActiveAt?: string;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  result?: T;
}
