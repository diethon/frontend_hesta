import { Navigate, Outlet, useLocation } from 'react-router';
import type { UserResponse } from '../types/auth';
import { readNavigationState } from './navigation';

interface GuardProps {
  initialized: boolean;
  user: UserResponse | null;
}

// The caller restores the synchronous localStorage session before rendering guards.
// These checks protect navigation only; the backend remains authoritative.
export function RequireAuth({ initialized, user }: GuardProps) {
  const location = useLocation();
  if (!initialized) return null;
  if (!user) {
    return <Navigate to={{ pathname: '/login', search: location.search, hash: location.hash }} replace
      state={{ ...readNavigationState(location.state), returnTo: location.pathname }} />;
  }
  return <Outlet />;
}

export function RequireAdmin({ initialized, user }: GuardProps) {
  const location = useLocation();
  if (!initialized) return null;
  if (user?.platformRole !== 'ADMIN') {
    return <Navigate to={{ pathname: '/home', search: location.search, hash: location.hash }} replace
      state={location.state} />;
  }
  return <Outlet />;
}
