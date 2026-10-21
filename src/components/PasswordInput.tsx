"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes, type Ref } from "react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  inputRef?: Ref<HTMLInputElement>;
};

export function PasswordInput({ id, label, hint, error, inputRef, ...input }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const description = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return <div>
    <label className="label" htmlFor={id}>{label}</label>
    <div className="relative">
      <input {...input} ref={inputRef} id={id} type={visible ? "text" : "password"} className="input pr-20"
        autoCapitalize="none" spellCheck={false} aria-describedby={description} aria-invalid={error ? true : undefined} />
      <button type="button" aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`} aria-controls={id} aria-pressed={visible}
        onClick={() => setVisible(value => !value)} className="absolute inset-y-0 right-2 min-w-14 rounded-lg px-2 text-xs font-semibold text-gold-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400">
        {visible ? "Hide" : "Show"}
      </button>
    </div>
    {hint && <p id={`${id}-hint`} className="muted mt-1 text-xs">{hint}</p>}
    {error && <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-red-300">{error}</p>}
  </div>;
}

export function PasswordPair({ name = "password", label = "Password", confirmationName = "passwordConfirm", confirmationLabel = "Confirm password", hint = "At least 10 characters. Use a long password you do not use elsewhere." }: {
  name?: string; label?: string; confirmationName?: string; confirmationLabel?: string; hint?: string;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [touched, setTouched] = useState(false);
  const confirmationInput = useRef<HTMLInputElement>(null);
  const mismatch = confirmation.length > 0 && confirmation !== password;
  useEffect(() => {
    confirmationInput.current?.setCustomValidity(mismatch ? "Passwords do not match. Enter the same password again." : "");
  }, [mismatch]);
  return <div className="space-y-4">
    <PasswordInput id={name} name={name} label={label} autoComplete="new-password" minLength={10} required hint={hint}
      value={password} onChange={event => setPassword(event.target.value)} />
    <PasswordInput id={confirmationName} name={confirmationName} label={confirmationLabel} autoComplete="new-password" required
      inputRef={confirmationInput} value={confirmation} onChange={event => setConfirmation(event.target.value)}
      onBlur={() => setTouched(true)} onInvalid={() => setTouched(true)}
      error={touched && mismatch ? "Passwords do not match. Enter the same password again." : undefined} />
  </div>;
}
