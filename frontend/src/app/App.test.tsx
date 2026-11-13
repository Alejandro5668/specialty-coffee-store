import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders the store title', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Specialty Coffee Store' })).toBeInTheDocument();
  });
});
