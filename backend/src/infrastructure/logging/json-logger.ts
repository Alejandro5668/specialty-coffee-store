import { AsyncLocalStorage } from 'node:async_hooks';
import { EventLogger, LogFields } from '../../application/ports/event-logger';

/** Carries the id of the request being served to every log line written while it runs. */
export const requestContext = new AsyncLocalStorage<{ requestId: string }>();

const RESERVED = new Set(['level', 'event', 'time', 'requestId']);
const KEY = /^[A-Za-z][A-Za-z0-9_]{0,40}$/;
const MAX_TEXT = 500;
/** A stack trace is how a failure is located, so it gets room for its frames. */
const MAX_BY_FIELD = new Map<string, number>([['stack', 4_000]]);

type Level = 'info' | 'warn' | 'error';
type Sink = (line: string) => void;

const plain = (value: unknown, max: number): string | number | boolean | null | undefined => {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    return value.length > max ? `${value.slice(0, max)}…` : value;
  }
  return undefined;
};

/**
 * One JSON object per line on stdout, which Lambda sends to CloudWatch Logs, where each field
 * can be filtered and counted. A failure while logging is swallowed: it must never break a purchase.
 */
export class JsonLogger implements EventLogger {
  constructor(
    private readonly write: Sink = (line) => void process.stdout.write(`${line}\n`),
    private readonly now: () => Date = () => new Date(),
  ) {}

  info(event: string, fields?: LogFields): void {
    this.emit('info', event, fields);
  }
  warn(event: string, fields?: LogFields): void {
    this.emit('warn', event, fields);
  }
  error(event: string, fields?: LogFields): void {
    this.emit('error', event, fields);
  }

  private emit(level: Level, event: string, fields: LogFields = {}): void {
    try {
      const entry: Record<string, unknown> = { level, event, time: this.now().toISOString() };
      const requestId = requestContext.getStore()?.requestId;
      if (requestId) entry.requestId = requestId;
      for (const [key, raw] of Object.entries(fields)) {
        const value = plain(raw, MAX_BY_FIELD.get(key) ?? MAX_TEXT);
        if (value !== undefined && KEY.test(key) && !RESERVED.has(key)) entry[key] = value;
      }
      this.write(JSON.stringify(entry));
    } catch {
      // Logging is a side effect: whatever goes wrong here is not worth failing the request.
    }
  }
}
