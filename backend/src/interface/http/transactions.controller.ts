import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetTransaction } from '../../application/use-cases/get-transaction';
import { ErrorDto, TransactionDto } from './docs/api.dto';
import { unwrap } from './errors';
import { toTransactionView, TransactionView } from './transaction.view';

@ApiTags('Transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly getTransaction: GetTransaction) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get the status of an order; asks the provider if it is still PENDING' })
  @ApiParam({ name: 'id', description: 'Order id returned by POST /checkout.' })
  @ApiOkResponse({
    type: TransactionDto,
    description: 'Never includes delivery data or the customer.',
  })
  @ApiResponse({ status: 404, description: 'Unknown order', type: ErrorDto })
  @ApiResponse({ status: 429, description: 'Too many requests', type: ErrorDto })
  async get(@Param('id') id: string): Promise<TransactionView> {
    return toTransactionView(unwrap(await this.getTransaction.execute(id)));
  }
}
