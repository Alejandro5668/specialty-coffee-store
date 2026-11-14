import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

describe('App shell', () => {
  it('has the landmarks and a skip link that points at the main content', () => {
    renderAt('/');
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
  });

  it('tells shoppers that payments run in a test environment', () => {
    renderAt('/');
    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      'Demo store. Payments run in a test environment and no real money is charged.',
    );
  });

  it('links the brand name to the first page', () => {
    renderAt('/nowhere');
    expect(screen.getByRole('link', { name: 'Specialty Coffee Store' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('sets the page title for each page', () => {
    renderAt('/');
    expect(document.title).toBe('Coffees - Specialty Coffee Store');
  });
});

describe('unknown pages', () => {
  it('say what happened and how to get back', () => {
    renderAt('/does/not/exist');
    expect(
      screen.getByRole('heading', { name: 'We could not find that page' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See the coffees' })).toHaveAttribute('href', '/');
    expect(document.title).toBe('Page not found - Specialty Coffee Store');
  });

  it('do not echo the address into the page', () => {
    renderAt('/%3Cscript%3Ealert(1)%3C%2Fscript%3E');
    expect(document.body.innerHTML).not.toContain('<script>alert');
    expect(screen.queryByText(/alert\(1\)/)).not.toBeInTheDocument();
  });

  it('move the focus to the main content when the shopper navigates, so a screen reader follows', async () => {
    renderAt('/does/not/exist');
    await userEvent.click(screen.getByRole('link', { name: 'See the coffees' }));
    expect(screen.getByRole('main')).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'Coffees' })).toBeInTheDocument();
  });
});
