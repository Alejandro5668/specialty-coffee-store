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
        <h1 className="display">Algo salió mal</h1>
        <p>No se pudo mostrar la página. Recárgala e inténtalo de nuevo.</p>
        <Button onClick={this.props.onReload}>Recargar la página</Button>
      </div>
    );
  }
}
