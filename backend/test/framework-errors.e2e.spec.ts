import { Logger } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp } from './app-factory';

type Built = Awaited<ReturnType<typeof buildTestApp>>;
let built: Built;
beforeEach(async () => {
  built = await buildTestApp(5);
});
afterEach(async () => {
  jest.restoreAllMocks();
  await built.app.close();
});

const server = () => built.app.getHttpServer();

describe('errors raised by the framework', () => {
  it('answers an unknown route with a stable code and a plain message, never the path', async () => {
    const res = await request(server()).get('/nope/<script>');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'No encontramos lo que buscas.',
    });
  });

  it('answers malformed JSON without the parser detail', async () => {
    const res = await request(server())
      .post('/checkout')
      .set('content-type', 'application/json')
      .send('{bad');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'La petición no es válida.',
    });
    expect(JSON.stringify(res.body)).not.toMatch(/position|property name|JSON/i);
  });

  it('answers an oversized body with a plain message', async () => {
    const res = await request(server())
      .post('/checkout')
      .send({ pad: 'x'.repeat(20 * 1024) });
    expect(res.status).toBe(413);
    expect(res.body).toEqual({
      statusCode: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'La petición es demasiado grande.',
    });
  });

  it('answers an unexpected failure with a plain message and nothing from the cause', async () => {
    jest.spyOn(built.catalog, 'listCatalog').mockRejectedValueOnce(new Error('password=hunter2'));
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const res = await request(server()).get('/products');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Algo salió mal de nuestro lado. Inténtalo de nuevo en un minuto.',
    });
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
  });

  it('leaves the errors of the API itself untouched', async () => {
    const res = await request(server()).get('/transactions/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      statusCode: 404,
      code: 'TRANSACTION_NOT_FOUND',
      message: 'No encontramos ese pedido.',
    });
  });
});
