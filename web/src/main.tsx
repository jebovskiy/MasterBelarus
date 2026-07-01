import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthGuard } from './components/screens/SplashScreen';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGuard>
      <App />
    </AuthGuard>
  </StrictMode>,
);

if (window.Telegram?.WebApp) {
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
}
