import { Route, Routes } from 'react-router-dom';
import { CatalogPage } from '../pages/CatalogPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { AppShell } from './AppShell';
import { ErrorBoundary } from './ErrorBoundary';

export const App = () => (
  <AppShell>
    <ErrorBoundary onReload={() => window.location.reload()}>
      <Routes>
        <Route path="/" element={<CatalogPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  </AppShell>
);
