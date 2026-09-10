import { Navigate, Outlet, useLocation } from 'react-router';
import type { UserResponse } from '../types/auth';
import { readNavigationState } from './navigation';

interface GuardProps {
  user: UserResponse | null;
}

// The caller restores the synchronous localStorage session before rendering guards.
// These checks protect navigation only; the backend remains authoritative.
export function RequireAuth({ user }: GuardProps) {
  const location = useLocation();
  if (!user) {
    return <Navigate to={{ pathname: '/login', search: location.search, hash: location.hash }} replace
      state={{ ...readNavigationState(location.state), returnTo: location.pathname }} />;
  }
  return <Outlet />;
}

export function RequireAdmin({ user }: GuardProps) {
  const location = useLocation();
  if (user?.platformRole !== 'ADMIN') {
    return <Navigate to={{ pathname: '/home', search: location.search, hash: location.hash }} replace
      state={location.state} />;
  }
  return <Outlet />;
}
