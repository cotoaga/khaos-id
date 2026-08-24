import Link from "next/link";
import { submitRequestAction } from "@/app/request/actions";

export default async function RequestPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string; confirmed?: string }>;
}) {
  const { error, sent, confirmed } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-hero">
          Request access
        </h1>
        <p className="text-sm text-text-secondary">
          Public self-signup is retired. Requests are reviewed by root after
          you confirm your email.
        </p>
      </header>

      {confirmed ? (
        <p
          role="status"
          className="border border-success bg-success/10 px-3 py-2 text-sm text-success"
        >
          Email confirmed. Your request is now pending review.
        </p>
      ) : sent ? (
        <p
          role="status"
          className="border border-success bg-success/10 px-3 py-2 text-sm text-success"
        >
          If that email isn&apos;t already in use, a confirmation link is on
          its way. Click it to send your request to root for review.
        </p>
      ) : (
        <form action={submitRequestAction} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Email
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="bg-bg-card border border-white/10 px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Name
            <input
              type="text"
              name="name"
              required
              autoComplete="given-name"
              className="bg-bg-card border border-white/10 px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Surname
            <input
              type="text"
              name="surname"
              required
              autoComplete="family-name"
              className="bg-bg-card border border-white/10 px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
            />
          </label>
          {/* Honeypot: hidden from sighted users, off the tab order, never
              autofilled. Bots that fill every field trip it. */}
          <label
            className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
            aria-hidden="true"
          >
            Company
            <input
              type="text"
              name="company"
              tabIndex={-1}
              autoComplete="off"
            />
          </label>
          {error ? (
            <p
              role="alert"
              className="border border-danger bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          ) : null}
          <p className="text-xs text-text-secondary">
            By submitting, you agree to our{" "}
            <a
              className="text-link underline"
              href="https://cotoaga.ai/datenschutz/"
            >
              privacy policy
            </a>
            .
          </p>
          <button
            type="submit"
            className="bg-cta px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-accent"
          >
            Request access
          </button>
        </form>
      )}

      <p className="text-sm text-text-secondary">
        Already have an account?{" "}
        <Link className="text-link underline" href="/login">
          Sign in
        </Link>
      </p>
    </main>
  );
}
