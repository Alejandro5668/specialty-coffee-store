import { createContext, ReactNode, useContext } from 'react';
import { CardTokenizer } from '../api/tokenizer';

/** Things the screens use that talk to the outside world or the clock, so tests can replace them. */
export type Services = { tokenizer: CardTokenizer; now: () => number };

const ServicesContext = createContext<Services | null>(null);

export const ServicesProvider = ({ value, children }: { value: Services; children: ReactNode }) => (
  <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>
);

export const useServices = (): Services => {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('ServicesProvider is missing');
  return services;
};
