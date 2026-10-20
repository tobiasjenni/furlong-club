const origin = process.env.APP_URL || 'https://furlong.club';
let failed = false;
for (const path of ['/', '/plans', '/login', '/signup', '/legal/terms', '/legal/privacy', '/icon.svg', '/robots.txt', '/sitemap.xml']) {
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(20000) });
  const body = await response.text();
  if (response.status !== 200) { console.error(`Release check failed: ${path} (${response.status})`); failed = true; }
  if (path === '/' && /Wallet test site|Test mode: payments|All balances and payments are simulated/.test(body)) {
    console.error('Release check failed: test banner present in production'); failed = true;
  }
  if (path === '/icon.svg' && !body.includes('M21 17H43')) { console.error('Release check failed: outdated brand icon'); failed = true; }
  if (path === '/' && !response.headers.get('content-security-policy')) { console.error('Release check failed: missing security policy'); failed = true; }
  console.log(`Release route ${path}: ${response.status}`);
}
if (failed) process.exitCode = 1;
