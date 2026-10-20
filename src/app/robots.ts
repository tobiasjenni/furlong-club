import type { MetadataRoute } from "next";
import { brand } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  if (process.env.APP_ENV === "staging") return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/dashboard", "/wallet", "/checkout", "/api"] },
    sitemap: `https://${brand.domain}/sitemap.xml`,
  };
}
