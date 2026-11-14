import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { resetRuntime } from '../src/composition/runtime';
import { Checkout } from '../src/application/use-cases/checkout';
import { GetTransaction } from '../src/application/use-cases/get-transaction';
import { ListProducts } from '../src/application/use-cases/list-products';
import { ProcessPaymentEvent } from '../src/application/use-cases/process-payment-event';

const ENV = {
  PAYMENT_API_URL: 'https://sandbox.example.test/v1',
  PAYMENT_PRIVATE_KEY: 'prv_test_x',
  PAYMENT_INTEGRITY_SECRET: 'test_integrity_x',
  PAYMENT_EVENTS_SECRET: 'test_events_x',
};

describe('real wiring', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    resetRuntime();
  });

  it('builds every use case with the real adapters, without touching the network', async () => {
    Object.assign(process.env, ENV);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    for (const useCase of [ListProducts, Checkout, GetTransaction, ProcessPaymentEvent]) {
      expect(moduleRef.get(useCase)).toBeInstanceOf(useCase);
    }
    await moduleRef.close();
  });

  it('fails at startup, naming the variable, when the payment settings are missing', async () => {
    for (const name of Object.keys(ENV)) delete process.env[name];
    await expect(Test.createTestingModule({ imports: [AppModule] }).compile()).rejects.toThrow(
      'PAYMENT_API_URL',
    );
  });
});
