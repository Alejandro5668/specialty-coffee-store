import { Result, ok, err, andThen } from '../domain/result';

export interface StockRepository {
  reserve(variantId: string, quantity: number): Promise<boolean>;
  release(variantId: string, quantity: number): Promise<void>;
}

export type CreateCheckoutError = 'INVALID_INPUT' | 'OUT_OF_STOCK';

export class CreateCheckout {
  constructor(private readonly stock: StockRepository) {}

  async execute(input: { variantId: string; quantity: number }): Promise<Result<{ reserved: true }, CreateCheckoutError>> {
    const validated = this.validate(input);
    return andThen(validated, async (v) =>
      (await this.stock.reserve(v.variantId, v.quantity)) ? ok({ reserved: true as const }) : err('OUT_OF_STOCK' as const),
    );
  }

  private validate(input: { variantId: string; quantity: number }): Result<typeof input, CreateCheckoutError> {
    return Number.isInteger(input.quantity) && input.quantity > 0 ? ok(input) : err('INVALID_INPUT');
  }
}
