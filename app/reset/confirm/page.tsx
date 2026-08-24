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
        <h1 className="font-heading text-2xl font-semibold text-hero">
          Choose a new password
        </h1>
        <p className="text-sm text-text-secondary">
          Signed in via recovery link. Set a new password to finish.
        </p>
      </header>

      <form action={updatePasswordAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          New password
          <input
            type="password"
            name="password"
            required
            minLength={6}
            autoComplete="new-password"
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
          Update password
        </button>
      </form>
    </main>
  );
}
