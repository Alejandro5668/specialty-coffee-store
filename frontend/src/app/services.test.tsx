import { render, screen } from '@testing-library/react';
import { ServicesProvider, useServices } from './services';

const Probe = () => <p>{String(useServices().now())}</p>;

describe('services', () => {
  it('gives the components the tokenizer and the clock', () => {
    render(
      <ServicesProvider value={{ tokenizer: { tokenize: jest.fn() }, now: () => 42 }}>
        <Probe />
      </ServicesProvider>,
    );
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('fails loudly when the provider is missing, instead of using a default that could hide a mistake', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow('ServicesProvider is missing');
    spy.mockRestore();
  });
});
