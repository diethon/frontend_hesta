import { BrowserRouter } from 'react-router';
import { NotificationLifecycle } from './realtime/NotificationLifecycle';
import { RealtimeLifecycle } from './realtime/RealtimeLifecycle';
import { AppRoutes } from './routes/AppRoutes';

function App() {
  return (
    <>
      <a href="#main-content" className="skip-link">Bỏ qua đến nội dung chính</a>
      <RealtimeLifecycle />
      <NotificationLifecycle />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </>
  );
}

export default App;
