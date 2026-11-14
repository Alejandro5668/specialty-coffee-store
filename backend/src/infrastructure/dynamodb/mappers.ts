import { Product } from '../../domain/product/product';
import { createVariant, Variant } from '../../domain/product/variant';
import { Money, money } from '../../domain/shared/money';
import { Transaction, TransactionStatus } from '../../domain/transaction/transaction';

type Item = Record<string, unknown>;

export const toProduct = (item: Item): Product => ({
  id: String(item.id),
  name: String(item.name),
  description: String(item.description),
  imageUrl: String(item.imageUrl),
});

/** Stored data is trusted but never blindly: a corrupt price or stock must not reach a customer. */
export const toVariant = (item: Item): Variant => {
  const price = money(item.priceInCents as number);
  if (!price.ok) throw new Error(`Corrupt variant ${String(item.id)}: invalid price`);
  const variant = createVariant({
    id: String(item.id),
    productId: String(item.productId),
    sizeGrams: item.sizeGrams as Variant['sizeGrams'],
    price: price.value,
    stock: item.stock as number,
  });
  if (!variant.ok) throw new Error(`Corrupt variant ${String(item.id)}: ${variant.error}`);
  return variant.value;
};

export const fromVariant = (variant: Variant): Item => ({
  id: variant.id,
  productId: variant.productId,
  sizeGrams: variant.sizeGrams,
  priceInCents: variant.price.amountInCents,
  stock: variant.stock,
});

const STATUSES: readonly TransactionStatus[] = ['PENDING', 'APPROVED', 'DECLINED', 'ERROR'];

export const IDEMPOTENCY_PREFIX = 'IDEM#';

const cents = (item: Item, field: string, id: string): Money => {
  const value = money(item[field] as number);
  if (!value.ok) throw new Error(`Corrupt transaction ${id}: invalid ${field}`);
  return value.value;
};

export const toTransaction = (item: Item): Transaction => {
  const id = String(item.id);
  if (!STATUSES.includes(item.status as TransactionStatus)) {
    throw new Error(`Corrupt transaction ${id}: invalid status`);
  }
  const delivery = (item.delivery ?? {}) as Item;
  return {
    id,
    status: item.status as TransactionStatus,
    customerId: String(item.customerId),
    variantId: String(item.variantId),
    quantity: item.quantity as number,
    amounts: {
      productAmount: cents(item, 'productAmountCents', id),
      baseFee: cents(item, 'baseFeeCents', id),
      deliveryFee: cents(item, 'deliveryFeeCents', id),
      total: cents(item, 'totalCents', id),
    },
    delivery: {
      recipientName: String(delivery.recipientName),
      address: String(delivery.address),
      city: String(delivery.city),
      phone: String(delivery.phone),
    },
    providerRef:
      item.providerRef === null || item.providerRef === undefined ? null : String(item.providerRef),
    createdAt: String(item.createdAt),
  };
};

export const fromTransaction = (tx: Transaction): Item => ({
  id: tx.id,
  status: tx.status,
  customerId: tx.customerId,
  variantId: tx.variantId,
  quantity: tx.quantity,
  productAmountCents: tx.amounts.productAmount.amountInCents,
  baseFeeCents: tx.amounts.baseFee.amountInCents,
  deliveryFeeCents: tx.amounts.deliveryFee.amountInCents,
  totalCents: tx.amounts.total.amountInCents,
  delivery: { ...tx.delivery },
  providerRef: tx.providerRef,
  createdAt: tx.createdAt,
});
