"use client";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

export function AutoRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const refresh = () => {
      if (pending || document.hidden || document.activeElement?.matches("input,textarea,select,[contenteditable='true']")) return;
      startTransition(() => router.refresh());
    };
    const t = setInterval(refresh, seconds * 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", refresh); };
  }, [router, seconds, pending]);
  return null;
}
