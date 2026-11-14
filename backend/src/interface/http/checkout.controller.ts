import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Checkout } from '../../application/use-cases/checkout';
import { parseCheckoutBody } from './checkout.body';
import { unwrap } from './errors';
import { toTransactionView, TransactionView } from './transaction.view';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkout: Checkout) {}

  /** Stricter than the global limit: each call can reserve stock and charge a card. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  async create(@Body() body: unknown): Promise<TransactionView> {
    return toTransactionView(unwrap(await this.checkout.execute(parseCheckoutBody(body))));
  }
}
