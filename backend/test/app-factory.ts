import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { TOKENS } from '../src/composition/tokens';
import { configureApp } from '../src/interface/http/configure-app';
import { loadHttpConfig } from '../src/interface/http/http-config';
import { FakeGateway } from './fakes/fake-gateway';
import { FakeVerifier } from './fakes/fake-verifier';
import { catalogWithStock, fixedClock, sequentialIds, VARIANT_ID } from './fakes/fixtures';
import { InMemoryCustomers } from './fakes/in-memory-customers';
import { InMemoryOrders } from './fakes/in-memory-orders';
import { InMemoryTransactions } from './fakes/in-memory-transactions';

/** The real Nest module with every port replaced by an in-memory fake: no network, no AWS. */
export const buildTestApp = async (stock = 5) => {
  const catalog = catalogWithStock(VARIANT_ID, stock);
  const transactions = new InMemoryTransactions();
  const orders = new InMemoryOrders(catalog, transactions);
  const customers = new InMemoryCustomers();
  const gateway = new FakeGateway();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(TOKENS.catalog)
    .useValue(catalog)
    .overrideProvider(TOKENS.transactions)
    .useValue(transactions)
    .overrideProvider(TOKENS.orders)
    .useValue(orders)
    .overrideProvider(TOKENS.customers)
    .useValue(customers)
    .overrideProvider(TOKENS.gateway)
    .useValue(gateway)
    .overrideProvider(TOKENS.verifier)
    .useValue(new FakeVerifier())
    .overrideProvider(TOKENS.ids)
    .useValue(sequentialIds())
    .overrideProvider(TOKENS.clock)
    .useValue(fixedClock)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app, loadHttpConfig({ CORS_ORIGIN: 'http://localhost:5173' }));
  await app.init();
  return { app, catalog, transactions, orders, customers, gateway };
};
