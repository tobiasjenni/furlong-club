import Link from "next/link";
import { JsonLd } from "./JsonLd";
import { siteUrl } from "@/lib/seo";

export function Breadcrumbs({ path, label }: { path: string; label: string }) {
  return <>
    <nav aria-label="Breadcrumb" className="mb-5 text-sm text-cream/70">
      <ol className="flex flex-wrap items-center gap-x-2">
        <li><Link href="/" className="inline-flex min-h-11 items-center text-gold-300 hover:underline">Home</Link></li>
        <li aria-hidden="true">/</li>
        <li aria-current="page">{label}</li>
      </ol>
    </nav>
    <JsonLd data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl() },
      { "@type": "ListItem", position: 2, name: label, item: siteUrl(path) },
    ] }} />
  </>;
}
