"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export function PendingTradingNotice({ initialPending, initialDue }: { initialPending: number; initialDue: number }) {
  const [counts, setCounts] = useState({ pending: initialPending, due: initialDue });
  useEffect(() => { setCounts({ pending: initialPending, due: initialDue }); }, [initialPending, initialDue]);
  useEffect(() => {
    const controller = new AbortController();
    const poll = async () => {
      if (document.hidden) return;
      try { const response = await fetch("/api/admin/trading/pending", { cache: "no-store", signal: controller.signal }); if (response.ok) { const body = await response.json(); if ([body.pending, body.due].every(n => Number.isSafeInteger(n) && n >= 0)) setCounts(body); } } catch { /* Keep the last known count until connectivity resumes. */ }
    };
    const timer = setInterval(poll, 30000);
    return () => { clearInterval(timer); controller.abort(); };
  }, []);
  if (!counts.pending && !counts.due) return null;
  return <div role="status" className="mb-6 rounded-xl border border-gold-400/40 bg-gold-400/10 p-4 text-sm text-gold-300"><Link href="/admin/trading" className="flex flex-wrap justify-between gap-2"><strong>Trading: {counts.pending} awaiting approval · {counts.due} results or payouts due</strong><span className="underline">Review allocations →</span></Link></div>;
}
