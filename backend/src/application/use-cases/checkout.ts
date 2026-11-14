import { createCustomer, Customer } from '../../domain/customer/customer';
import { Variant } from '../../domain/product/variant';
import { err, ok, Result } from '../../domain/shared/result';
import { createDelivery, Delivery } from '../../domain/transaction/delivery';
import { calculateAmounts } from '../../domain/transaction/fees';
import { createTransaction, Transaction } from '../../domain/transaction/transaction';
import { SettleTransaction } from '../settle-transaction';
import { CatalogRepository } from '../ports/catalog.repository';
import { CustomerRepository } from '../ports/customer.repository';
import { PaymentGateway } from '../ports/payment.gateway';
import { Clock, IdGenerator } from '../ports/system.ports';
import { TransactionRepository } from '../ports/transaction.repository';

export type CheckoutInput = {
  idempotencyKey: string;
  variantId: string;
  quantity: number;
  customer: { name: string; email: string };
  delivery: Delivery;
  cardToken: string;
  acceptanceToken: string;
  personalAuthToken: string;
};
export type CheckoutError = 'INVALID_INPUT' | 'VARIANT_NOT_FOUND' | 'OUT_OF_STOCK';

type Placed = { transaction: Transaction; created: boolean };
type Tokens = { cardToken: string; acceptanceToken: string; personalAuthToken: string };
type Parsed = Tokens & {
  key: string;
  variantId: string;
  quantity: number;
  customer: Customer;
  delivery: Delivery;
};

const KEY = /^[A-Za-z0-9_-]{8,100}$/;
const TOKEN = /^[\w.-]{1,2048}$/;

export class Checkout {
  private readonly settler: SettleTransaction;

  constructor(
    private readonly catalog: CatalogRepository,
    private readonly transactions: TransactionRepository,
    private readonly customers: CustomerRepository,
    private readonly gateway: PaymentGateway,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {
    this.settler = new SettleTransaction(transactions, catalog);
  }

  async execute(input: CheckoutInput): Promise<Result<Transaction, CheckoutError>> {
    const parsed = this.parse(input);
    if (!parsed.ok) return parsed;
    const p = parsed.value;

    const existing = await this.transactions.findByIdempotencyKey(p.key);
    if (existing) return ok(existing);

    const variant = await this.catalog.findVariant(p.variantId);
    if (!variant) return err('VARIANT_NOT_FOUND');

    const placed = await this.withReservedStock(variant, p.quantity, () => this.place(p, variant));
    if (!placed.ok) return placed;
    const { transaction, created } = placed.value;
    return created ? this.charge(transaction, p) : ok(transaction);
  }

  private parse(input: CheckoutInput): Result<Parsed, 'INVALID_INPUT'> {
    const customer = createCustomer({ id: '', ...input.customer });
    const delivery = createDelivery({ ...input.delivery });
    if (!customer.ok || !delivery.ok) return err('INVALID_INPUT');
    if (typeof input.idempotencyKey !== 'string' || !KEY.test(input.idempotencyKey)) {
      return err('INVALID_INPUT');
    }
    const tokens = [input.cardToken, input.acceptanceToken, input.personalAuthToken];
    if (!tokens.every((t) => typeof t === 'string' && TOKEN.test(t))) return err('INVALID_INPUT');
    return ok({
      cardToken: input.cardToken,
      acceptanceToken: input.acceptanceToken,
      personalAuthToken: input.personalAuthToken,
      key: input.idempotencyKey,
      variantId: String(input.variantId),
      quantity: input.quantity,
      customer: customer.value,
      delivery: delivery.value,
    });
  }

  private async place(p: Parsed, variant: Variant): Promise<Result<Placed, CheckoutError>> {
    const amounts = calculateAmounts(variant.price, p.quantity);
    if (!amounts.ok) return err('INVALID_INPUT');

    const customer = await this.findOrCreateCustomer(p.customer);
    const transaction = createTransaction({
      id: this.ids.next(),
      customerId: customer.id,
      variantId: variant.id,
      quantity: p.quantity,
      amounts: amounts.value,
      delivery: p.delivery,
      createdAt: this.clock.now(),
    });
    if (!transaction.ok) return err('INVALID_INPUT');

    return ok(await this.transactions.createIfAbsent(p.key, transaction.value));
  }

  /** The outcome of the charge never fails the request: the transaction already exists and tells the story. */
  private async charge(transaction: Transaction, p: Parsed): Promise<Result<Transaction, never>> {
    const charged = await this.gateway.charge({
      reference: transaction.id,
      amountInCents: transaction.amounts.total.amountInCents,
      customerEmail: p.customer.email,
      cardToken: p.cardToken,
      acceptanceToken: p.acceptanceToken,
      personalAuthToken: p.personalAuthToken,
    });
    if (!charged.ok) {
      // REJECTED: the provider refused it. UNAVAILABLE: unknown outcome, stay PENDING and reconcile later.
      return ok(
        charged.error === 'GATEWAY_REJECTED'
          ? await this.settler.execute(transaction, 'ERROR', null)
          : transaction,
      );
    }
    const { status, providerRef } = charged.value;
    return ok(
      status === 'PENDING'
        ? transaction
        : await this.settler.execute(transaction, status, providerRef),
    );
  }

  private async findOrCreateCustomer(data: Customer): Promise<Customer> {
    const found = await this.customers.findByEmail(data.email);
    if (found) return found;
    const created = { ...data, id: this.ids.next() };
    await this.customers.save(created);
    return created;
  }

  /** Reserves first and gives the units back when the order was not stored by this call. */
  private async withReservedStock(
    variant: Variant,
    quantity: number,
    next: () => Promise<Result<Placed, CheckoutError>>,
  ): Promise<Result<Placed, CheckoutError>> {
    if (!calculateAmounts(variant.price, quantity).ok) return err('INVALID_INPUT');
    const reserved = await this.catalog.reserveStock(variant.id, quantity);
    if (!reserved.ok) {
      return err(reserved.error === 'VARIANT_NOT_FOUND' ? 'VARIANT_NOT_FOUND' : 'OUT_OF_STOCK');
    }
    let outcome: Result<Placed, CheckoutError>;
    try {
      outcome = await next();
    } catch (error) {
      await this.catalog.releaseStock(variant.id, quantity);
      throw error;
    }
    if (!outcome.ok || !outcome.value.created) {
      await this.catalog.releaseStock(variant.id, quantity);
    }
    return outcome;
  }
}
