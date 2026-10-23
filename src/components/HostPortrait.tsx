import { brand } from "@/lib/config";
// Owner-supplied photograph. CSS framing focuses on Rob, on the left of the original.
export function HostPortrait({ className = "", rounded = "rounded-3xl", priority = false }: { className?: string; rounded?: string; priority?: boolean }) {
  return (
    <div className={`relative isolate aspect-[3/4] overflow-hidden ring-1 ring-gold-400/30 ${rounded} ${className}`}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src="/rob-trader.jpg"
      alt={`${brand.host.name}, Furlong Club trader`}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      width={1100}
      height={1280}
      style={{ position: "absolute", width: "200%", height: "200%", maxWidth: "none", left: "-20%", top: "-8%", objectFit: "cover", objectPosition: "left top" }}
    />
    </div>
  );
}
