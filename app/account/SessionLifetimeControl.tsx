"use client";

import { useActionState } from "react";
import { updateSessionLifetimePrefAction } from "@/app/(auth)/actions";
import type { SessionLifetimePref } from "@/lib/session-deadline";

const OPTIONS: { value: SessionLifetimePref; label: string }[] = [
  { value: "1h", label: "1 hour" },
  { value: "1d", label: "24 hours (default)" },
  { value: "7d", label: "7 days" },
];

export function SessionLifetimeControl({ current }: { current: SessionLifetimePref }) {
  const [state, formAction, pending] = useActionState(
    updateSessionLifetimePrefAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Preferred session lifetime
        <select
          name="pref"
          defaultValue={current}
          disabled={pending}
          className="bg-bg-card border border-border px-3 py-2 text-sm text-text-primary font-mono focus:border-accent focus:outline-none disabled:opacity-50"
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        >
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {pending && <p className="text-xs text-text-secondary">Saving…</p>}
      {!pending && state?.ok && <p className="text-xs text-success">Saved.</p>}
      {!pending && state?.error && (
        <p className="text-xs text-danger">{state.error}</p>
      )}
      <p className="text-xs text-text-secondary">
        Stored in{" "}
        <code className="font-mono text-code">
          user_metadata.session_lifetime_pref
        </code>
        . Takes effect on your <em>next</em> login — enforced by a signed
        deadline cookie, independent of the JWT&apos;s own 3600s expiry. It
        will not extend your current session.
      </p>
    </form>
  );
}
