import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import SupabaseSessionBoundary from './components/SupabaseSessionBoundary';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SupabaseSessionBoundary>
      <App />
    </SupabaseSessionBoundary>
  </StrictMode>,
);
