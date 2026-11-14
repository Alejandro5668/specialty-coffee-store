import { Shipment } from '../../domain/shipment/shipment';

/** What a shopper may see. Who receives it and where stay on the server. */
export type ShipmentView = { id: string; status: 'ASSIGNED'; variantId: string; quantity: number };

export const toShipmentView = (s: Shipment): ShipmentView => ({
  id: s.id,
  status: s.status,
  variantId: s.variantId,
  quantity: s.quantity,
});
