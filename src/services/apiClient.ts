import { notifySessionExpired } from './session';

export const API_BASE_URL = 'http://localhost:8080/api/v1';

interface ApiEnvelope<T> {
  code: number;
  message?: string;
  result: T;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('accessToken');
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });

  if (response.status === 401) {
    notifySessionExpired();
  }

  const payload = (await response.json().catch(() => ({}))) as Partial<ApiEnvelope<T>>;
  if (!response.ok) {
    throw new Error(payload.message || 'Không thể xử lý yêu cầu.');
  }
  return payload.result as T;
}
