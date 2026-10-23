"use client";
import { useActionState } from "react";
import { setSyndicateEntry } from "@/app/actions/syndicates";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
export function EntryControls({ id, accepting, revision }: { id: string; accepting: boolean; revision: number }) {
  const [state, action] = useActionState(setSyndicateEntry, null);
  return <form action={action} className="mt-4 space-y-3"><input type="hidden" name="id" value={id} /><input type="hidden" name="revision" value={revision} /><input type="hidden" name="enabled" value={String(!accepting)} /><label className="label">Reason for this entry change<input name="note" minLength={5} maxLength={1000} required className="input" placeholder="Reason saved in the audit log" /></label><SubmitButton pendingLabel="Updating entry…" className="btn-ghost">{accepting ? "Close this entry" : "Reopen this entry"}</SubmitButton><FormMessage state={state} /></form>;
}
