import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from './ErrorBoundary';

const Broken = (): never => {
  throw new Error('secret internals: db password');
};

describe('ErrorBoundary', () => {
  let spy: jest.SpyInstance;
  beforeEach(() => {
    spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => spy.mockRestore());

  it('renders its children when nothing fails', () => {
    render(
      <ErrorBoundary onReload={jest.fn()}>
        <p>All good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('shows a plain message and a way out instead of a blank page, without the technical error', async () => {
    const onReload = jest.fn();
    render(
      <ErrorBoundary onReload={onReload}>
        <Broken />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(document.body.textContent).not.toContain('secret internals');
    await userEvent.click(screen.getByRole('button', { name: 'Reload the page' }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });
});
