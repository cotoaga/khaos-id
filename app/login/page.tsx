import Link from "next/link";
import { loginAction } from "@/app/(auth)/actions";

const fieldInput =
  "border border-[var(--brand-border)] bg-[var(--brand-page-bg)] px-3 py-2 text-[var(--brand-text-body)] font-mono text-sm focus:border-[var(--brand-primary)] focus:outline-none";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--brand-hero-color)]">
          Sign in
        </h1>
        <p className="text-sm text-[var(--brand-text-secondary)]">
          Existing identity from khaos-id Supabase Auth.
        </p>
      </header>

      <form action={loginAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.15em] text-[var(--brand-text-secondary)]">
          Email
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className={fieldInput}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.15em] text-[var(--brand-text-secondary)]">
          Password
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className={fieldInput}
          />
        </label>
        {error ? (
          <p
            role="alert"
            className="border border-red-500/40 bg-red-500/10 px-3 py-2 font-mono text-sm text-red-300"
          >
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="mt-2 w-full bg-[var(--brand-primary)] px-7 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-button-text)] transition hover:bg-[var(--brand-accent)] hover:text-[var(--cotoaga-ai-deep-sky)] hover:shadow-[var(--brand-hover-shadow)]"
        >
          Sign in
        </button>
      </form>

      <p className="text-sm text-[var(--brand-text-secondary)]">
        No account?{" "}
        <Link
          className="text-[var(--brand-primary)] underline decoration-[var(--brand-primary)]/40 underline-offset-4 transition hover:text-[var(--brand-accent)]"
          href="/signup"
        >
          Create one
        </Link>
      </p>
    </main>
  );
}
