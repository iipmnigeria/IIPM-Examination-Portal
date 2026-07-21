import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import AdminAssignmentWidget from './components/AdminAssignmentWidget';
import CandidateCommerceOverlay from './components/CandidateCommerceOverlay';
import PaymentReturnHandler from './components/PaymentReturnHandler';
import SupabaseSessionBoundary from './components/SupabaseSessionBoundary';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('The portal root element was not found.');
}

const showStartupError = (message: string) => {
  rootElement.replaceChildren();

  const page = document.createElement('main');
  page.style.minHeight = '100vh';
  page.style.display = 'grid';
  page.style.placeItems = 'center';
  page.style.padding = '24px';
  page.style.background = '#f8fafc';
  page.style.color = '#0f172a';
  page.style.fontFamily = 'Arial, sans-serif';

  const panel = document.createElement('section');
  panel.style.width = '100%';
  panel.style.maxWidth = '640px';
  panel.style.padding = '28px';
  panel.style.borderRadius = '16px';
  panel.style.background = '#ffffff';
  panel.style.border = '1px solid #e2e8f0';
  panel.style.boxShadow = '0 18px 50px rgba(15, 23, 42, 0.12)';

  const heading = document.createElement('h1');
  heading.textContent = 'IIPM Examination Portal';
  heading.style.margin = '0 0 12px';
  heading.style.fontSize = '24px';

  const instruction = document.createElement('p');
  instruction.textContent =
    'The portal could not complete startup. Refresh the page once. If the message remains, send a screenshot of this panel to the portal administrator.';
  instruction.style.margin = '0 0 12px';
  instruction.style.lineHeight = '1.6';

  const diagnostic = document.createElement('code');
  diagnostic.textContent = message || 'An unexpected application error occurred.';
  diagnostic.style.display = 'block';
  diagnostic.style.padding = '12px';
  diagnostic.style.borderRadius = '8px';
  diagnostic.style.background = '#f1f5f9';
  diagnostic.style.color = '#be123c';
  diagnostic.style.overflowWrap = 'anywhere';

  panel.append(heading, instruction, diagnostic);
  page.append(panel);
  rootElement.append(page);
};

window.addEventListener('error', (event) => {
  console.error('IIPM Examination Portal startup error:', event.error || event.message);
  const message = event.error instanceof Error ? event.error.message : event.message;
  showStartupError(message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('IIPM Examination Portal unhandled rejection:', event.reason);
  const message =
    event.reason instanceof Error ? event.reason.message : String(event.reason || 'Unknown error');
  showStartupError(message);
});

createRoot(rootElement).render(
  <StrictMode>
    <SupabaseSessionBoundary>
      <App />
      <CandidateCommerceOverlay />
      <PaymentReturnHandler />
      <AdminAssignmentWidget />
    </SupabaseSessionBoundary>
  </StrictMode>,
);
