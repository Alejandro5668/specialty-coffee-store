import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp } from './app-factory';
import { VARIANT_ID } from './fakes/fixtures';

describe('GET /products', () => {
  let app: INestApplication;
  let reserve: (quantity: number) => Promise<unknown>;

  beforeAll(async () => {
    const built = await buildTestApp(5);
    app = built.app;
    reserve = (q) => built.catalog.reserveStock(VARIANT_ID, q);
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists the 6 coffees with description, image, sizes, price and stock', async () => {
    const res = await request(app.getHttpServer()).get('/products');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(6);
    const huila = res.body.find((p: { id: string }) => p.id === 'huila-washed');
    expect(huila).toMatchObject({
      name: 'Huila Washed',
      description: expect.any(String),
      imageUrl: '/images/coffees/huila-washed.webp',
    });
    expect(huila.variants).toEqual([
      {
        id: 'huila-washed-250',
        sizeGrams: 250,
        priceInCents: 3_200_000,
        currency: 'COP',
        stock: 5,
      },
      {
        id: 'huila-washed-500',
        sizeGrams: 500,
        priceInCents: 5_800_000,
        currency: 'COP',
        stock: 12,
      },
    ]);
  });

  it('shows the stock after a purchase', async () => {
    await reserve(2);
    const res = await request(app.getHttpServer()).get('/products');
    const variant = res.body
      .flatMap((p: { variants: { id: string; stock: number }[] }) => p.variants)
      .find((v: { id: string }) => v.id === VARIANT_ID);
    expect(variant.stock).toBe(3);
  });

  it('does not accept other methods', async () => {
    expect((await request(app.getHttpServer()).post('/products').send({})).status).toBe(404);
    expect((await request(app.getHttpServer()).delete('/products')).status).toBe(404);
  });
});
