import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const IMAGES = join(__dirname, '../../public/images/coffees');
const SEED = join(__dirname, '../../../backend/src/infrastructure/seed/coffees.ts');
const MAX_BYTES = 40 * 1024;

const slugs = (): string[] =>
  [...readFileSync(SEED, 'utf-8').matchAll(/slug: '([a-z-]+)'/g)].map((m) => m[1]);

/** Reads the size of a lossy WebP straight from its header, so no image library is needed. */
const dimensions = (file: string): { width: number; height: number } => {
  const bytes = readFileSync(file);
  expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
  expect(bytes.toString('ascii', 8, 12)).toBe('WEBP');
  expect(bytes.toString('ascii', 12, 16)).toBe('VP8 ');
  return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
};

describe('coffee images', () => {
  it('has an image for every coffee the API sells, and for nothing else', () => {
    expect(slugs()).toHaveLength(6);
    const files = readdirSync(IMAGES).sort();
    expect(files).toEqual(
      slugs()
        .map((s) => `${s}.webp`)
        .sort(),
    );
  });

  it.each(slugs())('%s is a WebP of 800 x 600, the size the page reserves for it', (slug) => {
    expect(dimensions(join(IMAGES, `${slug}.webp`))).toEqual({ width: 800, height: 600 });
  });

  it.each(slugs())('%s is light enough to load fast on a phone (under 40 KB)', (slug) => {
    expect(statSync(join(IMAGES, `${slug}.webp`)).size).toBeLessThan(MAX_BYTES);
  });

  it('matches the paths the API sends', () => {
    for (const slug of slugs()) expect(existsSync(join(IMAGES, `${slug}.webp`))).toBe(true);
  });
});
