import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const backend = join(__dirname, '..');
const out = join(backend, 'build', 'lambda');

const size = (dir: string): number =>
  readdirSync(dir, { withFileTypes: true }).reduce((sum, entry) => {
    const path = join(dir, entry.name);
    return sum + (entry.isDirectory() ? size(path) : lstatSync(path).size);
  }, 0);

const run = (script: string): string =>
  execFileSync('node', [join(backend, 'scripts', script)], {
    cwd: backend,
    encoding: 'utf8',
    timeout: 170_000,
  });

jest.setTimeout(180_000);

describe('the Lambda package', () => {
  let packaged: string;
  beforeAll(() => {
    packaged = run('package-lambda.mjs');
  });

  it('holds the compiled app and its production dependencies, ready to zip', () => {
    expect(existsSync(join(out, 'lambda.js'))).toBe(true);
    expect(existsSync(join(out, 'node_modules', '@nestjs', 'core'))).toBe(true);
    expect(existsSync(join(out, 'node_modules', '@codegenie', 'serverless-express'))).toBe(true);
    expect(packaged).toMatch(/Packaged \d+ dependencies/);
  });

  it('leaves out everything that is only for development', () => {
    const modules = join(out, 'node_modules');
    for (const dev of ['jest', 'typescript', 'ts-jest', 'aws-sdk-client-mock', 'supertest']) {
      expect(existsSync(join(modules, dev))).toBe(false);
    }
    const types = join(modules, '@types');
    expect(existsSync(types) ? readdirSync(types) : []).toEqual([]);
  });

  it('is far below the 250 MB that Lambda allows unzipped', () => {
    expect(size(out)).toBeLessThan(150 * 1024 * 1024);
  });

  it('starts and answers, which proves Nest still finds every dependency without bundler tricks', () => {
    const verified = run('verify-lambda.mjs');
    expect(verified).toContain('GET /health 200');
    expect(verified).toContain('GET /docs/openapi.json 200');
    expect(verified).toContain('POST /checkout 400');
    expect(verified).toContain('GET /nope 404');
    expect(verified).toContain('Lambda package OK');
  });

  it('keeps the decorator metadata that a bundler such as esbuild would drop', () => {
    const controller = readFileSync(
      join(out, 'interface', 'http', 'checkout.controller.js'),
      'utf8',
    );
    expect(controller).toContain('design:paramtypes');
  });
});
