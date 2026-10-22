import assert from 'node:assert/strict';
const origin = process.env.APP_URL || 'https://furlong.club';
const request = (path, options = {}) => fetch(new URL(path, origin), { redirect: 'manual', signal: AbortSignal.timeout(30000), ...options });
const paths = ['/', '/trading', '/plans', '/meet-harry', '/login', '/signup', '/legal/terms', '/account', '/wallet', '/admin', '/admin/users', '/performance', '/membership', '/allocations'];
// A release runner may already share a remembered public IP. Both states retain
// personal login and API authorization; unknown networks must see the entrance.
const first = await request('/');
assert.ok([200,307].includes(first.status), 'Public landing or entrance must respond');
const rememberedNetwork = first.status === 200;
const personal = new Set(['/account', '/wallet', '/admin', '/admin/users', '/performance', '/membership', '/allocations']);
for (const path of paths) {
  const r = await request(path);
  const expected = rememberedNetwork && !personal.has(path) ? 200 : 307;
  assert.equal(r.status, expected, 'Network entrance / personal login: ' + path);
  if (expected === 307) assert.equal(new URL(r.headers.get('location'), origin).pathname, rememberedNetwork ? '/login' : '/entrance');
  assert.match(r.headers.get('cache-control'), /no-store/);
  assert.match(r.headers.get('x-robots-tag'), /noindex/);
}
const data = await request('/_next/data/probe/index.json');
assert.ok([307,404].includes(data.status), 'Unknown framework data cannot return protected content');
for (const path of ['/api/admin/notifications', '/api/admin/deposits/pending', '/api/admin/trading/pending']) assert.equal((await request(path)).status, 403);
if (!rememberedNetwork) {
  assert.equal((await request('/wallet', { method: 'POST', headers: { Origin: origin, 'Next-Action': 'probe' } })).status, 403);
  assert.equal((await request('/entrance', { method: 'POST', headers: { Origin: origin, 'Next-Action': 'probe' } })).status, 403);
}
assert.equal((await request('/', { headers: { RSC: '1', 'Next-Router-Prefetch': '1' } })).status, rememberedNetwork ? 200 : 307);
const page = await request('/entrance?preview=1');
assert.equal(page.status, 200); const html = await page.text();
assert.match(html, /Some doors open/); assert.match(html, /Club password/);
assert.match(html, /noindex/); assert.match(page.headers.get('content-security-policy'), /default-src/);
assert.equal((await request('/club-entrance.webp')).status, 200);
assert.equal((await request('/favicon.ico')).status, 200);
assert.match(await (await request('/robots.txt')).text(), /Disallow: \//);
assert.doesNotMatch(await (await request('/sitemap.xml')).text(), /<loc>/);
const cross = await request('/api/club-entry', { method: 'POST', headers: { Origin: 'https://evil.invalid', 'Content-Type': 'application/json' }, body: '{}' });
assert.equal(cross.status, 403);
for (const path of ['/api/cron/daily', '/api/cron/payments']) assert.equal((await request(path)).status, 401);
console.log(`Private-club release: ${paths.length} routes (${rememberedNetwork ? 'remembered' : 'unknown'} network), personal login, APIs, RSC, entrance, assets, crawler policy and cron authentication passed.`);
