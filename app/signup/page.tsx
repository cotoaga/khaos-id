import Link from "next/link";
import { signupAction } from "@/app/(auth)/actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-hero">
          Create account
        </h1>
        <p className="text-sm text-text-secondary">
          Email + password. Identity is stored in Supabase Auth — no local
          users table.
        </p>
      </header>

      <form action={signupAction} className="flex flex-col gap-3">
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
            minLength={6}
            autoComplete="new-password"
            className="bg-bg-card border border-white/10 px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
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
          Sign up
        </button>
      </form>

      <p className="text-sm text-text-secondary">
        Already have an account?{" "}
        <Link className="text-link underline" href="/login">
          Sign in
        </Link>
      </p>
    </main>
  );
}
