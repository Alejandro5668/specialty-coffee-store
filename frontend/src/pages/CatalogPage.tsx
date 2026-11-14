import { useDocumentTitle } from '../hooks/useDocumentTitle';

export const CatalogPage = () => {
  useDocumentTitle('Coffees');
  return <h1 className="display">Coffees</h1>;
};
