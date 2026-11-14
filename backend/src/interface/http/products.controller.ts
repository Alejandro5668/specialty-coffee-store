import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ListProducts, ProductView } from '../../application/use-cases/list-products';
import { ErrorDto, ProductDto } from './docs/api.dto';
import { unwrap } from './errors';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly listProducts: ListProducts) {}

  @Get()
  @ApiOperation({ summary: 'List the coffees with their sizes, prices and current stock' })
  @ApiOkResponse({ type: [ProductDto] })
  @ApiResponse({ status: 429, description: 'Too many requests', type: ErrorDto })
  async list(): Promise<ProductView[]> {
    return unwrap(await this.listProducts.execute());
  }
}
