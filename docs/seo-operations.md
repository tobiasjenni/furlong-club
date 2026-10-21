# Search appearance and indexing

Public page titles, descriptions, canonical URLs and sharing cards are defined in `src/lib/seo.ts`. The sitemap includes only those seven public pages. Keep the copy accurate when the offer changes; trading remains a proposal with closed enrollment. Do not add unverified returns, ratings, credentials or testimonials to structured data.

The homepage identifies Furlong Club as an Organization and WebSite. Harry’s public biography describes a Person through ProfilePage data. Breadcrumb data matches visible Home links on public detail pages. The sharing image has its editable source in `public/social/furlong-club.svg`; publish a matching 1200×630 PNG when changing it. The organization logo is a 512×512 rendering of the existing monogram.

Member pages, checkout, admin, APIs and authentication pages have noindex response headers. Private layouts and authentication metadata also disable indexing and clear inherited canonical/sharing metadata. Authentication pages are crawlable so crawlers can read noindex. Authenticated member pages still require sign-in independently of search rules. Staging blocks all crawlers, uses noindex metadata/headers and returns an empty sitemap.

`www.furlong.club` permanently redirects to `furlong.club`, preserving the path and query. Canonical URLs use HTTPS and the same host. No fabricated modification dates are emitted in the sitemap.

Run `node scripts/check-seo.mjs` after publishing. To check the isolated test site, set APP_URL to its URL and add `--staging`. The deploy workflows run these checks automatically. They inspect crawler HTML, JSON syntax, canonical links, private redirects, image dimensions and the sitemap; they do not certify Google rich-result eligibility or rankings.

## Owner setup for Google

1. In Google Search Console, add the domain property `furlong.club` with the owner’s Google account.
2. Complete DNS verification in Cloudflare using the exact record Google supplies. Do not fabricate a verification token or publish an unrelated account’s token.
3. Submit `https://furlong.club/sitemap.xml` and inspect `/`, `/trading`, `/plans` and `/meet-harry` to request indexing.
4. Monitor indexing, queries, click-through rates and mobile performance after Google recrawls. Search engines decide the displayed snippet and timing; publication does not guarantee immediate inclusion or position.

No Search Console ownership verification, sitemap submission or indexing request has been performed by this code change. Existing customer accounts, deposits and trading records are unaffected.

References: [Google titles](https://developers.google.com/search/docs/appearance/title-link), [descriptions](https://developers.google.com/search/docs/appearance/snippet), [site names](https://developers.google.com/search/docs/appearance/site-names), [noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing), and [Next.js metadata](https://nextjs.org/docs/app/getting-started/metadata-and-og-images).
