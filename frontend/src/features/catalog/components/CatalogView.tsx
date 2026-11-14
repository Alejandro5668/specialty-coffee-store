import { ReactNode } from 'react';
import { Button } from '../../../ui/atoms/Button';
import { Skeleton } from '../../../ui/atoms/Skeleton';
import './catalog-view.css';

type Props = {
  status: 'idle' | 'loading' | 'ready' | 'failed';
  error: string | null;
  hasCoffees: boolean;
  onRetry: () => void;
  children: ReactNode;
};

const PLACEHOLDERS = [0, 1, 2, 3, 4, 5];

export const CatalogView = ({ status, error, hasCoffees, onRetry, children }: Props) => {
  if (!hasCoffees && (status === 'idle' || status === 'loading')) {
    return (
      <div role="status" aria-live="polite">
        <span className="visually-hidden">Loading coffees</span>
        <div className="catalog__grid" aria-hidden="true">
          {PLACEHOLDERS.map((n) => (
            <div key={n} className="catalog__placeholder">
              <Skeleton className="catalog__placeholder-image" />
              <Skeleton />
              <Skeleton />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!hasCoffees && status === 'failed') {
    return (
      <div role="alert" className="notice notice--error stack">
        <p>{error}</p>
        <Button onClick={onRetry}>Try again</Button>
      </div>
    );
  }

  if (!hasCoffees) return <p>No coffees are available right now. Check back soon.</p>;

  return (
    <div className="stack">
      {status === 'failed' && (
        <div role="status" className="notice stack">
          <p>We could not refresh the stock. The list below may be out of date.</p>
          <Button variant="quiet" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
      <div className="catalog__grid">{children}</div>
    </div>
  );
};
