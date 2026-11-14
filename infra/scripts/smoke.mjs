// Checks a deployed site end to end without buying anything. Usage: node smoke.mjs <site url>
const site = process.argv[2]?.replace(/\/+$/, '');
if (!site?.startsWith('https://')) {
  console.error('Usage: node scripts/smoke.mjs https://<site>');
  process.exit(1);
}
let failed = false;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  (${detail})`}`);
  if (!ok) failed = true;
};

const home = await fetch(`${site}/`);
check(
  'GET / serves the app',
  home.status === 200 && (await home.text()).includes('<div id="root">'),
);
for (const header of [
  'strict-transport-security',
  'content-security-policy',
  'x-content-type-options',
]) {
  check(`site sends ${header}`, home.headers.has(header));
}
const route = await fetch(`${site}/checkout/summary`);
check(
  'an app route returns the app',
  route.status === 200 && (await route.text()).includes('id="root"'),
);

const health = await fetch(`${site}/api/health`);
check('GET /api/health is 200', health.status === 200, health.status);
const products = await fetch(`${site}/api/products`);
const list = products.status === 200 ? await products.json() : [];
check(
  'GET /api/products lists the 6 coffees',
  Array.isArray(list) && list.length === 6,
  products.status,
);
check('API answers are not cached', products.headers.get('cache-control') === 'no-store');

const missing = await fetch(`${site}/api/transactions/does-not-exist`);
const body = await missing.json().catch(() => ({}));
check(
  'an unknown order is a JSON 404, not the app',
  missing.status === 404 && body.code === 'TRANSACTION_NOT_FOUND',
  missing.status,
);

const options = await fetch(`${site}/api/checkout/options`);
check(
  'GET /api/checkout/options reaches the payment service',
  options.status === 200,
  options.status,
);

const cors = await fetch(`${site}/api/products`, { headers: { Origin: 'https://evil.example' } });
check('another origin gets no CORS permission', !cors.headers.has('access-control-allow-origin'));

const big = await fetch(`${site}/api/checkout`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ pad: 'x'.repeat(20_000) }),
});
check('a body above 16 KB is refused with 413', big.status === 413, big.status);

console.log(failed ? 'SMOKE FAILED' : 'SMOKE OK');
process.exit(failed ? 1 : 0);
