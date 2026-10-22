// Public-mode checks. The private deployment uses check-club-gate.mjs instead.
const origin = process.env.APP_URL || 'https://furlong.club';
let failed = false;
for (const path of ['/', '/trading', '/meet-harry', '/plans', '/login', '/signup', '/legal/terms', '/legal/privacy', '/legal/responsible-gambling', '/forgot-password', '/reset-password', '/verify-email', '/icon.svg', '/robots.txt', '/sitemap.xml']) {
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(20000) });
  const body = await response.text();
  // Node assertions only: React separates text with comments. Never render this as HTML
  // or reuse these replacements as an HTML sanitizer.
  const visibleText = body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  if (response.status !== 200) { console.error(`Release check failed: ${path} (${response.status})`); failed = true; }
  if (path === '/' && /Wallet test site|Test mode: payments|All balances and payments are simulated/.test(body)) {
    console.error('Release check failed: test banner present in production'); failed = true;
  }
  if (['/','/plans'].includes(path) && (/30 days|30-day/i.test(visibleText) || !/33 days/.test(visibleText))) { console.error('Release check failed: incorrect membership period'); failed = true; }
  if (path === '/icon.svg' && !body.includes('M21 17H43')) { console.error('Release check failed: outdated brand icon'); failed = true; }
  if (/AI-generated illustration|paddock guide/i.test(body)) { console.error(`Release check failed: outdated host caption at ${path}`); failed = true; }
  if (/fictional character|fictional host|not a real person/i.test(body)) { console.error(`Release check failed: outdated Harry description at ${path}`); failed = true; }
  if (path === '/trading' && !/How funding and approval work/.test(visibleText)) { console.error('Release check failed: trading funding and approval steps are missing'); failed = true; }
  if (['/', '/plans', '/trading'].includes(path) && (!/Trading with Harry/.test(visibleText) || !/membership fee/i.test(visibleText) || !/separate/i.test(visibleText))) { console.error(`Release check failed: trading membership and allocation terms missing at ${path}`); failed = true; }
  if (path === '/' && !response.headers.get('content-security-policy')) { console.error('Release check failed: missing security policy'); failed = true; }
  console.log(`Release route ${path}: ${response.status}`);
}
if (failed) process.exitCode = 1;
