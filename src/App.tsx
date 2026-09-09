import { useEffect, useState } from 'react';
import { LoginForm } from './components/auth/LoginForm';
import { RegisterForm } from './components/auth/RegisterForm';
import { HomePage } from './components/home/HomePage';
import { ForgotPasswordForm } from './components/auth/ForgotPasswordForm';
import { ResetPasswordForm } from './components/auth/ResetPasswordForm';
import type { AuthResponse, UserResponse } from './types/auth';

type Route = '/login' | '/register' | '/home' | '/forgot-password' | '/reset-password';

function App() {
  const [currentRoute, setCurrentRoute] = useState<Route>('/login');
  const [currentUser, setCurrentUser] = useState<UserResponse | null>(null);
  const [resetEmail, setResetEmail] = useState<string>('');

  useEffect(() => {
    // Check if user is already logged in
    const storedUser = localStorage.getItem('userInfo');
    const storedToken = localStorage.getItem('accessToken');

    if (storedUser && storedToken) {
      try {
        setCurrentUser(JSON.parse(storedUser));
        setCurrentRoute('/home');
      } catch (e) {
        localStorage.clear();
        setCurrentRoute('/login');
      }
    } else {
      setCurrentRoute('/login');
    }
  }, []);

  const handleLoginSuccess = (authData: AuthResponse) => {
    setCurrentUser(authData.user);
    setCurrentRoute('/home');
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

  return (
    <LoginForm
      onSwitchToRegister={() => setCurrentRoute('/register')}
      onSwitchToForgotPassword={() => setCurrentRoute('/forgot-password')}
      onLoginSuccess={handleLoginSuccess}
    />
  );
}

export default App;
