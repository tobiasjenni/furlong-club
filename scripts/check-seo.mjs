// Read-only checks of the HTML and headers a crawler receives after deployment.
const origin = process.env.APP_URL || "https://furlong.club";
const staging = process.argv.includes("--staging");
const canonicalOrigin = "https://furlong.club";
const publicPaths = ["/", "/trading", "/plans", "/meet-harry", "/legal/terms", "/legal/privacy", "/legal/responsible-gambling"];
const authPaths = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email"];
const failures = [];
const titles = new Set();
const descriptions = new Set();
const check = (value, message) => { if (!value) failures.push(message); };
const decode = value => value?.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'");
const fetchPage = path => fetch(new URL(path, origin), { headers: { "User-Agent": "Googlebot" }, redirect: "manual", signal: AbortSignal.timeout(20000) });
function elements(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map(([tag]) => Object.fromEntries([...tag.matchAll(/([\w:-]+)=["']([^"']*)["']/g)].map(([, key, value]) => [key.toLowerCase(), decode(value)])));
}
function metadata(html) {
  const meta = elements(html, "meta");
  const value = key => meta.find(tag => tag.name === key || tag.property === key)?.content;
  return { value, canonical: elements(html, "link").find(tag => tag.rel === "canonical")?.href, title: decode(html.match(/<title>([^<]*)<\/title>/i)?.[1]) };
}

for (const path of publicPaths) {
  const response = await fetchPage(path);
  const html = await response.text();
  const { value, canonical, title } = metadata(html);
  const expectedUrl = new URL(path, canonicalOrigin).href;
  check(response.status === 200, `${path}: expected HTTP 200`);
  check(title && !titles.has(title), `${path}: missing or duplicate title`);
  check(value("description") && !descriptions.has(value("description")), `${path}: missing or duplicate description`);
  titles.add(title); descriptions.add(value("description"));
  check(canonical === expectedUrl, `${path}: incorrect canonical URL`);
  check(value("og:url") === expectedUrl, `${path}: incorrect sharing URL`);
  check(value("og:title") === title && value("twitter:title") === title, `${path}: inconsistent sharing titles`);
  check(value("og:description") === value("description"), `${path}: inconsistent sharing description`);
  check(value("og:image") === `${canonicalOrigin}/social/furlong-club.png`, `${path}: missing branded image`);
  check(value("twitter:card") === "summary_large_image", `${path}: missing sharing card`);
  check(staging ? /noindex/.test(value("robots")) : !/noindex/.test(`${value("robots")} ${response.headers.get("x-robots-tag")}`), `${path}: incorrect indexing policy`);
  const blocks = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  const nodes = [];
  for (const [, json] of blocks) {
    try { const data = JSON.parse(json); nodes.push(...(data["@graph"] || [data])); } catch { failures.push(`${path}: invalid structured JSON`); }
  }
  const types = nodes.map(node => node["@type"]);
  check(path === "/" ? types.includes("Organization") && types.includes("WebSite") : types.includes("BreadcrumbList"), `${path}: missing structured information`);
  if (path === "/meet-harry") check(nodes.some(node => node["@type"] === "ProfilePage" && node.mainEntity?.["@type"] === "Person"), `${path}: missing Harry profile information`);
  check(!types.some(type => ["AggregateRating", "Review", "FinancialProduct"].includes(type)), `${path}: unsupported promotional schema`);
  console.log(`SEO public ${path}: ${response.status}, canonical and metadata checked`);
}
for (const path of authPaths) {
  const response = await fetchPage(path);
  const { value, canonical } = metadata(await response.text());
  check(response.status === 200 && /noindex/.test(value("robots")) && /noindex/.test(value("googlebot")), `${path}: missing noindex metadata`);
  check(/noindex/.test(response.headers.get("x-robots-tag")), `${path}: missing noindex header`);
  check(!canonical, `${path}: inherited a public canonical`);
}
for (const path of ["/account", "/dashboard", "/wallet", "/videos", "/checkout/form", "/admin"]) {
  const response = await fetchPage(path);
  check([307, 308].includes(response.status) && /\/login\?/.test(response.headers.get("location")), `${path}: private route must require sign-in`);
  check(/noindex/.test(response.headers.get("x-robots-tag")), `${path}: private redirect lacks noindex`);
}
const sitemapResponse = await fetchPage("/sitemap.xml");
const sitemap = await sitemapResponse.text();
const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url);
check(sitemapResponse.ok, "Sitemap is unavailable");
check(JSON.stringify(locations.slice().sort()) === JSON.stringify((staging ? [] : publicPaths.map(path => new URL(path, canonicalOrigin).href)).sort()), "Sitemap includes the wrong URLs");
const robots = await (await fetchPage("/robots.txt")).text();
check(staging ? /Disallow: \/\s*$/.test(robots.trim()) : robots.includes(`${canonicalOrigin}/sitemap.xml`), "Incorrect crawler rules");
for (const [path, width, height] of [["/social/furlong-club.png", 1200, 630], ["/brand-logo.png", 512, 512], ["/apple-icon.png", 180, 180]]) {
  const response = await fetchPage(path);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const view = new DataView(bytes.buffer);
  check(response.ok && response.headers.get("content-type")?.includes("image/png") && bytes.length > 24 && view.getUint32(16) === width && view.getUint32(20) === height, `${path}: incorrect image dimensions or format`);
}
if (!staging && new URL(origin).hostname === "furlong.club") {
  const response = await fetch("https://www.furlong.club/trading?source=seo-check", { redirect: "manual", signal: AbortSignal.timeout(20000) });
  check(response.status === 308 && response.headers.get("location") === `${canonicalOrigin}/trading?source=seo-check`, "www must permanently redirect to the canonical host and preserve the query");
}
if (failures.length) { for (const failure of failures) console.error(`SEO check failed: ${failure}`); process.exitCode = 1; }
else console.log(`SEO checks passed: ${publicPaths.length} public pages, ${authPaths.length} auth pages, 6 protected routes, sitemap, crawler rules and image assets.`);
