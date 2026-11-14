import { Controller, Get } from '@nestjs/common';
import { ListProducts, ProductView } from '../../application/use-cases/list-products';
import { unwrap } from './errors';

@Controller('products')
export class ProductsController {
  constructor(private readonly listProducts: ListProducts) {}

  @Get()
  async list(): Promise<ProductView[]> {
    return unwrap(await this.listProducts.execute());
  }
}
