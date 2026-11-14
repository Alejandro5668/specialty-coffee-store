import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Checkout } from '../../application/use-cases/checkout';
import { parseCheckoutBody } from './checkout.body';
import { CheckoutRequestDto, ErrorDto, TransactionDto } from './docs/api.dto';
import { unwrap } from './errors';
import { toTransactionView, TransactionView } from './transaction.view';

@ApiTags('Checkout')
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkout: Checkout) {}

  /** Stricter than the global limit: each call can reserve stock and charge a card. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  @ApiOperation({
    summary: 'Place an order: reserve the stock, create it as PENDING and charge the card',
  })
  @ApiBody({ type: CheckoutRequestDto })
  @ApiCreatedResponse({
    type: TransactionDto,
    description: 'The order, also on a repeated idempotencyKey.',
  })
  @ApiResponse({ status: 400, description: 'Missing data or wrong type of data', type: ErrorDto })
  @ApiResponse({ status: 404, description: 'The coffee size does not exist', type: ErrorDto })
  @ApiResponse({ status: 409, description: 'Not enough stock', type: ErrorDto })
  @ApiResponse({ status: 413, description: 'Body larger than 16 KB', type: ErrorDto })
  @ApiResponse({ status: 422, description: 'Data rejected by the order rules', type: ErrorDto })
  @ApiResponse({ status: 429, description: 'Too many requests (10 per minute)', type: ErrorDto })
  async create(@Body() body: unknown): Promise<TransactionView> {
    return toTransactionView(unwrap(await this.checkout.execute(parseCheckoutBody(body))));
  }
}
