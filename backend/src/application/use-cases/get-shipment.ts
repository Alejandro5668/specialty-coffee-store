import { err, ok, Result } from '../../domain/shared/result';
import { Shipment } from '../../domain/shipment/shipment';
import { ShipmentRepository } from '../ports/shipment.repository';

export type GetShipmentError = 'DELIVERY_NOT_FOUND';

/** The delivery assigned to a paid order. Orders that were not paid have none. */
export class GetShipment {
  constructor(private readonly shipments: ShipmentRepository) {}

  async execute(id: string): Promise<Result<Shipment, GetShipmentError>> {
    const shipment = typeof id === 'string' && id !== '' ? await this.shipments.findById(id) : null;
    return shipment ? ok(shipment) : err('DELIVERY_NOT_FOUND');
  }
}
