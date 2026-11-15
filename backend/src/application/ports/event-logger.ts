/**
 * What a log line may carry. Objects and arrays are left out on purpose: a log must never hold a
 * whole request, a customer or a card, only the few plain facts that explain what happened.
 */
export type LogValue = string | number | boolean | null;
export type LogFields = Record<string, LogValue | undefined>;

/** One line per business event, e.g. `order.settled`. Never carries personal or card data. */
export interface EventLogger {
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}

/** The default where no logger was given, so a use case never needs to check for one. */
export const silentLogger: EventLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};
