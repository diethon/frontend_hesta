import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { LoginForm } from '../components/auth/LoginForm';
import { RegisterForm } from '../components/auth/RegisterForm';
import { ForgotPasswordForm } from '../components/auth/ForgotPasswordForm';
import { ResetPasswordForm } from '../components/auth/ResetPasswordForm';
import { HomePage } from '../components/home/HomePage';
import { AdminDashboard } from '../components/admin/AdminDashboard';
import { JoinHome } from '../components/home/JoinHome';
import { UnauthenticatedJoin } from '../components/home/UnauthenticatedJoin';
import { DevicePage } from '../components/device/DevicePage';
import { DigitalTwinPage } from '../components/twin/DigitalTwinPage';
import type { AuthResponse } from '../types/auth';
import { RequireAdmin, RequireAuth } from './RouteGuards';
import { defaultRoute, invitationSearch, invitationToken, loginDestination, readNavigationState } from './navigation';
import type { NavigationState } from './navigation';
import { useRouteSession } from './useRouteSession';

export function AppRoutes() {
  const { initialized, user, login, logout, updateUser } = useRouteSession();
  const location = useLocation();
  const navigate = useNavigate();
  const state = readNavigationState(location.state);

  const go = (pathname: string, nextState: NavigationState = state, replace = false, search = location.search) => {
    navigate({ pathname, search, hash: location.hash }, { state: nextState, replace });
  };

  const handleLoginSuccess = (authData: AuthResponse) => {
    login(authData);
    const destination = loginDestination(authData.user, location.search, state);
    go(destination, { ...state, returnTo: undefined }, true,
      destination === '/join' ? invitationSearch(location.search, 'token') : location.search);
  };

  const leaveInvitation = () => go('/home', {
    ...state,
    returnTo: undefined,
    handledInviteToken: invitationToken(location.search) || undefined,
  }, true);

  return (
    <Routes>
      <Route path="/login" element={
        <LoginForm
          onLoginSuccess={handleLoginSuccess}
        />
      } />
      <Route path="/register" element={
        <RegisterForm key={location.search} onSwitchToLogin={(handledInviteToken) => go('/login', {
          ...state,
          // Registration already sends inviteCode to the backend to join the home.
          handledInviteToken: handledInviteToken || state.handledInviteToken,
        })} />
      } />
      <Route path="/forgot-password" element={
        <ForgotPasswordForm onBackToLogin={() => go('/login')}
          onSuccess={(email) => go('/reset-password', { ...state, resetEmail: email })} />
      } />
      <Route path="/reset-password" element={state.resetEmail ? (
        <ResetPasswordForm key={state.resetEmail} email={state.resetEmail}
          onBackToLogin={() => go('/login')}
          onSuccess={() => go('/login', { ...state, resetEmail: undefined }, true)} />
      ) : (
        <Navigate to={{ pathname: '/forgot-password', search: location.search, hash: location.hash }}
          state={state} replace />
      )} />
      <Route path="/join" element={user ? (
        <JoinHome key={location.search} onSuccess={leaveInvitation} onCancel={leaveInvitation} />
      ) : invitationToken(location.search) ? (
        <UnauthenticatedJoin
          onSelectLogin={() => go('/login', state, false, invitationSearch(location.search, 'inviteToken'))}
          onSelectRegister={() => go('/register', state, false, invitationSearch(location.search, 'inviteToken'))}
        />
      ) : (
        <Navigate to={{ pathname: '/login', search: location.search, hash: location.hash }} state={state} replace />
      )} />
      <Route element={<RequireAuth initialized={initialized} user={user} />}>
        <Route path="/home" element={<HomePage user={user!} onLogout={logout} onProfileUpdate={updateUser} />} />
        <Route path="/home/:homeId/devices" element={<DevicePage />} />
        <Route path="/home/:homeId/digital-twin" element={<DigitalTwinPage />} />
        <Route element={<RequireAdmin initialized={initialized} user={user} />}>
          <Route path="/admin" element={<AdminDashboard user={user!} onLogout={logout} onProfileUpdate={updateUser} />} />
        </Route>
      </Route>
      <Route path="*" element={
        <Navigate to={{ pathname: defaultRoute(user), search: location.search, hash: location.hash }}
          state={state} replace />
      } />
    </Routes>
  );
}
