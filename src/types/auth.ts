export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
  phoneNumber?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  deviceId?: string;
  deviceType?: string;
}

export interface GoogleLoginRequest {
  idToken: string;
  deviceId?: string;
  deviceType?: string;
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

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserResponse;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  result?: T;
}
