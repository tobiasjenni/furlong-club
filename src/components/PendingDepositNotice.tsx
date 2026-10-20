"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export function PendingDepositNotice({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  useEffect(() => { setCount(initialCount); }, [initialCount]);
  useEffect(() => {
    const controller = new AbortController();
    const poll = async () => {
      if (document.hidden) return;
      try {
        const response = await fetch("/api/admin/deposits/pending", { cache: "no-store", signal: controller.signal });
        if (response.ok) { const body = await response.json(); if (Number.isSafeInteger(body.count) && body.count >= 0) setCount(body.count); }
      } catch { /* Preserve the count during a temporary network interruption. */ }
    };
    const timer = setInterval(poll, 30000);
    return () => { clearInterval(timer); controller.abort(); };
  }, []);
  if (!count) return null;
  return <div role="status" className="mb-6 rounded-xl border border-gold-400/40 bg-gold-400/10 p-4 text-sm text-gold-300">
    <Link href="/admin/deposits" className="flex flex-wrap items-center justify-between gap-2"><strong>{count} deposit{count === 1 ? "" : "s"} awaiting your approval</strong><span className="underline">Review deposits →</span></Link>
  </div>;
}
