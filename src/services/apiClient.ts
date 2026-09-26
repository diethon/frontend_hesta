import axios from 'axios';
import { notifySessionExpired } from './session';

export class ApiError extends Error {
  readonly status?: number;
  readonly code?: number;
  constructor(message: string, status?: number, code?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const API_BASE_URL = (configuredApiBaseUrl || '/api/v1').replace(/\/+$/, '');

export function getRealtimeWebSocketUrl() {
  const apiUrl = new URL(API_BASE_URL, window.location.origin);
  const protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${apiUrl.host}/ws`;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      notifySessionExpired();
      throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
    }
    const errorMessage = error.response?.data?.message || error.message || 'Có lỗi xảy ra';
    throw new ApiError(errorMessage, error.response?.status, error.response?.data?.code);
  }
);
