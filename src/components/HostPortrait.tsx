import { brand } from "@/lib/config";
// Owner-supplied trackside portrait, with small and large assets for responsive loading.
export function HostPortrait({ className = "", rounded = "rounded-3xl", priority = false }: { className?: string; rounded?: string; priority?: boolean }) {
  return (
    <div className={`relative isolate aspect-[3/4] overflow-hidden ring-1 ring-gold-400/30 ${rounded} ${className}`}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src="/rob-trackside-20261023.webp"
      srcSet="/rob-trackside-480-20261023.webp 480w, /rob-trackside-20261023.webp 896w"
      sizes="(min-width: 768px) 384px, (max-width: 480px) calc(100vw - 32px), 448px"
      alt={`${brand.host.name}, Furlong Club trader`}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      width={896}
      height={1200}
      style={{ position: "absolute", width: "100%", height: "100%", inset: 0, objectFit: "cover", objectPosition: "50% 25%" }}
    />
    </div>
  );
}
