import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ProcessPaymentEvent } from '../../application/use-cases/process-payment-event';
import { unwrap } from './errors';

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
