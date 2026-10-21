"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { AdminCounts } from "@/lib/admin-data";

export function AdminNotices({ initial }: { initial: AdminCounts }) {
  const [counts, setCounts] = useState(initial);
  useEffect(() => { setCounts(initial); }, [initial]);
  useEffect(() => {
    const controller = new AbortController(); let busy = false;
    const poll = async () => {
      if (document.hidden || busy) return;
      busy = true;
      try {
        const response = await fetch("/api/admin/notifications", { cache: "no-store", signal: controller.signal });
        if (response.ok) {
          const next = await response.json();
          if ([next.deposits, next.pending, next.due].every(n => Number.isSafeInteger(n) && n >= 0)) setCounts(next);
        }
      } catch { /* Keep the last count during a temporary interruption. */ }
      finally { busy = false; }
    };
    const timer = setInterval(poll, 30000);
    document.addEventListener("visibilitychange", poll);
    return () => { clearInterval(timer); controller.abort(); document.removeEventListener("visibilitychange", poll); };
  }, []);
  return <div className="space-y-3">
    {counts.deposits > 0 && <div role="status" className="mb-6 rounded-xl border border-gold-400/40 bg-gold-400/10 p-4 text-sm text-gold-300"><Link href="/admin/deposits" className="flex flex-wrap justify-between gap-2"><strong>{counts.deposits} deposit{counts.deposits === 1 ? "" : "s"} awaiting your approval</strong><span className="underline">Review deposits →</span></Link></div>}
    {(counts.pending > 0 || counts.due > 0) && <div role="status" className="mb-6 rounded-xl border border-gold-400/40 bg-gold-400/10 p-4 text-sm text-gold-300"><Link href="/admin/trading" className="flex flex-wrap justify-between gap-2"><strong>Trading: {counts.pending} awaiting approval · {counts.due} results or payouts due</strong><span className="underline">Review allocations →</span></Link></div>}
  </div>;
}
