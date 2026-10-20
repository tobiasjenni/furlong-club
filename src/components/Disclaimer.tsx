import { brand } from "@/lib/config";

export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`rounded-xl border border-gold-400/20 bg-gold-400/5 text-xs text-cream/70 ${compact ? "p-3" : "p-4"}`}>
      <strong className="text-gold-300">18+ only. </strong>
      Tips and videos are opinion and education, not advice or a guarantee of any result. Betting carries risk and past
      races do not predict future ones. Rob is a fictional mascot of {brand.name}.
    </div>
  );
}
