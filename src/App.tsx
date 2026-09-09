import { RegisterForm } from './components/auth/RegisterForm';

function App() {
  return (
    <RegisterForm onSwitchToLogin={() => alert('Chức năng Đăng nhập sẽ được phát triển tiếp theo!')} />
  );
}

export default App;
