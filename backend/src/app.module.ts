import { Module, Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CatalogRepository } from './application/ports/catalog.repository';
import { CustomerRepository } from './application/ports/customer.repository';
import { EventVerifier } from './application/ports/event.verifier';
import { OrderStore } from './application/ports/order.store';
import { PaymentGateway } from './application/ports/payment.gateway';
import { Clock, IdGenerator } from './application/ports/system.ports';
import { TransactionRepository } from './application/ports/transaction.repository';
import { Checkout } from './application/use-cases/checkout';
import { GetCheckoutOptions } from './application/use-cases/get-checkout-options';
import { GetTransaction } from './application/use-cases/get-transaction';
import { ListProducts } from './application/use-cases/list-products';
import { ProcessPaymentEvent } from './application/use-cases/process-payment-event';
import { runtime } from './composition/runtime';
import { TOKENS } from './composition/tokens';
import { DynamoCatalogRepository } from './infrastructure/dynamodb/catalog.repository';
import { DynamoCustomerRepository } from './infrastructure/dynamodb/customer.repository';
import { DynamoOrderStore } from './infrastructure/dynamodb/order.store';
import { DynamoTransactionRepository } from './infrastructure/dynamodb/transaction.repository';
import { ChecksumEventVerifier } from './infrastructure/payments/checksum-event.verifier';
import { HttpPaymentGateway } from './infrastructure/payments/http-payment.gateway';
import { SystemClock, UuidIdGenerator } from './infrastructure/system/system';
import { CheckoutController } from './interface/http/checkout.controller';
import { HealthController } from './interface/http/health.controller';
import { ProductsController } from './interface/http/products.controller';
import { TransactionsController } from './interface/http/transactions.controller';
import { WebhooksController } from './interface/http/webhooks.controller';

const adapters: Provider[] = [
  {
    provide: TOKENS.catalog,
    useFactory: () => new DynamoCatalogRepository(runtime().client, runtime().dynamo),
  },
  {
    provide: TOKENS.transactions,
    useFactory: () => new DynamoTransactionRepository(runtime().client, runtime().dynamo),
  },
  {
    provide: TOKENS.orders,
    inject: [TOKENS.transactions],
    useFactory: (transactions: TransactionRepository) =>
      new DynamoOrderStore(runtime().client, runtime().dynamo, transactions),
  },
  {
    provide: TOKENS.customers,
    useFactory: () => new DynamoCustomerRepository(runtime().client, runtime().dynamo),
  },
  { provide: TOKENS.gateway, useFactory: () => new HttpPaymentGateway(runtime().payments) },
  {
    provide: TOKENS.verifier,
    useFactory: () => new ChecksumEventVerifier(runtime().payments.eventsSecret),
  },
  { provide: TOKENS.ids, useFactory: () => new UuidIdGenerator() },
  { provide: TOKENS.clock, useFactory: () => new SystemClock() },
];

const useCases: Provider[] = [
  {
    provide: ListProducts,
    inject: [TOKENS.catalog],
    useFactory: (catalog: CatalogRepository) => new ListProducts(catalog),
  },
  {
    provide: Checkout,
    inject: [
      TOKENS.catalog,
      TOKENS.transactions,
      TOKENS.orders,
      TOKENS.customers,
      TOKENS.gateway,
      TOKENS.ids,
      TOKENS.clock,
    ],
    useFactory: (
      catalog: CatalogRepository,
      transactions: TransactionRepository,
      orders: OrderStore,
      customers: CustomerRepository,
      gateway: PaymentGateway,
      ids: IdGenerator,
      clock: Clock,
    ) => new Checkout(catalog, transactions, orders, customers, gateway, ids, clock),
  },
  {
    provide: GetCheckoutOptions,
    inject: [TOKENS.gateway],
    useFactory: (gateway: PaymentGateway) => new GetCheckoutOptions(gateway),
  },
  {
    provide: GetTransaction,
    inject: [TOKENS.transactions, TOKENS.gateway, TOKENS.orders, TOKENS.clock],
    useFactory: (
      transactions: TransactionRepository,
      gateway: PaymentGateway,
      orders: OrderStore,
      clock: Clock,
    ) => new GetTransaction(transactions, gateway, orders, clock),
  },
  {
    provide: ProcessPaymentEvent,
    inject: [TOKENS.verifier, TOKENS.transactions, TOKENS.orders],
    useFactory: (
      verifier: EventVerifier,
      transactions: TransactionRepository,
      orders: OrderStore,
    ) => new ProcessPaymentEvent(verifier, transactions, orders),
  },
];

@Module({
  controllers: [
    HealthController,
    ProductsController,
    CheckoutController,
    TransactionsController,
    WebhooksController,
  ],
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }])],
  providers: [...adapters, ...useCases, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
