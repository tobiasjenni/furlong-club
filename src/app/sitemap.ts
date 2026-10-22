import type { MetadataRoute } from "next";
import { publicPages, siteUrl } from "@/lib/seo";
import { clubGateEnabled } from "@/lib/club-gate";

export default function sitemap(): MetadataRoute.Sitemap {
  if (clubGateEnabled() || process.env.APP_ENV === "staging") return [];
  return Object.keys(publicPages).map(path => ({ url: siteUrl(path) }));
}
