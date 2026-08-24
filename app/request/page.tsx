import Link from "next/link";

export default function RequestPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-hero">
          Request access
        </h1>
        <p className="text-sm text-text-secondary">
          Public self-signup is retired. Accounts are born only via invite or
          an approved request — that flow lands in a follow-up issue.
        </p>
      </header>

      <p className="text-sm text-text-secondary">
        Already have an account?{" "}
        <Link className="text-link underline" href="/login">
          Sign in
        </Link>
      </p>
    </main>
  );
}
