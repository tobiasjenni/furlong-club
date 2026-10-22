"use client";
import { useState } from "react";

export function EntranceForm({ next }: { next: string }) {
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [admitted, setAdmitted] = useState(false);
  return <form className={admitted ? "club-entry admitted" : "club-entry"} onSubmit={async event => {
    event.preventDefault(); if (busy) return;
    setError(""); setBusy(true);
    try {
      const response = await fetch("/api/club-entry", { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(15000), body: JSON.stringify({ password, next }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error || "Please try again."); setBusy(false); return; }
      setPassword(""); setAdmitted(true);
      window.setTimeout(() => window.location.assign(result.next || "/"), window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 550);
    } catch { setError("We could not reach the door. Please try again."); setBusy(false); }
  }}>
    <label htmlFor="club-password">Invitation password</label>
    <div className="club-entry-input"><input id="club-password" name="password" type={visible ? "text" : "password"} autoComplete="off" autoCapitalize="none" spellCheck={false} required maxLength={72} value={password} onChange={e => setPassword(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? "club-entry-error" : undefined} disabled={busy} /><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "Hide invitation password" : "Show invitation password"} aria-pressed={visible}>{visible ? "Hide" : "Show"}</button></div>
    {error && <p id="club-entry-error" className="club-entry-error" role="alert">{error}</p>}
    <button className="club-entry-submit" type="submit" disabled={busy}>{admitted ? "Welcome to the club" : busy ? "One moment, please…" : "Open the door"}<span aria-hidden="true">{admitted ? "✓" : "→"}</span></button>
    <p className="club-entry-status" role="status">{admitted ? "The door is open. Please come in." : "Members and invited guests only"}</p>
  </form>;
}
