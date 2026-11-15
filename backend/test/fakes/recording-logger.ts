import { EventLogger, LogFields } from '../../src/application/ports/event-logger';

export type Recorded = { level: 'info' | 'warn' | 'error'; event: string } & LogFields;

/** Keeps every event, so a test can say exactly what a use case reported. */
export class RecordingLogger implements EventLogger {
  readonly lines: Recorded[] = [];
  info = (event: string, fields: LogFields = {}) =>
    void this.lines.push({ level: 'info', event, ...fields });
  warn = (event: string, fields: LogFields = {}) =>
    void this.lines.push({ level: 'warn', event, ...fields });
  error = (event: string, fields: LogFields = {}) =>
    void this.lines.push({ level: 'error', event, ...fields });
  events = () => this.lines.map((l) => l.event);
  text = () => JSON.stringify(this.lines);
}
