import type { UserResponse } from '../types/auth';

const sessionEvents = new EventTarget();
const SESSION_EXPIRED = 'session-expired';

export function readStoredUser(): UserResponse | null {
  const storedUser = localStorage.getItem('userInfo');
  if (!storedUser || !localStorage.getItem('accessToken')) return null;

  try {
    const user = JSON.parse(storedUser);
    if (
      user && typeof user.id === 'string' && typeof user.fullName === 'string' &&
      typeof user.email === 'string' &&
      (user.platformRole === 'ADMIN' || user.platformRole === 'USER')
    ) {
      return user as UserResponse;
    }
  } catch {
    // Invalid stored data is treated as signed out; unrelated storage is untouched.
  }
  return null;
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
