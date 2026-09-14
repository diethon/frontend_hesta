import { BrowserRouter } from 'react-router';
import { RealtimeLifecycle } from './realtime/RealtimeLifecycle';
import { AppRoutes } from './routes/AppRoutes';

function App() {
  return (
    <>
      <RealtimeLifecycle />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </>
  );
}

export default App;
