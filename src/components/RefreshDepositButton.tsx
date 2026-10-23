"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function RefreshDepositButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button type="button" className="btn-ghost" disabled={pending} onClick={() => startTransition(() => router.refresh())}>{pending ? "Checking…" : "Check deposit status"}</button>;
}
