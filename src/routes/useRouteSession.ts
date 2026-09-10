import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { clearSession, readStoredUser, subscribeSessionExpired } from '../services/session';
import { invitationSearch, readNavigationState } from './navigation';

export function useRouteSession() {
  // localStorage is synchronous: restoration finishes before any guard renders.
  // A null user therefore means signed out, never "still initializing".
  const [user, setUser] = useState(readStoredUser);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => subscribeSessionExpired(() => {
    clearSession();
    setUser(null);
    const returnTo = location.pathname === '/home' || location.pathname === '/admin' || location.pathname === '/join'
      ? location.pathname : readNavigationState(location.state).returnTo;
    navigate({
      pathname: '/login',
      search: location.pathname === '/join'
        ? invitationSearch(location.search, 'inviteToken') : location.search,
      hash: location.hash,
    }, {
      replace: true,
      state: { ...readNavigationState(location.state), returnTo },
    });
  }), [location, navigate]);

  const logout = () => {
    clearSession();
    setUser(null);
    navigate({ pathname: '/login', search: location.search, hash: location.hash }, {
      replace: true,
      state: { ...readNavigationState(location.state), returnTo: undefined },
    });
  };

  return { user, setUser, logout };
}
