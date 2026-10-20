import type { MetadataRoute } from "next";
import { brand } from "@/lib/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = `https://${brand.domain}`;
  const paths = ["/", "/plans", brand.host.page, "/signup", "/login", "/legal/terms", "/legal/privacy", "/legal/responsible-gambling"];
  return paths.map((p) => ({ url: `${base}${p === "/" ? "" : p}`, changeFrequency: "weekly", priority: p === "/" ? 1 : 0.6 }));
}
