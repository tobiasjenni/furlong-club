"use client";
import { useState } from "react";

export function CopyButton({ value, valueName = "address" }: { value: string; valueName?: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <span className="shrink-0">
    <button
      type="button"
      className="btn-ghost shrink-0 px-3 py-1.5 text-xs"
      onClick={async () => {
        setFailed(false);
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch { setCopied(false); setFailed(true); }
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
    {failed && <span role="status" className="mt-2 block max-w-32 text-xs text-gold-300">Copy unavailable. Select and copy the {valueName} manually.</span>}
    </span>
  );
}
