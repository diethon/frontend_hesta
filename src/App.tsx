import { createBrowserRouter, RouterProvider } from 'react-router';
import { NotificationLifecycle } from './realtime/NotificationLifecycle';
import { RealtimeLifecycle } from './realtime/RealtimeLifecycle';
import { AppRoutes } from './routes/AppRoutes';
import { AppToaster } from './components/ui/AppToast';
import { EmergencyFallModal } from './components/emergency/EmergencyFallModal';

// Preserve the route tree; React Router's data router supplies navigation blocking.
const router = createBrowserRouter([{ path: '*', element: <AppRoutes /> }]);

function App() {
  return (
    <>
      <a href="#main-content" className="skip-link">Bỏ qua đến nội dung chính</a>
      <RealtimeLifecycle />
      <NotificationLifecycle />
      <EmergencyFallModal />
      <RouterProvider router={router} />
      <AppToaster />
    </>
  );
}

export default App;
