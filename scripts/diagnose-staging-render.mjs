import { spawn } from 'node:child_process';
if (process.env.APP_ENV !== 'staging' || !process.env.WALLET_TEST_MEMBER_PASSWORD) throw Error('Isolated staging only');
const base = 'https://furlong-wallet-test.toebu-jenni.workers.dev';
const redact = value => String(value).replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, '[database URL withheld]').replace(/https?:\/\/[^\s"']+/g, '[URL withheld]').slice(0, 1800);
let buffer = '';
const tail = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'tail', 'furlong-wallet-test', '--format', 'json', '--ip', 'self'], { stdio: ['ignore', 'pipe', 'ignore'] });
tail.stdout.on('data', data => {
  buffer += data.toString();
  while (buffer.includes('{')) {
    const start = buffer.indexOf('{'); let depth = 0, quoted = false, escaped = false, end = -1;
    for (let i = start; i < buffer.length; i++) {
      const c = buffer[i];
      if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quoted = false; }
      else if (c === '"') quoted = true;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) { end = i + 1; break; }
    }
    if (end < 0) break;
    try {
      const record = JSON.parse(buffer.slice(start, end));
      console.log(JSON.stringify({ outcome: record.outcome, exceptions: record.exceptions?.map(e => ({ name: e.name, message: redact(e.message) })), errors: record.logs?.filter(l => l.level === 'error').map(l => l.message.map(redact)) }));
    } catch { console.log('Non-event diagnostic frame omitted'); }
    buffer = buffer.slice(end);
  }
});
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  await wait(8000);
  let r = await fetch(base + '/login'), html = await r.text();
  const markup = [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].map(m => m[1]).find(s => s.includes('name="email"'));
  if (!markup) throw Error('Login form unavailable');
  const data = new FormData();
  for (const m of markup.matchAll(/<input\b([^>]+)>/g)) {
    const a = Object.fromEntries([...m[1].matchAll(/([\w$:-]+)="([^"]*)"/g)].map(x => [x[1], x[2].replaceAll('&amp;', '&').replaceAll('&quot;', '"')]));
    if (a.type === 'hidden' && a.name) data.append(a.name, a.value ?? '');
  }
  data.set('email', 'wallet-member@example.com'); data.set('password', process.env.WALLET_TEST_MEMBER_PASSWORD); data.set('next', '/dashboard');
  r = await fetch(base + '/login', { method: 'POST', redirect: 'manual', headers: { Origin: base }, body: data });
  const cookie = r.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  console.log(JSON.stringify({ login: r.status }));
  for (const path of ['/performance', '/account']) {
    r = await fetch(base + path, { headers: { cookie }, signal: AbortSignal.timeout(30000) }); html = await r.text();
    console.log(JSON.stringify({ path, status: r.status, summary: html.includes('results-cycle-report') }));
  }
  await wait(3000);
} finally { tail.kill(); }
