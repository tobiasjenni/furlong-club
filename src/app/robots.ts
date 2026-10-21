import type { MetadataRoute } from "next";
import { brand } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  if (process.env.APP_ENV === "staging") return { rules: { userAgent: "*", disallow: "/" } };
  return {
    // Crawlers must see HTML/redirect noindex headers. Authentication still protects
    // member and admin content; robots.txt is not an access-control mechanism.
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    sitemap: `https://${brand.domain}/sitemap.xml`,
  };
}
