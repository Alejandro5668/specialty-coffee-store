import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { buildTestApp } from './app-factory';

type Built = Awaited<ReturnType<typeof buildTestApp>>;
type Operation = { summary?: string; responses: Record<string, unknown> };
type Doc = { paths: Record<string, Record<string, Operation>> };

let built: Built;
beforeAll(async () => {
  built = await buildTestApp(5);
});
afterAll(async () => built.app.close());

const fetchDoc = async (): Promise<Doc> =>
  (await request(built.app.getHttpServer()).get('/docs/openapi.json')).body;

describe('API documentation', () => {
  it('serves the Swagger UI under the same security headers as the API', async () => {
    const res = await request(built.app.getHttpServer()).get('/docs');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('documents exactly the four public endpoints, and not the health check', async () => {
    const { paths } = await fetchDoc();
    const operations = Object.entries(paths).flatMap(([path, methods]) =>
      Object.keys(methods).map((method) => `${method.toUpperCase()} ${path}`),
    );
    expect(operations.sort()).toEqual([
      'GET /products',
      'GET /transactions/{id}',
      'POST /checkout',
      'POST /webhooks/payments',
    ]);
  });

  it('gives every operation a summary and the error codes it can answer', async () => {
    const { paths } = await fetchDoc();
    for (const methods of Object.values(paths)) {
      for (const op of Object.values(methods)) expect(op.summary?.length).toBeGreaterThan(5);
    }
    expect(Object.keys(paths['/checkout'].post.responses)).toEqual(
      expect.arrayContaining(['201', '400', '404', '409', '413', '422', '429']),
    );
    expect(Object.keys(paths['/transactions/{id}'].get.responses)).toEqual(
      expect.arrayContaining(['200', '404', '429']),
    );
    expect(Object.keys(paths['/webhooks/payments'].post.responses)).toEqual(
      expect.arrayContaining(['200', '400', '401', '404', '413', '422']),
    );
  });

  it('is the same as the committed docs/openapi.json, so the docs cannot drift from the code', async () => {
    const committed = JSON.parse(readFileSync(join(__dirname, '../../docs/openapi.json'), 'utf-8'));
    expect(await fetchDoc()).toEqual(committed);
  });

  it('contains no keys or secrets', async () => {
    const text = JSON.stringify(await fetchDoc());
    expect(text).not.toMatch(/prv_|pub_|integrity|secret/i);
  });
});
