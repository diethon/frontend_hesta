import { useEffect, useState } from 'react';
import { LoginForm } from './components/auth/LoginForm';
import { RegisterForm } from './components/auth/RegisterForm';
import { HomePage } from './components/home/HomePage';
import type { AuthResponse, UserResponse } from './types/auth';

type Route = '/login' | '/register' | '/home';

function App() {
  const [currentRoute, setCurrentRoute] = useState<Route>('/login');
  const [currentUser, setCurrentUser] = useState<UserResponse | null>(null);

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

  return (
    <LoginForm
      onSwitchToRegister={() => setCurrentRoute('/register')}
      onLoginSuccess={handleLoginSuccess}
    />
  );
}

export default App;
