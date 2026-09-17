import type { UserResponse } from '../types/auth';

export interface NavigationState {
  returnTo?: '/home' | '/admin' | '/join' | `/home/${string}/digital-twin`;
  resetEmail?: string;
  handledInviteToken?: string;
}

export function readNavigationState(value: unknown): NavigationState {
  if (!value || typeof value !== 'object') return {};
  const state = value as Record<string, unknown>;
  return {
    returnTo: state.returnTo === '/home' || state.returnTo === '/admin' || state.returnTo === '/join' || isTwinReturnPath(state.returnTo)
      ? state.returnTo : undefined,
    resetEmail: typeof state.resetEmail === 'string' ? state.resetEmail : undefined,
    handledInviteToken: typeof state.handledInviteToken === 'string' ? state.handledInviteToken : undefined,
  };
}

function isTwinReturnPath(value: unknown): value is `/home/${string}/digital-twin` {
  return typeof value === 'string' && /^\/home\/[a-zA-Z0-9-]+\/digital-twin$/.test(value);
}

export function defaultRoute(user: UserResponse | null) {
  return user ? (user.platformRole === 'ADMIN' ? '/admin' : '/home') : '/login';
}

export function invitationToken(search: string) {
  const params = new URLSearchParams(search);
  return params.get('inviteToken') || params.get('token');
}

// Add the alias a flow needs without discarding any existing query parameters.
export function invitationSearch(search: string, key: 'token' | 'inviteToken') {
  const params = new URLSearchParams(search);
  const token = invitationToken(search);
  if (!token || params.has(key)) return search;
  params.set(key, token);
  return `?${params.toString()}`;
}

export function loginDestination(user: UserResponse, search: string, state: NavigationState) {
  const token = invitationToken(search);
  if (token && state.handledInviteToken !== token) return '/join';
  if (state.returnTo === '/home') return state.returnTo;
  if (isTwinReturnPath(state.returnTo)) return state.returnTo;
  if (state.returnTo === '/admin' && user.platformRole === 'ADMIN') return '/admin';
  return defaultRoute(user);
}
