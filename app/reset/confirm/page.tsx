import { redirect } from "next/navigation";
import { updatePasswordAction } from "@/app/(auth)/actions";
import { createClient } from "@/lib/supabase/server";

export default async function ResetConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      `/login?error=${encodeURIComponent("Recovery link expired. Request a new one.")}`,
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Choose a new password</h1>
        <p className="text-sm text-neutral-500">
          Signed in via recovery link. Set a new password to finish.
        </p>
      </header>

      <form action={updatePasswordAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          New password
          <input
            type="password"
            name="password"
            required
            minLength={6}
            autoComplete="new-password"
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
          Update password
        </button>
      </form>
    </main>
  );
}
