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
        <h1 className="text-2xl font-semibold">Reset password</h1>
        <p className="text-sm text-neutral-500">
          Enter your account email. If it matches an identity, Supabase Auth
          will send a recovery link.
        </p>
      </header>

      {sent ? (
        <p
          role="status"
          className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
        >
          If an account with that email exists, a recovery link is on its way.
        </p>
      ) : (
        <form action={requestPasswordResetAction} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Email
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
            />
          </label>
          {error ? (
            <p
              role="alert"
              className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
            >
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className="rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900"
          >
            Send recovery link
          </button>
        </form>
      )}

      <p className="text-sm text-neutral-500">
        Remembered it?{" "}
        <Link className="underline" href="/login">
          Sign in
        </Link>
      </p>
    </main>
  );
}
