import { brand } from "@/lib/config";
import portrait from "./harry-whitcombe.jpg";

// The host's portrait: an AI-generated image of a fictional character, not a photo of a real person.
export function HostPortrait({ className = "", rounded = "rounded-3xl" }: { className?: string; rounded?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={portrait.src}
      alt={`Portrait of ${brand.host.name}, the fictional ${brand.name} host`}
      width={portrait.width}
      height={portrait.height}
      className={`aspect-[3/4] object-cover object-top ring-1 ring-gold-400/30 ${rounded} ${className}`}
    />
  );
}
