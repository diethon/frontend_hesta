import { notifySessionExpired } from './session';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

// Backend messages for these codes are English (and quoted verbatim in test docs), so translate by code here.
const VI_MESSAGES: Record<number, string> = {
  1105: 'Đã có kịch bản trùng tên trong nhà này. Hãy đặt tên khác.',
  1202: 'Đã có quy tắc tự động trùng tên. Hãy đặt tên khác.',
};

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
  if (!response.ok) throw new Error(VI_MESSAGES[payload.code] || payload.message || 'Yêu cầu không thành công');
  return payload.result;
}
