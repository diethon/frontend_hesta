import type { UserResponse } from '../types/auth';

export interface NavigationState {
  returnTo?: string;
  resetEmail?: string;
  handledInviteToken?: string;
}

export function readNavigationState(value: unknown): NavigationState {
  if (!value || typeof value !== 'object') return {};
  const state = value as Record<string, unknown>;
  return {
    returnTo: isSafeReturnPath(state.returnTo) ? state.returnTo : undefined,
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

export function contractTokenParam(search: string) {
  const params = new URLSearchParams(search);
  return params.get('contractToken');
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
  if (user.platformRole === 'ADMIN') {
    if (state.returnTo?.startsWith('/admin')) return state.returnTo;
    return '/admin';
  }
  const token = invitationToken(search);
  if (token && state.handledInviteToken !== token) return '/join';
  const cToken = contractTokenParam(search);
  if (cToken) return '/contracts';
  if (state.returnTo === '/home' || state.returnTo === '/contracts') return state.returnTo;
  if (state.returnTo?.startsWith('/contracts/')) return state.returnTo;
  if (isTwinReturnPath(state.returnTo)) return state.returnTo;
  if (state.returnTo?.match(/^\/homes\/[0-9a-f-]+\/(scenes|automation-rules)$/i)) return state.returnTo;
  return defaultRoute(user);
}

function isSafeReturnPath(value: unknown): value is string {
  return typeof value === 'string' && (
    value === '/home' || value === '/contracts' || /^\/contracts\/[0-9a-f-]+$/i.test(value) ||
    value === '/admin' || value === '/admin/users' || value === '/admin/diagnostics' || value === '/admin/contracts' || value === '/admin/maintenance' || value === '/join' ||
    isTwinReturnPath(value) ||
    /^\/homes\/[0-9a-f-]+\/(scenes|automation-rules)$/i.test(value)
  );
}
