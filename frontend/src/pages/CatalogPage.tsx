import { CatalogContainer } from '../features/catalog/containers/CatalogContainer';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export const CatalogPage = () => {
  useDocumentTitle('Coffees');
  return (
    <div className="stack">
      <div className="stack">
        <h1 className="display page-title">Coffees</h1>
        <p>Choose a size, then pay with your card.</p>
      </div>
      <CatalogContainer />
    </div>
  );
};
