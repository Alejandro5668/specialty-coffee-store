import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ProcessPaymentEvent } from '../../application/use-cases/process-payment-event';
import { unwrap } from './errors';

/** Never throttled: the provider must always get through, and the signature is the gate. */
@SkipThrottle()
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly processEvent: ProcessPaymentEvent) {}

  /** The provider retries on anything but 200, so a handled event (even a replay) always answers 200. */
  @Post('payments')
  @HttpCode(200)
  async payments(@Body() payload: unknown): Promise<{ received: true }> {
    unwrap(await this.processEvent.execute(payload));
    return { received: true };
  }
}
