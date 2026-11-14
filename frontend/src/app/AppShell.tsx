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
    mainRef.current?.focus();
    mainRef.current?.scrollIntoView?.({ block: 'start' });
  }, [pathname]);

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="shell__header">
        <div className="container">
          <Link className="shell__brand display" to="/">
            Specialty Coffee Store
          </Link>
        </div>
      </header>
      <main id="main" className="shell__main container" tabIndex={-1} ref={mainRef}>
        {children}
      </main>
      <footer className="shell__footer">
        <div className="container">
          <p>Demo store. Payments run in a test environment and no real money is charged.</p>
        </div>
      </footer>
    </div>
  );
};
