import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (file: string): string => readFileSync(join(__dirname, file), 'utf-8');

const tokens = (): Record<string, string> =>
  Object.fromEntries(
    [...read('tokens.css').matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
  );

const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('design tokens', () => {
  const t = tokens();

  it.each([
    ['ink', 'bean'],
    ['ink', 'milk'],
    ['muted', 'bean'],
    ['muted', 'milk'],
    ['on-cherry', 'cherry'],
    ['on-cherry', 'cherry-deep'],
    ['cherry', 'bean'],
    ['cherry', 'milk'],
    ['ok', 'milk'],
  ])('text in %s on %s passes WCAG AA (4.5:1)', (fg, bg) => {
    expect(contrast(t[`color-${fg}`], t[`color-${bg}`])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['bean', 'milk'])('control borders on %s pass the 3:1 rule for non-text', (bg) => {
    expect(contrast(t['color-line'], t[`color-${bg}`])).toBeGreaterThanOrEqual(3);
  });

  it('uses real hex colors only, so the contrast check cannot be fooled by a keyword', () => {
    for (const [name, value] of Object.entries(t)) {
      if (name.startsWith('color-')) expect(value).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('keeps touch targets at 44 px or more', () => {
    expect(t.touch).toBe('2.75rem');
    expect(read('base.css')).toMatch(/min-(height|block-size):\s*var\(--touch\)/);
  });

  it('shows a visible keyboard focus and respects reduced motion', () => {
    const base = read('base.css');
    expect(base).toContain(':focus-visible');
    expect(base).toContain('prefers-reduced-motion: reduce');
  });
});
