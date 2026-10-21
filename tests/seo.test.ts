import { afterEach, describe, expect, it, vi } from "vitest";
import { pageMetadata, privateMetadata, publicPages, serializeJsonLd, siteUrl, website } from "../src/lib/seo";
import sitemap from "../src/app/sitemap";
import robots from "../src/app/robots";

afterEach(() => vi.unstubAllEnvs());

describe("public search metadata", () => {
  it("uses distinct titles, descriptions and the same canonical host for every public page", () => {
    vi.stubEnv("APP_ENV", "production");
    const entries = Object.entries(publicPages);
    expect(new Set(entries.map(([, page]) => page.title)).size).toBe(entries.length);
    expect(new Set(entries.map(([, page]) => page.description)).size).toBe(entries.length);
    for (const path of Object.keys(publicPages) as (keyof typeof publicPages)[]) {
      const meta = pageMetadata(path);
      expect(meta.alternates?.canonical).toBe(siteUrl(path));
      expect(meta.robots).toMatchObject({ index: true, googleBot: { index: true } });
      expect(meta.openGraph).toMatchObject({ url: siteUrl(path), description: publicPages[path].description });
      expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
    }
  });
  it("keeps authentication and member routes out of the sitemap", () => {
    vi.stubEnv("APP_ENV", "production");
    const urls = sitemap().map(item => item.url);
    expect(urls).toEqual(Object.keys(publicPages).map(siteUrl));
    expect(urls.join(" ")).not.toMatch(/login|signup|wallet|checkout|admin|videos|reset-password/);
    expect(privateMetadata.robots).toMatchObject({ index: false, follow: false, googleBot: { index: false } });
    expect(privateMetadata.alternates?.canonical).toBeNull();
  });
  it("blocks staging indexing in metadata, robots and the sitemap", () => {
    vi.stubEnv("APP_ENV", "staging");
    expect(pageMetadata("/").robots).toMatchObject({ index: false, googleBot: { index: false } });
    expect(sitemap()).toEqual([]);
    expect(robots().rules).toMatchObject({ disallow: "/" });
  });
  it("leaves auth pages crawlable so their noindex can be read", () => {
    vi.stubEnv("APP_ENV", "production");
    expect(robots().rules).toMatchObject({ allow: "/", disallow: expect.arrayContaining(["/admin", "/videos", "/api"]) });
    expect(robots().rules).not.toMatchObject({ disallow: expect.arrayContaining(["/login"]) });
  });
});

describe("structured data", () => {
  it("escapes markup without changing the JSON data", () => {
    const data = { name: '</script><script>alert("x")</script>&' };
    const encoded = serializeJsonLd(data);
    expect(encoded).not.toContain("<");
    expect(encoded).not.toContain("&");
    expect(JSON.parse(encoded)).toEqual(data);
  });
  it("identifies the canonical site without inventing a search feature", () => {
    expect(website).toMatchObject({ "@type": "WebSite", name: "Furlong Club", url: "https://furlong.club/" });
    expect(website).not.toHaveProperty("potentialAction");
  });
});
