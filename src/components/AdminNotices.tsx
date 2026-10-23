"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { AdminCounts } from "@/lib/admin-data";

export function AdminNotices({ initial, canApprove = false }: { initial: AdminCounts; canApprove?: boolean }) {
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
  if (counts.deposits === 0 && counts.pending === 0 && counts.due === 0) return null;
  return <div className="workspace-notices">
    {counts.deposits > 0 && <div role="status" className="workspace-notice"><Link prefetch={false} href="/admin/deposits"><strong>{counts.deposits} deposit{counts.deposits === 1 ? "" : "s"} {canApprove ? "ready for your review" : "awaiting Super Admin review"}</strong><span>{canApprove ? "Review deposits" : "View deposits"} →</span></Link></div>}
    {(counts.pending > 0 || counts.due > 0) && <div role="status" className="workspace-notice"><Link prefetch={false} href="/admin/trading"><strong>Trading: {counts.pending} awaiting approval · {counts.due} results or payouts due</strong><span>{canApprove ? "Review allocations" : "View allocations"} →</span></Link></div>}
  </div>;
}
