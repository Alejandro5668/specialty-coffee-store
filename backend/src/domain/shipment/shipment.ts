import { err, ok, Result } from '../shared/result';
import { Transaction } from '../transaction/transaction';

/** What has to be delivered, to whom and where. It shares the id of the paid transaction. */
export type Shipment = {
  readonly id: string;
  readonly customerId: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly recipientName: string;
  readonly address: string;
  readonly city: string;
  readonly phone: string;
  readonly status: 'ASSIGNED';
};

export type ShipmentError = 'NOT_APPROVED';

/** Only an approved payment earns a delivery; a declined or failed one never does. */
export const assignShipment = (transaction: Transaction): Result<Shipment, ShipmentError> => {
  if (transaction.status !== 'APPROVED') return err('NOT_APPROVED');
  const { id, customerId, variantId, quantity, delivery } = transaction;
  return ok({ id, customerId, variantId, quantity, ...delivery, status: 'ASSIGNED' });
};
