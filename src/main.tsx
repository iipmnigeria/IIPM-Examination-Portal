import {Component, StrictMode, type ErrorInfo, type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import './githubPagesDemo';
import App from './App.tsx';
import './index.css';

class RootErrorBoundary extends Component<{children: ReactNode}, {error: Error | null}> {
  state: {error: Error | null} = {error: null};

  static getDerivedStateFromError(error: Error) {
    return {error};
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('IIPM portal render failure:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
          <section className="w-full max-w-xl rounded-2xl border border-rose-800/40 bg-slate-900 p-6 shadow-2xl">
            <h1 className="text-xl font-extrabold">The examination portal could not load.</h1>
            <p className="mt-3 text-sm text-slate-300">
              Refresh the page with Ctrl + Shift + R. If the problem continues, clear this site’s cached data and reopen it.
            </p>
            <pre className="mt-4 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-rose-300">
              {this.state.error.message}
            </pre>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Portal root element was not found.');

console.info('IIPM root portal build: 2026-07-21.1');

createRoot(rootElement).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
);
