import { Outlet } from 'react-router-dom';
import { CatalogContainer } from '../features/catalog/containers/CatalogContainer';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export const CatalogPage = () => {
  useDocumentTitle('Cafés');
  return (
    <div className="stack">
      <div className="stack">
        <h1 className="display page-title">Cafés</h1>
        <p>Elige un tamaño y paga con tu tarjeta.</p>
      </div>
      <CatalogContainer />
      <Outlet />
    </div>
  );
};
