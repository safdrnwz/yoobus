import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon } from 'lucide-react';
import { Button } from '@/components/ui';

interface State {
  error: Error | null;
}

/**
 * Stops one broken screen from taking down the whole console. A render error here shows
 * a recoverable panel instead of a blank page, and the user keeps their session.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Wire this to your error reporter of choice.
    console.error('Unhandled UI error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-surface bg-danger-soft text-danger">
          <AlertOctagon className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-step-2 text-ink">This screen stopped responding</h1>
          <p className="mt-1 max-w-md text-step-0 text-ink-muted">
            Reloading usually clears it. Your session and unsaved server data are unaffected.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => this.setState({ error: null })} variant="outline">
            Try again
          </Button>
          <Button onClick={() => window.location.reload()}>Reload the app</Button>
        </div>
      </div>
    );
  }
}
