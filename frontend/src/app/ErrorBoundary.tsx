import { Component, ReactNode } from 'react';
import { Button } from '../ui/atoms/Button';

type Props = { children: ReactNode; onReload: () => void };

/** A crash in one screen must never leave a blank page or show technical details. */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="stack">
        <h1 className="display">Something went wrong</h1>
        <p>The page could not be shown. Reload it and try again.</p>
        <Button onClick={this.props.onReload}>Reload the page</Button>
      </div>
    );
  }
}
