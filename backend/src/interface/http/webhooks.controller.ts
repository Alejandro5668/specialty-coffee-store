import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { ProcessPaymentEvent } from '../../application/use-cases/process-payment-event';
import { ErrorDto, WebhookReceivedDto } from './docs/api.dto';
import { unwrap } from './errors';

/** Never throttled: the provider must always get through, and the signature is the gate. */
@SkipThrottle()
@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger('Webhooks');

  constructor(private readonly processEvent: ProcessPaymentEvent) {}

  /** The provider retries on anything but 200, so a handled event (even a replay) always answers 200. */
  @Post('payments')
  @ApiOperation({
    summary: 'Receive a payment event from the provider. Idempotent: replays change nothing',
  })
  @ApiBody({ schema: { type: 'object', description: 'Provider event with its signed checksum.' } })
  @ApiOkResponse({ type: WebhookReceivedDto })
  @ApiResponse({ status: 400, description: 'Malformed event', type: ErrorDto })
  @ApiResponse({ status: 401, description: 'Invalid signature', type: ErrorDto })
  @ApiResponse({ status: 404, description: 'Unknown order', type: ErrorDto })
  @ApiResponse({ status: 413, description: 'Body larger than 16 KB', type: ErrorDto })
  @ApiResponse({ status: 422, description: 'Amount does not match the order', type: ErrorDto })
  @HttpCode(200)
  async payments(@Body() payload: unknown): Promise<{ received: true }> {
    const result = await this.processEvent.execute(payload);
    // Only the reason and the order id: never the body, the signature or a secret.
    if (result.ok) {
      this.logger.log(`Webhook accepted: order ${result.value.id} is ${result.value.status}`);
    } else {
      this.logger.warn(`Webhook rejected: ${result.error}`);
    }
    unwrap(result);
    return { received: true };
  }
}
