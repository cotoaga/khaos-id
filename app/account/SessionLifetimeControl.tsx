"use client";

import { useActionState } from "react";
import { updateSessionLifetimePrefAction } from "@/app/(auth)/actions";

type Pref = "1h" | "1d" | "7d";

const OPTIONS: { value: Pref; label: string }[] = [
  { value: "1h", label: "1 hour  (JWT default)" },
  { value: "1d", label: "24 hours" },
  { value: "7d", label: "7 days" },
];

export function SessionLifetimeControl({ current }: { current: Pref }) {
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
          className="bg-bg-card border border-white/10 px-3 py-2 text-sm text-text-primary font-mono focus:border-accent focus:outline-none disabled:opacity-50"
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        >
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {pending && (
        <p className="text-xs text-text-secondary">Saving…</p>
      )}
      {!pending && state?.ok && (
        <p className="text-xs text-success">Saved.</p>
      )}
      {!pending && state?.error && (
        <p className="text-xs text-danger">{state.error}</p>
      )}
      <p className="text-xs text-text-secondary">
        Stored in{" "}
        <code className="font-mono text-code">
          user_metadata.session_lifetime_pref
        </code>
        . JWT expiry (3600 s) is a project-level config — this preference is
        available for middleware enforcement.
      </p>
    </form>
  );
}
