import { randomUUID } from 'node:crypto';
import { Clock, IdGenerator } from '../../application/ports/system.ports';

export class UuidIdGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}

export class SystemClock implements Clock {
  now(): string {
    return new Date().toISOString();
  }
}
