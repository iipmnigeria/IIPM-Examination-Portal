import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import AdminAssignmentWidget from './components/AdminAssignmentWidget';
import SupabaseSessionBoundary from './components/SupabaseSessionBoundary';
import './index.css';

type PortalErrorBoundaryProps = {
  children: ReactNode;
};

type PortalErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

class PortalErrorBoundary extends Component<
  PortalErrorBoundaryProps,
  PortalErrorBoundaryState
> {
  state: PortalErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): PortalErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected application error occurred.',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('IIPM Examination Portal failed to render:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            padding: '24px',
            background: '#f8fafc',
            color: '#0f172a',
            fontFamily: 'Arial, sans-serif',
          }}
        >
          <section
            style={{
              width: '100%',
              maxWidth: '640px',
              padding: '28px',
              borderRadius: '16px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 18px 50px rgba(15, 23, 42, 0.12)',
            }}
          >
            <h1 style={{ margin: '0 0 12px', fontSize: '24px' }}>
              IIPM Examination Portal
            </h1>
            <p style={{ margin: '0 0 12px', lineHeight: 1.6 }}>
              The portal could not complete startup. Refresh the page once. If the
              message remains, send a screenshot of this panel to the portal administrator.
            </p>
            <code
              style={{
                display: 'block',
                padding: '12px',
                borderRadius: '8px',
                background: '#f1f5f9',
                color: '#be123c',
                overflowWrap: 'anywhere',
              }}
            >
              {this.state.message}
            </code>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('The portal root element was not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <PortalErrorBoundary>
      <SupabaseSessionBoundary>
        <App />
        <AdminAssignmentWidget />
      </SupabaseSessionBoundary>
    </PortalErrorBoundary>
  </StrictMode>,
);
