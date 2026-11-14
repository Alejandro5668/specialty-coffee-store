import { createContext, ReactNode, useContext } from 'react';
import { CardTokenizer } from '../api/tokenizer';

export type PollSettings = { intervalMs: number; maxChecks: number };

/** Things the screens use that talk to the outside world or the clock, so tests can replace them. */
export type Services = {
  tokenizer: CardTokenizer;
  now: () => number;
  /** How often to ask whether a payment was confirmed, and how many times before saying it is slow. */
  poll?: PollSettings;
  /** How long the approved page stays before returning to the coffees. */
  autoReturnMs?: number;
};

export const DEFAULT_POLL: PollSettings = { intervalMs: 2_000, maxChecks: 30 };
export const DEFAULT_AUTO_RETURN_MS = 8_000;

const ServicesContext = createContext<Services | null>(null);

export const ServicesProvider = ({ value, children }: { value: Services; children: ReactNode }) => (
  <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>
);

export const useServices = (): Services => {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('ServicesProvider is missing');
  return services;
};
