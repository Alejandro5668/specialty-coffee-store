import { Shipment } from '../../src/domain/shipment/shipment';
import { ShipmentRepository } from '../../src/application/ports/shipment.repository';

export class InMemoryShipments implements ShipmentRepository {
  private readonly byId = new Map<string, Shipment>();

  /** Like a conditional put: a second assignment for the same order changes nothing. */
  putNow(shipment: Shipment): void {
    if (!this.byId.has(shipment.id)) this.byId.set(shipment.id, shipment);
  }

  count(): number {
    return this.byId.size;
  }

  async findById(id: string): Promise<Shipment | null> {
    return this.byId.get(id) ?? null;
  }
}
