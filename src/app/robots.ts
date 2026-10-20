import type { MetadataRoute } from "next";
import { brand } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/dashboard", "/wallet", "/checkout", "/api"] },
    sitemap: `https://${brand.domain}/sitemap.xml`,
  };
}
