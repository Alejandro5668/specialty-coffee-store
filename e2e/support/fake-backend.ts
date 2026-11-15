import type { Page, Request, Route } from '@playwright/test';
import { catalog, FEES, type Product } from './data';

export const PROVIDER_URL = 'https://payments.test/v1';

export type Outcome = 'APPROVED' | 'DECLINED' | 'ERROR';
type Order = {
  id: string;
  status: 'PENDING' | Outcome;
  variantId: string;
  quantity: number;
  outcome: Outcome;
  polls: number;
  createdAt: string;
};
export type Call = { method: string; path: string; body: unknown };

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
};
const json = (route: Route, status: number, body: unknown, headers: Record<string, string> = {}) =>
  route
    .fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) })
    // The page may have been reloaded meanwhile: nobody is waiting for this answer any more.
    .catch(() => undefined);
const problem = (route: Route, status: number, code: string, message: string) =>
  json(route, status, { statusCode: status, code, message });

/**
 * A stateful stand-in for our API and for the payment service, installed on one page.
 * It follows the real contract (docs/openapi.json): the server computes every amount, a repeated
 * idempotency key returns the same order, stock is reserved at checkout and given back when a
 * payment fails. The card decides the outcome as in the sandbox: 4242 approves, 4111 declines.
 */
export class FakeBackend {
  products: Product[] = catalog();
  orders = new Map<string, Order>();
  calls: Call[] = [];
  providerCalls: unknown[] = [];
  /** How many reads of an order answer PENDING before it settles. */
  settleAfterPolls = 1;
  /** Never settles: the "still being confirmed" screens. */
  stuckPending = false;
  /** Forces an `ERROR` result whatever the card (the provider failed, not the card). */
  forceError = false;
  /** Delays the answer of POST /checkout after the order was created, to refresh mid-payment. */
  responseDelayMs = 0;
  failProducts = false;
  tooManyRequests = false;
  private byKey = new Map<string, string>();
  private tokens = 0;

  stockOf(variantId: string): number {
    return this.products.flatMap((p) => p.variants).find((v) => v.id === variantId)?.stock ?? NaN;
  }
  apiBodies = () => this.calls.map((c) => JSON.stringify(c.body ?? ''));

  async install(page: Page): Promise<void> {
    await page.route(
      (url) => url.pathname.startsWith('/api/'),
      (route) => this.api(route),
    );
    await page.route(`${PROVIDER_URL}/**`, (route) => this.provider(route));
  }

  private variant(id: string) {
    return this.products.flatMap((p) => p.variants).find((v) => v.id === id);
  }
  private view(o: Order) {
    const v = this.variant(o.variantId)!;
    const product = v.priceInCents * o.quantity;
    return {
      id: o.id,
      status: o.status,
      variantId: o.variantId,
      quantity: o.quantity,
      createdAt: o.createdAt,
      amounts: {
        currency: 'COP',
        productAmountInCents: product,
        ...FEES,
        totalInCents: product + FEES.baseFeeInCents + FEES.deliveryFeeInCents,
      },
    };
  }

  private async provider(route: Route): Promise<void> {
    const request = route.request();
    if (request.method() === 'OPTIONS') return void route.fulfill({ status: 204, headers: CORS });
    const card = (request.postDataJSON() as { number?: string }).number ?? '';
    this.providerCalls.push({ path: new URL(request.url()).pathname });
    const outcome =
      card === '4242424242424242' ? 'APPROVED' : card === '4111111111111111' ? 'DECLINED' : null;
    if (!outcome) {
      const messages = { number: ['is not a valid card'] };
      return void json(route, 422, { error: { type: 'INPUT_VALIDATION_ERROR', messages } }, CORS);
    }
    const data = {
      id: `tok_test_${outcome}_${++this.tokens}`,
      brand: 'VISA',
      last_four: card.slice(-4),
    };
    return void json(route, 201, { status: 'CREATED', data }, CORS);
  }

  private async api(route: Route): Promise<void> {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, '');
    this.calls.push({ method: request.method(), path, body: this.body(request) });
    if (path === '/products') {
      if (this.failProducts)
        return void problem(
          route,
          503,
          'SERVER',
          'Algo salió mal de nuestro lado. Inténtalo de nuevo en un minuto.',
        );
      return void json(
        route,
        200,
        this.products.map((p) => ({
          ...p,
          imageUrl: `/images/coffees/${p.id}.webp`,
          variants: p.variants.map((v) => ({ ...v, currency: 'COP' })),
        })),
      );
    }
    if (path === '/checkout/options') {
      const n = ++this.tokens;
      return void json(route, 200, {
        acceptance: { token: `acc_${n}`, permalink: 'https://example.test/terminos.pdf' },
        personalData: { token: `per_${n}`, permalink: 'https://example.test/datos.pdf' },
        fees: { currency: 'COP', ...FEES },
        maxQuantity: 10,
      });
    }
    if (path === '/checkout' && request.method() === 'POST') return this.checkout(route, request);
    const id = path.match(/^\/transactions\/(.+)$/)?.[1];
    const order = id ? this.orders.get(decodeURIComponent(id)) : undefined;
    if (!order)
      return void problem(route, 404, 'TRANSACTION_NOT_FOUND', 'No encontramos ese pedido.');
    this.settle(order);
    return void json(route, 200, this.view(order));
  }

  private body(request: Request): unknown {
    try {
      return request.postDataJSON();
    } catch {
      return null;
    }
  }

  private async checkout(route: Route, request: Request): Promise<void> {
    if (this.tooManyRequests)
      return void problem(
        route,
        429,
        'TOO_MANY_REQUESTS',
        'Demasiadas peticiones. Espera un minuto e inténtalo de nuevo.',
      );
    const b = request.postDataJSON() as {
      idempotencyKey: string;
      variantId: string;
      quantity: number;
      cardToken: string;
    };
    const known = this.byKey.get(b.idempotencyKey);
    if (known) return void json(route, 201, this.view(this.orders.get(known)!));
    const variant = this.variant(b.variantId);
    if (!variant)
      return void problem(
        route,
        404,
        'VARIANT_NOT_FOUND',
        'Ese tamaño de café no está disponible.',
      );
    if (!Number.isInteger(b.quantity) || b.quantity < 1 || b.quantity > variant.stock) {
      return void problem(
        route,
        409,
        'OUT_OF_STOCK',
        'No hay stock suficiente para esa cantidad. Elige menos unidades.',
      );
    }
    variant.stock -= b.quantity;
    const outcome: Outcome = this.forceError
      ? 'ERROR'
      : b.cardToken.includes('DECLINED')
        ? 'DECLINED'
        : 'APPROVED';
    const order: Order = {
      id: `order-${this.orders.size + 1}`,
      status: 'PENDING',
      variantId: b.variantId,
      quantity: b.quantity,
      outcome,
      polls: 0,
      createdAt: new Date().toISOString(),
    };
    this.orders.set(order.id, order);
    this.byKey.set(b.idempotencyKey, order.id);
    if (this.responseDelayMs) await new Promise((r) => setTimeout(r, this.responseDelayMs));
    return void json(route, 201, this.view(order));
  }

  private settle(order: Order): void {
    if (order.status !== 'PENDING' || this.stuckPending) return;
    if (++order.polls <= this.settleAfterPolls) return;
    order.status = order.outcome;
    if (order.outcome !== 'APPROVED') this.variant(order.variantId)!.stock += order.quantity;
  }
}
