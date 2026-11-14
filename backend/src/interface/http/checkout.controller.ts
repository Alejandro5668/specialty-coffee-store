import { Body, Controller, Post } from '@nestjs/common';
import { Checkout } from '../../application/use-cases/checkout';
import { parseCheckoutBody } from './checkout.body';
import { unwrap } from './errors';
import { toTransactionView, TransactionView } from './transaction.view';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkout: Checkout) {}

  @Post()
  async create(@Body() body: unknown): Promise<TransactionView> {
    return toTransactionView(unwrap(await this.checkout.execute(parseCheckoutBody(body))));
  }
}
