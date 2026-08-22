import Link from "next/link";
import { loginAction } from "@/app/(auth)/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; expired?: string }>;
}) {
  const { error, expired } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-hero">
          Sign in
        </h1>
        <p className="text-sm text-text-secondary">
          Existing identity from khaos-id Supabase Auth.
        </p>
      </header>

      {expired ? (
        <p
          role="status"
          className="border border-info bg-info/10 px-3 py-2 text-sm text-info"
        >
          Session abgelaufen — please sign in again.
        </p>
      ) : null}

      <form action={loginAction} className="flex flex-col gap-3">
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
          Password
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="bg-bg-card border border-white/10 px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
          />
        </label>
        <Link
          className="-mt-1 self-end text-xs text-text-secondary underline hover:text-link"
          href="/forgot"
        >
          Forgot password?
        </Link>
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
          Sign in
        </button>
      </form>

      <p className="text-sm text-text-secondary">
        No account?{" "}
        <Link className="text-link underline" href="/signup">
          Create one
        </Link>
      </p>
    </main>
  );
}
