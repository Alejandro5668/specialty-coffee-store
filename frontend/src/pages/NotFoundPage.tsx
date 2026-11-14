import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export const NotFoundPage = () => {
  useDocumentTitle('Página no encontrada');
  return (
    <div className="stack">
      <h1 className="display">No encontramos esa página</h1>
      <p>Puede que la dirección esté mal escrita o que la página se haya movido.</p>
      <Link to="/">Ver los cafés</Link>
    </div>
  );
};
