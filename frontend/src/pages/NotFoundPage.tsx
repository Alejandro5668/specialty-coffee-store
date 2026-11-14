import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export const NotFoundPage = () => {
  useDocumentTitle('Page not found');
  return (
    <div className="stack">
      <h1 className="display">We could not find that page</h1>
      <p>The address may be wrong, or the page may have moved.</p>
      <Link to="/">See the coffees</Link>
    </div>
  );
};
