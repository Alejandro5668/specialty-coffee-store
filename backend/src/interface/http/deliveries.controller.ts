import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetShipment } from '../../application/use-cases/get-shipment';
import { DeliveryStatusDto, ErrorDto } from './docs/api.dto';
import { unwrap } from './errors';
import { toShipmentView, ShipmentView } from './shipment.view';

@ApiTags('Deliveries')
@Controller('deliveries')
export class DeliveriesController {
  constructor(private readonly getShipment: GetShipment) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get the delivery assigned to a paid order' })
  @ApiParam({ name: 'id', description: 'Order id returned by POST /checkout.' })
  @ApiOkResponse({
    type: DeliveryStatusDto,
    description: 'Never includes the recipient, the address, the phone or the customer.',
  })
  @ApiResponse({ status: 404, description: 'Unpaid or unknown order', type: ErrorDto })
  @ApiResponse({ status: 429, description: 'Too many requests', type: ErrorDto })
  async get(@Param('id') id: string): Promise<ShipmentView> {
    return toShipmentView(unwrap(await this.getShipment.execute(id)));
  }
}
