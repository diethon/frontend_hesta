import { useEffect, useState } from 'react';
import { LoginForm } from './components/auth/LoginForm';
import { RegisterForm } from './components/auth/RegisterForm';
import { HomePage } from './components/home/HomePage';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { ForgotPasswordForm } from './components/auth/ForgotPasswordForm';
import { ResetPasswordForm } from './components/auth/ResetPasswordForm';
import { JoinHome } from './components/home/JoinHome';
import { UnauthenticatedJoin } from './components/home/UnauthenticatedJoin';
import type { AuthResponse, UserResponse } from './types/auth';

type Route = '/login' | '/register' | '/home' | '/admin' | '/forgot-password' | '/reset-password' | '/join';

function App() {
  const [currentRoute, setCurrentRoute] = useState<Route>('/login');
  const [currentUser, setCurrentUser] = useState<UserResponse | null>(null);
  const [resetEmail, setResetEmail] = useState<string>('');

  useEffect(() => {
    // Check path from URL
    const path = window.location.pathname;
    let initialRoute: Route = '/login';
    
    if (path === '/register') initialRoute = '/register';
    if (path === '/join') initialRoute = '/join' as any; // Wait, I need to add /join to Route type

    const storedUser = localStorage.getItem('userInfo');
    const storedToken = localStorage.getItem('accessToken');

    if (storedUser && storedToken) {
      try {
        const user = JSON.parse(storedUser) as UserResponse;
        setCurrentUser(user);
        
        // If they hit /join while logged in, go to /join
        if (path === '/join') {
          setCurrentRoute('/join');
        } else if (user.platformRole === 'ADMIN') {
          setCurrentRoute('/admin');
        } else {
          setCurrentRoute('/home');
        }
      } catch (e) {
        localStorage.clear();
        // Don't auto-redirect, just let currentRoute be /join
        if (path === '/join') {
          setCurrentRoute('/join');
          return;
        }
        setCurrentRoute(initialRoute);
      }
    } else {
      if (path === '/join') {
        setCurrentRoute('/join');
        return;
      }
      setCurrentRoute(initialRoute);
    }
  }, []);

  const handleLoginSuccess = (authData: AuthResponse) => {
    setCurrentUser(authData.user);
    const params = new URLSearchParams(window.location.search);
    const token = params.get('inviteToken');
    if (token) {
      window.history.replaceState({}, '', `/join?token=${token}`);
      setCurrentRoute('/join');
      return;
    }
    if (authData.user.platformRole === 'ADMIN') {
      setCurrentRoute('/admin');
    } else {
      setCurrentRoute('/home');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userInfo');
    setCurrentUser(null);
    setCurrentRoute('/login');
  };

  if (currentRoute === '/home' && currentUser) {
    return <HomePage user={currentUser} onLogout={handleLogout} />;
  }

  if (currentRoute === '/admin' && currentUser) {
    return <AdminDashboard user={currentUser} onLogout={handleLogout} />;
  }

  if (currentRoute === '/register') {
    return (
      <RegisterForm
        onSwitchToLogin={() => setCurrentRoute('/login')}
      />
    );
  }

  if (currentRoute === '/forgot-password') {
    return (
      <ForgotPasswordForm
        onBackToLogin={() => setCurrentRoute('/login')}
        onSuccess={(email) => {
          setResetEmail(email);
          setCurrentRoute('/reset-password');
        }}
      />
    );
  }

  if (currentRoute === '/reset-password') {
    return (
      <ResetPasswordForm
        email={resetEmail}
        onBackToLogin={() => setCurrentRoute('/login')}
        onSuccess={() => setCurrentRoute('/login')}
      />
    );
  }

  if (currentRoute === '/join') {
    if (currentUser) {
      return (
        <JoinHome 
          onSuccess={() => setCurrentRoute('/home')} 
          onCancel={() => setCurrentRoute('/home')} 
        />
      );
    } else {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      if (token) {
        return (
          <UnauthenticatedJoin 
            token={token} 
            onSelectLogin={() => setCurrentRoute('/login')}
            onSelectRegister={() => setCurrentRoute('/register')}
          />
        );
      }
    }
  }

  return (
    <LoginForm
      onSwitchToRegister={() => setCurrentRoute('/register')}
      onSwitchToForgotPassword={() => setCurrentRoute('/forgot-password')}
      onLoginSuccess={handleLoginSuccess}
    />
  );
}

export default App;
