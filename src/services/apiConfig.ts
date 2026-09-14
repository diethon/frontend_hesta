const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const API_BASE_URL = (configuredApiBaseUrl || '/api/v1').replace(/\/+$/, '');

export function getRealtimeWebSocketUrl() {
  const apiUrl = new URL(API_BASE_URL, window.location.origin);
  const protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${apiUrl.host}/ws`;
}
