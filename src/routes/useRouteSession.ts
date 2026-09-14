import { useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { realtimeClient } from '../realtime/realtimeClient';
import { clearSession, persistCurrentUser, persistSession, subscribeSessionExpired } from '../services/session';
import { currentUserUpdated, sessionAuthenticated, sessionEnded } from '../store/authSlice';
import { currentHomeCleared } from '../store/homeSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { realtimeReset } from '../store/realtimeSlice';
import { selectCurrentUser, selectSessionInitialized } from '../store/selectors';
import type { AuthResponse, UserResponse } from '../types/auth';
import { invitationSearch, readNavigationState } from './navigation';

export function useRouteSession() {
  const dispatch = useAppDispatch();
  const initialized = useAppSelector(selectSessionInitialized);
  const user = useAppSelector(selectCurrentUser);
  const location = useLocation();
  const navigate = useNavigate();

  const endSession = useCallback(() => {
    void realtimeClient.disconnect();
    clearSession();
    dispatch(sessionEnded());
    dispatch(currentHomeCleared());
    dispatch(realtimeReset());
  }, [dispatch]);

  useEffect(() => subscribeSessionExpired(() => {
    endSession();
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
  }), [endSession, location, navigate]);

  const login = useCallback((authData: AuthResponse) => {
    persistSession(authData);
    dispatch(sessionAuthenticated(authData));
  }, [dispatch]);

  const updateUser = useCallback((updatedUser: UserResponse) => {
    persistCurrentUser(updatedUser);
    dispatch(currentUserUpdated(updatedUser));
  }, [dispatch]);

  const logout = () => {
    endSession();
    navigate({ pathname: '/login', search: location.search, hash: location.hash }, {
      replace: true,
      state: { ...readNavigationState(location.state), returnTo: undefined },
    });
  };

  return { initialized, user, login, logout, updateUser };
}
