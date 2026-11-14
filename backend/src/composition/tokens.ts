/** Injection tokens for the ports, so Nest can wire interfaces that have no runtime value. */
export const TOKENS = {
  catalog: Symbol('CatalogRepository'),
  transactions: Symbol('TransactionRepository'),
  orders: Symbol('OrderStore'),
  customers: Symbol('CustomerRepository'),
  gateway: Symbol('PaymentGateway'),
  verifier: Symbol('EventVerifier'),
  ids: Symbol('IdGenerator'),
  clock: Symbol('Clock'),
} as const;
