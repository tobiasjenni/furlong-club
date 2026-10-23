"use client";
import { useState } from "react";
import Link from "next/link";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";

type Result = { error?: string; reauthenticate?: boolean; recoveryCodes?: string[]; ok?: boolean; needsVerification?: boolean };
async function securityRequest(data: object) {
  const result = await fetch("/api/admin/security", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), cache: "no-store" });
  const body = await result.json();
  if (!result.ok) throw Object.assign(new Error(body.error || "Please try again."), { reauthenticate: body.reauthenticate });
  return body;
}

export function AdminPasskeys({ setup = false, next = "/admin", keys = [], remainingCodes = 0 }: {
  setup?: boolean; next?: string; keys?: { id: string; label: string; createdAt: string; lastUsedAt: string | null }[]; remainingCodes?: number;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [reauthenticate, setReauthenticate] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [label, setLabel] = useState("");
  const [replaceCodes, setReplaceCodes] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [needsDeviceVerification, setNeedsDeviceVerification] = useState(false);
  async function run(task: () => Promise<void>) {
    setBusy(true); setMessage(""); setReauthenticate(false);
    try { await task(); }
    catch (error) {
      const e = error as Error & { reauthenticate?: boolean };
      setReauthenticate(Boolean(e.reauthenticate));
      setMessage(e.name === "NotAllowedError" || e.name === "AbortError" ? "Device verification was cancelled or timed out. You can try again or use a recovery code." : e.message || "Device verification could not be completed. Please try again.");
    } finally { setBusy(false); }
  }
  function complete(result: Result) {
    if (result.recoveryCodes) { setCodes(result.recoveryCodes); setSaved(false); setNeedsDeviceVerification(Boolean(result.needsVerification)); }
    else if (result.needsVerification) setRegistered(true);
    else window.location.assign(next);
  }
  function passkey(kind: "register" | "authenticate") {
    return run(async () => {
      const options = await securityRequest({ action: "options", kind });
      const credential = kind === "register" ? await startRegistration({ optionsJSON: options.options }) : await startAuthentication({ optionsJSON: options.options });
      complete(await securityRequest({ action: kind, id: options.id, credential, label }));
    });
  }
  const refresh = `/admin-unlock?refresh=1&next=${encodeURIComponent(setup ? next : "/admin/security")}`;
  return <div className="space-y-5" aria-busy={busy}>
    {codes ? <section className="space-y-4">
      <h2 className="text-xl">Save your recovery codes</h2>
      <p className="muted text-sm">These eight single-use codes can replace your passkey after you confirm your password. Save them in your password manager or another secure place. They are shown only now.</p>
      <div className="grid gap-2 rounded-xl border border-gold-400/30 bg-turf-950 p-4" aria-label="Recovery codes">{codes.map(code => <code className="break-all text-sm text-gold-300" key={code}>{code}</code>)}</div>
      <p className="muted text-sm">Your other sessions and old recovery links have been revoked. Keep access to a second device where possible.</p>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} /><span>I have saved these recovery codes securely.</span></label>
      <button className="btn-gold" disabled={!saved || busy} onClick={() => needsDeviceVerification ? passkey("authenticate") : window.location.assign(next)}>{needsDeviceVerification ? "Verify passkey and continue" : "Continue to security settings"}</button>
    </section> : registered ? <div className="space-y-4"><h2 className="text-xl">Passkey saved</h2><p className="muted text-sm">Verify your device before continuing. Keep an existing verified passkey until you have tested its replacement.</p><button className="btn-gold" disabled={busy} onClick={() => passkey("authenticate")}>Verify passkey and continue</button></div> : <>
      {setup ? <>
        <h2 className="text-xl">{keys.length ? "Verify your device" : "Protect your admin account"}</h2>
        <p className="muted text-sm">{keys.length ? "Use your saved passkey. Your device will ask for its fingerprint, face recognition or PIN." : "Create a passkey using Windows Hello, your phone or a security key. Your device keeps the private key; the club stores only its public key."}</p>
        {!keys.length && <label className="label">Device name<input className="input mt-1" maxLength={80} value={label} onChange={e => setLabel(e.target.value)} placeholder="For example: my laptop" /></label>}
        <button className="btn-gold w-full" disabled={busy} onClick={() => passkey(keys.length ? "authenticate" : "register")}>{busy ? "Waiting for verification…" : keys.length ? "Verify with passkey" : "Set up my passkey"}</button>
        <p className="muted text-xs">Use the full site in Chrome, Edge or Safari if your in-app browser does not support passkeys. You will receive recovery codes when you set up your first device.</p>
        {keys.length > 0 && <>
          <button className="btn-ghost" aria-expanded={showRecovery} disabled={busy} onClick={() => setShowRecovery(v => !v)}>Use a recovery code instead</button>
          {showRecovery && <form className="space-y-3 border-t border-white/10 pt-4" onSubmit={e => { e.preventDefault(); run(async () => complete(await securityRequest({ action: "recover", code: recoveryCode }))); }}>
            <label className="label">Recovery code<input className="input mt-1 font-mono" value={recoveryCode} onChange={e => setRecoveryCode(e.target.value)} maxLength={40} autoComplete="off" autoCapitalize="characters" required /></label>
            <button className="btn-ghost" disabled={busy}>Verify recovery code</button>
          </form>}
        </>}
      </> : <>
        <h2 className="text-xl">Your passkeys</h2>
        <p className="muted text-sm">Add a second device before removing an old one. Your password and a passkey or recovery code are required for admin access.</p>
        <ul className="space-y-3">{keys.map(key => <li key={key.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-4"><div><strong>{key.label}</strong><p className="muted text-xs">Added {key.createdAt} · {key.lastUsedAt ? `Last used ${key.lastUsedAt}` : "Not used to sign in yet"}</p></div><button className="btn-danger" disabled={busy || keys.length <= 1} onClick={() => run(async () => complete(await securityRequest({ action: "remove", credentialId: key.id })))}>Remove</button></li>)}</ul>
        <label className="label">New device name<input className="input mt-1" maxLength={80} value={label} onChange={e => setLabel(e.target.value)} placeholder="For example: my phone" /></label>
        <button className="btn-gold" disabled={busy || keys.length >= 5} onClick={() => passkey("register")}>Add another passkey</button>
        <div className="space-y-3 border-t border-white/10 pt-5"><h2 className="text-xl">Recovery codes</h2><p className="muted text-sm">{remainingCodes} unused codes remain. Replacing the codes immediately invalidates the old set.</p>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={replaceCodes} onChange={e => setReplaceCodes(e.target.checked)} /><span>I want to replace my recovery codes and save the new set.</span></label>
          <button className="btn-ghost" disabled={busy || !replaceCodes} onClick={() => run(async () => complete(await securityRequest({ action: "rotate_codes" })))}>Replace recovery codes</button>
        </div>
        <p className="muted text-sm">Changing security settings requires a password confirmed within the last five minutes. <Link className="text-gold-300 underline" href={refresh}>Confirm your password again</Link>.</p>
      </>}
    </>}
    {message && <div role="alert" className="rounded-xl border border-red-400/30 bg-red-400/5 p-4 text-sm text-red-200">{message}{reauthenticate && <Link className="mt-2 block underline" href={refresh}>Confirm password and device</Link>}</div>}
  </div>;
}
