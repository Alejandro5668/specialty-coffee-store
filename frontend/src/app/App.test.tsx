import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { selectCoffee } from '../store/checkoutSlice';
import { fakeApi } from '../test/fakeApi';
import { NOW } from '../test/state';
import { ServicesProvider } from './services';
import { createStore } from './store';
import { App } from './App';

const renderAt = (path: string) =>
  render(
    <Provider
      store={createStore({ api: fakeApi({ listProducts: async () => [] }), storage: null })}
    >
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </Provider>,
  );

describe('App shell', () => {
  it('has the landmarks and a skip link that points at the main content', () => {
    renderAt('/');
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Saltar al contenido' })).toHaveAttribute(
      'href',
      '#main',
    );
  });

  it('tells shoppers that payments run in a test environment', () => {
    renderAt('/');
    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      'Tienda de demostración. Los pagos se hacen en un entorno de pruebas y no se cobra dinero real.',
    );
  });

  it('links the brand name to the first page', () => {
    renderAt('/nowhere');
    expect(screen.getByRole('link', { name: 'Tienda de café de especialidad' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('sets the page title for each page', () => {
    renderAt('/');
    expect(document.title).toBe('Cafés - Tienda de café de especialidad');
  });
});

describe('unknown pages', () => {
  it('say what happened and how to get back', () => {
    renderAt('/does/not/exist');
    expect(screen.getByRole('heading', { name: 'No encontramos esa página' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver los cafés' })).toHaveAttribute('href', '/');
    expect(document.title).toBe('Página no encontrada - Tienda de café de especialidad');
  });

  it('do not echo the address into the page', () => {
    renderAt('/%3Cscript%3Ealert(1)%3C%2Fscript%3E');
    expect(document.body.innerHTML).not.toContain('<script>alert');
    expect(screen.queryByText(/alert\(1\)/)).not.toBeInTheDocument();
  });

  it('move the focus to the main content when the shopper navigates, so a screen reader follows', async () => {
    renderAt('/does/not/exist');
    await userEvent.click(screen.getByRole('link', { name: 'Ver los cafés' }));
    expect(screen.getByRole('main')).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'Cafés' })).toBeInTheDocument();
  });
});

describe('checkout route', () => {
  const renderCheckout = (selected: boolean) => {
    const store = createStore({
      api: fakeApi({ listProducts: async () => [] }),
      storage: null,
      now: () => NOW,
    });
    if (selected) store.dispatch(selectCoffee({ variantId: 'huila-washed-250', quantity: 1 }));
    render(
      <Provider store={store}>
        <ServicesProvider value={{ tokenizer: { tokenize: jest.fn() }, now: () => NOW }}>
          <MemoryRouter initialEntries={['/checkout/details']}>
            <App />
          </MemoryRouter>
        </ServicesProvider>
      </Provider>,
    );
  };

  it('opens the card and delivery dialog on top of the coffees', () => {
    renderCheckout(true);
    expect(screen.getByRole('dialog', { name: 'Tarjeta y entrega' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cafés' })).toBeInTheDocument();
  });

  it('goes back to the coffees when nothing was chosen', async () => {
    renderCheckout(false);
    expect(await screen.findByRole('heading', { name: 'Cafés' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
