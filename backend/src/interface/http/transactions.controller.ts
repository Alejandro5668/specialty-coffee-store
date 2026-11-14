import { Controller, Get, Param } from '@nestjs/common';
import { GetTransaction } from '../../application/use-cases/get-transaction';
import { unwrap } from './errors';
import { toTransactionView, TransactionView } from './transaction.view';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly getTransaction: GetTransaction) {}

  @Get(':id')
  async get(@Param('id') id: string): Promise<TransactionView> {
    return toTransactionView(unwrap(await this.getTransaction.execute(id)));
  }
}
