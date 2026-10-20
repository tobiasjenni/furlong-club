import { brand } from "@/lib/config";
import portrait from "./harry-whitcombe.jpg";

// Temporary AI-generated illustration; replace this asset with Harry’s real photograph when supplied.
export function HostPortrait({ className = "", rounded = "rounded-3xl" }: { className?: string; rounded?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={portrait.src}
      alt={`AI-generated illustration for ${brand.host.name}, the ${brand.name} host`}
      width={portrait.width}
      height={portrait.height}
      className={`aspect-[3/4] object-cover object-top ring-1 ring-gold-400/30 ${rounded} ${className}`}
    />
  );
}
