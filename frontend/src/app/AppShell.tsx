import { ReactNode, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './app-shell.css';

export const AppShell = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const previous = useRef(pathname);

  // A screen reader user should land on the new page, not stay on the link they pressed.
  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    // Steps that open as a dialog keep the focus inside the dialog.
    if (pathname.startsWith('/checkout/')) return;
    mainRef.current?.focus();
    mainRef.current?.scrollIntoView?.({ block: 'start' });
  }, [pathname]);

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Saltar al contenido
      </a>
      <header className="shell__header">
        <div className="container">
          <Link className="shell__brand display" to="/">
            Tienda de café de especialidad
          </Link>
        </div>
      </header>
      <main id="main" className="shell__main container" tabIndex={-1} ref={mainRef}>
        {children}
      </main>
      <footer className="shell__footer">
        <div className="container">
          <p>
            Tienda de demostración. Los pagos se hacen en un entorno de pruebas y no se cobra dinero
            real.
          </p>
        </div>
      </footer>
    </div>
  );
};
