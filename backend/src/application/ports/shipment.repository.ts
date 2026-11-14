import { Shipment } from '../../domain/shipment/shipment';

export interface ShipmentRepository {
  findById(id: string): Promise<Shipment | null>;
}
