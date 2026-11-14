import { Route, Routes } from 'react-router-dom';
import { DetailsContainer } from '../features/checkout/containers/DetailsContainer';
import { CatalogPage } from '../pages/CatalogPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { AppShell } from './AppShell';
import { ErrorBoundary } from './ErrorBoundary';

export const App = () => (
  <AppShell>
    <ErrorBoundary onReload={() => window.location.reload()}>
      <Routes>
        <Route path="/" element={<CatalogPage />}>
          <Route path="checkout/details" element={<DetailsContainer />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  </AppShell>
);
