import type { AuthResponse, UserResponse } from '../types/auth';

const sessionEvents = new EventTarget();
const SESSION_EXPIRED = 'session-expired';

export interface StoredSession {
  accessToken: string;
  refreshToken: string | null;
  user: UserResponse;
}

function isStoredUser(value: unknown): value is UserResponse {
  if (!value || typeof value !== 'object') return false;
  const user = value as Record<string, unknown>;
  return typeof user.id === 'string' && typeof user.fullName === 'string' &&
    typeof user.email === 'string' &&
    (user.platformRole === 'ADMIN' || user.platformRole === 'USER');
}

export function readStoredSession(): StoredSession | null {
  const accessToken = localStorage.getItem('accessToken');
  const storedUser = localStorage.getItem('userInfo');
  if (!storedUser || !accessToken) return null;

  try {
    const user: unknown = JSON.parse(storedUser);
    if (isStoredUser(user)) {
      return {
        accessToken,
        refreshToken: localStorage.getItem('refreshToken'),
        user,
      };
    }
  } catch {
    // Invalid stored data is treated as signed out; unrelated storage is untouched.
  }
  return null;
}

export function readStoredUser(): UserResponse | null {
  return readStoredSession()?.user ?? null;
}

export function persistSession(session: AuthResponse) {
  localStorage.setItem('accessToken', session.accessToken);
  localStorage.setItem('refreshToken', session.refreshToken);
  localStorage.setItem('userInfo', JSON.stringify(session.user));
}

export function persistCurrentUser(user: UserResponse) {
  localStorage.setItem('userInfo', JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('userInfo');
}

// Services report expiry; the mounted router owns cleanup and navigation.
export function notifySessionExpired() {
  sessionEvents.dispatchEvent(new Event(SESSION_EXPIRED));
}

export function subscribeSessionExpired(listener: () => void) {
  sessionEvents.addEventListener(SESSION_EXPIRED, listener);
  return () => sessionEvents.removeEventListener(SESSION_EXPIRED, listener);
}
