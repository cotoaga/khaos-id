import Link from "next/link";
import { requestPasswordResetAction } from "@/app/(auth)/actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-hero">
          Reset password
        </h1>
        <p className="text-sm text-text-secondary">
          Enter your account email. If it matches an identity, Supabase Auth
          will send a recovery link.
        </p>
      </header>

      {sent ? (
        <p
          role="status"
          className="border border-success bg-success/10 px-3 py-2 text-sm text-success"
        >
          If an account with that email exists, a recovery link is on its way.
        </p>
      ) : (
        <form
          action={requestPasswordResetAction}
          className="flex flex-col gap-3"
        >
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Email
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="bg-bg-card border border-border px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
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
          <button
            type="submit"
            className="bg-cta px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-accent"
          >
            Send recovery link
          </button>
        </form>
      )}

      <p className="text-sm text-text-secondary">
        Remembered it?{" "}
        <Link className="text-link underline" href="/login">
          Sign in
        </Link>
      </p>
    </main>
  );
}
