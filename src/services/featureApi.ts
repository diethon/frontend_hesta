import { notifySessionExpired } from './session';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

interface ApiEnvelope<T> {
  code: number;
  message?: string;
  result: T;
}

export async function featureRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
      ...init?.headers,
    },
  });
  if (response.status === 401) notifySessionExpired();
  const payload = await response.json() as ApiEnvelope<T>;
  if (!response.ok) throw new Error(payload.message || 'Yêu cầu không thành công');
  return payload.result;
}
